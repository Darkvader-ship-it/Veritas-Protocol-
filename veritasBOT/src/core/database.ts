/**
 * Database Client
 * Supabase connection and query helpers
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from './config.js';
import { logger } from './logger.js';
import type {
  Trader,
  TraderStats,
  Bet,
  SmartMoneySignal,
  GamingAlert,
  BacktestResult,
  Platform,
  Tier,
  TrendingTopic,
  CrossPlatformSignal,
  UnifiedTrader,
  SmartMoneyActivity,
  PlatformSyncStatus,
} from '../types/index.js';

// ===========================================
// Database Client
// ===========================================

class Database {
  private client: SupabaseClient;

  constructor() {
    this.client = createClient(config.database.url, config.database.serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    logger.info('Database client initialized');
  }

  // ===========================================
  // Trader Queries
  // ===========================================

  async getTopTraders(limit = 50): Promise<Trader[]> {
    const { data, error } = await this.client
      .from('user_platform_stats')
      .select(
        `
        user_id,
        score,
        total_bets,
        wins,
        volume,
        users!inner(wallet_address, created_at)
      `
      )
      .order('score', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Failed to fetch top traders', error);
      throw error;
    }

    return (data || []).map((row: any) => ({
      address: row.users.wallet_address,
      veritasScore: row.score,
      tier: this.scoreTotier(row.score),
      totalBets: row.total_bets,
      wins: row.wins,
      losses: row.total_bets - row.wins,
      winRate: row.total_bets > 0 ? row.wins / row.total_bets : 0,
      totalVolume: row.volume?.toString() || '0',
      registeredAt: new Date(row.users.created_at),
      lastActiveAt: new Date(),
    }));
  }

  async getTrader(address: string): Promise<Trader | null> {
    const { data, error } = await this.client
      .from('users')
      .select(
        `
        wallet_address,
        created_at,
        user_platform_stats(score, total_bets, wins, volume)
      `
      )
      .eq('wallet_address', address.toLowerCase())
      .single();

    if (error || !data) {
      return null;
    }

    const stats = (data as any).user_platform_stats?.[0] || {};

    return {
      address: data.wallet_address,
      veritasScore: stats.score || 0,
      tier: this.scoreTotier(stats.score || 0),
      totalBets: stats.total_bets || 0,
      wins: stats.wins || 0,
      losses: (stats.total_bets || 0) - (stats.wins || 0),
      winRate: stats.total_bets > 0 ? stats.wins / stats.total_bets : 0,
      totalVolume: stats.volume?.toString() || '0',
      registeredAt: new Date(data.created_at),
      lastActiveAt: new Date(),
    };
  }

  async getTradersByTier(tier: Tier): Promise<Trader[]> {
    const thresholds = {
      BRONZE: { min: 0, max: 500 },
      SILVER: { min: 500, max: 1000 },
      GOLD: { min: 1000, max: 2000 },
      PLATINUM: { min: 2000, max: 5000 },
      DIAMOND: { min: 5000, max: Infinity },
    };

    const { min, max } = thresholds[tier];

    const { data, error } = await this.client
      .from('user_platform_stats')
      .select(
        `
        user_id,
        score,
        total_bets,
        wins,
        volume,
        users!inner(wallet_address, created_at)
      `
      )
      .gte('score', min)
      .lt('score', max === Infinity ? 1000000 : max)
      .order('score', { ascending: false });

    if (error) {
      logger.error('Failed to fetch traders by tier', error);
      throw error;
    }

    return (data || []).map((row: any) => ({
      address: row.users.wallet_address,
      veritasScore: row.score,
      tier,
      totalBets: row.total_bets,
      wins: row.wins,
      losses: row.total_bets - row.wins,
      winRate: row.total_bets > 0 ? row.wins / row.total_bets : 0,
      totalVolume: row.volume?.toString() || '0',
      registeredAt: new Date(row.users.created_at),
      lastActiveAt: new Date(),
    }));
  }

  // ===========================================
  // Bet Queries
  // ===========================================

  async getBetsForEpoch(epoch: number, platform: Platform = 'dreamdex'): Promise<Bet[]> {
    const tableName = this.getBetTableName(platform);

    const { data, error } = await this.client
      .from(tableName)
      .select('*')
      .eq('round_id', epoch);

    if (error) {
      logger.error('Failed to fetch bets for epoch', error);
      throw error;
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      trader: row.wallet_address,
      platform,
      epoch: row.round_id,
      amount: row.amount?.toString() || '0',
      isBull: row.position === 'Bull',
      timestamp: new Date(row.timestamp),
    }));
  }

  async getTraderBets(
    address: string,
    platform: Platform = 'dreamdex',
    limit = 100
  ): Promise<Bet[]> {
    const tableName = this.getBetTableName(platform);

    const { data, error } = await this.client
      .from(tableName)
      .select('*')
      .eq('wallet_address', address.toLowerCase())
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Failed to fetch trader bets', error);
      throw error;
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      trader: row.wallet_address,
      platform,
      epoch: row.round_id,
      amount: row.amount?.toString() || '0',
      isBull: row.position === 'Bull',
      timestamp: new Date(row.timestamp),
    }));
  }

  async getRecentBets(
    platform: Platform = 'dreamdex',
    minutes = 30,
    limit = 1000
  ): Promise<Bet[]> {
    const tableName = this.getBetTableName(platform);
    const since = new Date(Date.now() - minutes * 60 * 1000).toISOString();

    const { data, error } = await this.client
      .from(tableName)
      .select('*')
      .gte('timestamp', since)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Failed to fetch recent bets', error);
      throw error;
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      trader: row.wallet_address,
      platform,
      epoch: row.round_id || row.market_id,
      amount: row.amount?.toString() || '0',
      isBull: row.position === 'Bull' || row.outcome === 'Yes',
      timestamp: new Date(row.timestamp),
    }));
  }

  // ===========================================
  // Signal Queries
  // ===========================================

  async saveSignal(signal: SmartMoneySignal): Promise<void> {
    const { error } = await this.client.from('smart_money_signals').upsert(
      {
        epoch: signal.epoch,
        platform: signal.platform,
        consensus: signal.consensus,
        confidence: signal.confidence,
        weighted_bull_percent: signal.weightedBullPercent,
        participating_traders: signal.participatingTraders,
        signal_strength: signal.signalStrength,
        created_at: signal.timestamp.toISOString(),
      },
      { onConflict: 'epoch,platform' }
    );

    if (error) {
      logger.error('Failed to save signal', error);
      throw error;
    }
  }

  async getSignalHistory(
    platform: Platform,
    limit = 100
  ): Promise<SmartMoneySignal[]> {
    const { data, error } = await this.client
      .from('smart_money_signals')
      .select('*')
      .eq('platform', platform)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Failed to fetch signal history', error);
      throw error;
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      epoch: row.epoch,
      platform: row.platform,
      consensus: row.consensus,
      confidence: row.confidence,
      weightedBullPercent: row.weighted_bull_percent,
      participatingTraders: row.participating_traders,
      diamondTraderCount: 0,
      platinumTraderCount: 0,
      totalVolumeWei: '0',
      signalStrength: row.signal_strength,
      topTraderAgreement: 0,
      timestamp: new Date(row.created_at),
      bets: [],
    }));
  }

  // ===========================================
  // Gaming Alert Queries
  // ===========================================

  async saveAlert(alert: GamingAlert): Promise<number> {
    const { data, error } = await this.client
      .from('gaming_alerts')
      .insert({
        alert_type: alert.type,
        severity: alert.severity,
        wallets: alert.wallets,
        evidence: alert.evidence,
        recommended_action: alert.recommendedAction,
        status: alert.status,
        created_at: alert.createdAt.toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      logger.error('Failed to save alert', error);
      throw error;
    }

    return data.id;
  }

  async getPendingAlerts(): Promise<GamingAlert[]> {
    const { data, error } = await this.client
      .from('gaming_alerts')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to fetch pending alerts', error);
      throw error;
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      type: row.alert_type,
      severity: row.severity,
      wallets: row.wallets,
      evidence: row.evidence,
      recommendedAction: row.recommended_action,
      status: row.status,
      createdAt: new Date(row.created_at),
      reviewedAt: row.reviewed_at ? new Date(row.reviewed_at) : undefined,
      reviewedBy: row.reviewed_by,
      notes: row.notes,
    }));
  }

  async updateAlertStatus(
    alertId: number,
    status: string,
    reviewedBy?: string,
    notes?: string
  ): Promise<void> {
    const { error } = await this.client
      .from('gaming_alerts')
      .update({
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewedBy,
        notes,
      })
      .eq('id', alertId);

    if (error) {
      logger.error('Failed to update alert status', error);
      throw error;
    }
  }

  // ===========================================
  // Backtest Cache
  // ===========================================

  async getCachedBacktest(
    leader: string,
    startDate: Date,
    endDate: Date,
    settings: object
  ): Promise<BacktestResult | null> {
    const { data, error } = await this.client
      .from('backtest_cache')
      .select('result')
      .eq('leader', leader.toLowerCase())
      .eq('start_date', startDate.toISOString().split('T')[0])
      .eq('end_date', endDate.toISOString().split('T')[0])
      .eq('settings', settings)
      .single();

    if (error || !data) {
      return null;
    }

    return data.result as BacktestResult;
  }

  async cacheBacktest(
    leader: string,
    startDate: Date,
    endDate: Date,
    settings: object,
    result: BacktestResult
  ): Promise<void> {
    const { error } = await this.client.from('backtest_cache').upsert(
      {
        leader: leader.toLowerCase(),
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        settings,
        result,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'leader,start_date,end_date,settings' }
    );

    if (error) {
      logger.error('Failed to cache backtest', error);
      throw error;
    }
  }

  // ===========================================
  // Trending Topics
  // ===========================================

  async saveTrendingTopic(topic: TrendingTopic): Promise<number> {
    const { data, error } = await this.client
      .from('trending_topics')
      .upsert(
        {
          topic: topic.topic,
          normalized_topic: topic.normalizedTopic,
          score: topic.score,
          velocity: topic.velocity,
          total_volume: topic.totalVolume,
          total_markets: topic.totalMarkets,
          category: topic.category,
          platforms: topic.platforms,
          first_seen: topic.firstSeen.toISOString(),
          last_updated: new Date().toISOString(),
        },
        { onConflict: 'normalized_topic' }
      )
      .select('id')
      .single();

    if (error) {
      logger.error('Failed to save trending topic', error);
      throw error;
    }

    return data.id;
  }

  async getTrendingTopics(limit = 50): Promise<TrendingTopic[]> {
    const { data, error } = await this.client
      .from('trending_topics')
      .select('*')
      .order('score', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Failed to fetch trending topics', error);
      throw error;
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      topic: row.topic,
      normalizedTopic: row.normalized_topic,
      score: parseFloat(row.score),
      velocity: parseFloat(row.velocity || 0),
      totalVolume: parseFloat(row.total_volume || 0),
      totalMarkets: row.total_markets,
      category: row.category,
      platforms: row.platforms || [],
      firstSeen: new Date(row.first_seen),
      lastUpdated: new Date(row.last_updated),
    }));
  }

  async getTrendingTopicByNormalized(normalizedTopic: string): Promise<TrendingTopic | null> {
    const { data, error } = await this.client
      .from('trending_topics')
      .select('*')
      .eq('normalized_topic', normalizedTopic)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      topic: data.topic,
      normalizedTopic: data.normalized_topic,
      score: parseFloat(data.score),
      velocity: parseFloat(data.velocity || 0),
      totalVolume: parseFloat(data.total_volume || 0),
      totalMarkets: data.total_markets,
      category: data.category,
      platforms: data.platforms || [],
      firstSeen: new Date(data.first_seen),
      lastUpdated: new Date(data.last_updated),
    };
  }

  // ===========================================
  // Cross-Platform Signals
  // ===========================================

  async saveCrossPlatformSignal(signal: CrossPlatformSignal): Promise<number> {
    const { data, error } = await this.client
      .from('cross_platform_signals')
      .insert({
        topic: signal.topic,
        normalized_topic: signal.normalizedTopic,
        consensus: signal.consensus,
        confidence: signal.confidence,
        volume_weighted_probability: signal.volumeWeightedProbability,
        smart_money_agreement: signal.smartMoneyAgreement,
        platforms: signal.platforms,
        total_volume: signal.totalVolume,
        market_count: signal.marketCount,
        created_at: new Date().toISOString(),
        expires_at: signal.expiresAt?.toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      logger.error('Failed to save cross-platform signal', error);
      throw error;
    }

    return data.id;
  }

  async getCrossPlatformSignals(limit = 50): Promise<CrossPlatformSignal[]> {
    const { data, error } = await this.client
      .from('cross_platform_signals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Failed to fetch cross-platform signals', error);
      throw error;
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      topic: row.topic,
      normalizedTopic: row.normalized_topic,
      consensus: row.consensus,
      confidence: parseFloat(row.confidence),
      volumeWeightedProbability: parseFloat(row.volume_weighted_probability || 0),
      smartMoneyAgreement: parseFloat(row.smart_money_agreement || 0),
      platforms: row.platforms || [],
      totalVolume: parseFloat(row.total_volume || 0),
      marketCount: row.market_count || 0,
      createdAt: new Date(row.created_at),
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
    }));
  }

  async getCrossPlatformSignalByTopic(normalizedTopic: string): Promise<CrossPlatformSignal | null> {
    const { data, error } = await this.client
      .from('cross_platform_signals')
      .select('*')
      .eq('normalized_topic', normalizedTopic)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      topic: data.topic,
      normalizedTopic: data.normalized_topic,
      consensus: data.consensus,
      confidence: parseFloat(data.confidence),
      volumeWeightedProbability: parseFloat(data.volume_weighted_probability || 0),
      smartMoneyAgreement: parseFloat(data.smart_money_agreement || 0),
      platforms: data.platforms || [],
      totalVolume: parseFloat(data.total_volume || 0),
      marketCount: data.market_count || 0,
      createdAt: new Date(data.created_at),
      expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
    };
  }

  // ===========================================
  // Unified Traders
  // ===========================================

  async saveUnifiedTrader(trader: UnifiedTrader): Promise<void> {
    const { error } = await this.client
      .from('unified_traders')
      .upsert(
        {
          primary_address: trader.primaryAddress.toLowerCase(),
          display_name: trader.displayName,
          unified_score: trader.unifiedScore,
          overall_roi: trader.overallRoi,
          total_volume: trader.totalVolume,
          total_bets: trader.totalBets,
          wins: trader.wins,
          losses: trader.losses,
          win_rate: trader.winRate,
          tier: trader.tier,
          platform_scores: trader.platformScores,
          active_platforms: trader.activePlatforms,
          last_active: trader.lastActive.toISOString(),
        },
        { onConflict: 'primary_address' }
      );

    if (error) {
      logger.error('Failed to save unified trader', error);
      throw error;
    }
  }

  async getUnifiedLeaderboard(limit = 100): Promise<UnifiedTrader[]> {
    const { data, error } = await this.client
      .from('unified_traders')
      .select('*')
      .order('unified_score', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Failed to fetch unified leaderboard', error);
      throw error;
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      primaryAddress: row.primary_address,
      displayName: row.display_name,
      unifiedScore: row.unified_score,
      overallRoi: parseFloat(row.overall_roi || 0),
      totalVolume: parseFloat(row.total_volume || 0),
      totalBets: row.total_bets || 0,
      wins: row.wins || 0,
      losses: row.losses || 0,
      winRate: parseFloat(row.win_rate || 0),
      tier: row.tier || 'BRONZE',
      platformScores: row.platform_scores || [],
      activePlatforms: row.active_platforms || [],
      lastActive: new Date(row.last_active),
      createdAt: new Date(row.created_at),
    }));
  }

  async getUnifiedTrader(address: string): Promise<UnifiedTrader | null> {
    const { data, error } = await this.client
      .from('unified_traders')
      .select('*')
      .eq('primary_address', address.toLowerCase())
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      primaryAddress: data.primary_address,
      displayName: data.display_name,
      unifiedScore: data.unified_score,
      overallRoi: parseFloat(data.overall_roi || 0),
      totalVolume: parseFloat(data.total_volume || 0),
      totalBets: data.total_bets || 0,
      wins: data.wins || 0,
      losses: data.losses || 0,
      winRate: parseFloat(data.win_rate || 0),
      tier: data.tier || 'BRONZE',
      platformScores: data.platform_scores || [],
      activePlatforms: data.active_platforms || [],
      lastActive: new Date(data.last_active),
      createdAt: new Date(data.created_at),
    };
  }

  // ===========================================
  // Smart Money Activity
  // ===========================================

  async saveSmartMoneyActivity(activity: SmartMoneyActivity): Promise<void> {
    const { error } = await this.client.from('smart_money_activity').insert({
      trader_address: activity.traderAddress.toLowerCase(),
      trader_name: activity.traderName,
      platform: activity.platform,
      market_id: activity.marketId,
      market_title: activity.marketTitle,
      topic: activity.topic,
      direction: activity.direction,
      amount: activity.amount,
      probability: activity.probability,
      trader_tier: activity.traderTier,
      trader_score: activity.traderScore,
      timestamp: activity.timestamp.toISOString(),
    });

    if (error) {
      logger.error('Failed to save smart money activity', error);
      throw error;
    }
  }

  async getSmartMoneyActivity(limit = 100): Promise<SmartMoneyActivity[]> {
    const { data, error } = await this.client
      .from('smart_money_activity')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Failed to fetch smart money activity', error);
      throw error;
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      traderAddress: row.trader_address,
      traderName: row.trader_name,
      platform: row.platform,
      marketId: row.market_id,
      marketTitle: row.market_title,
      topic: row.topic,
      direction: row.direction,
      amount: parseFloat(row.amount || 0),
      probability: row.probability ? parseFloat(row.probability) : undefined,
      traderTier: row.trader_tier,
      traderScore: row.trader_score,
      timestamp: new Date(row.timestamp),
    }));
  }

  async getSmartMoneyByTopic(topic: string, limit = 50): Promise<SmartMoneyActivity[]> {
    const { data, error } = await this.client
      .from('smart_money_activity')
      .select('*')
      .ilike('topic', `%${topic}%`)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Failed to fetch smart money by topic', error);
      throw error;
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      traderAddress: row.trader_address,
      traderName: row.trader_name,
      platform: row.platform,
      marketId: row.market_id,
      marketTitle: row.market_title,
      topic: row.topic,
      direction: row.direction,
      amount: parseFloat(row.amount || 0),
      probability: row.probability ? parseFloat(row.probability) : undefined,
      traderTier: row.trader_tier,
      traderScore: row.trader_score,
      timestamp: new Date(row.timestamp),
    }));
  }

  // ===========================================
  // Platform Sync Status
  // ===========================================

  async updatePlatformSyncStatus(
    platform: Platform,
    status: Partial<PlatformSyncStatus>
  ): Promise<void> {
    const { error } = await this.client
      .from('platform_sync_status')
      .upsert(
        {
          platform,
          last_leaderboard_sync: status.lastLeaderboardSync?.toISOString(),
          last_markets_sync: status.lastMarketsSync?.toISOString(),
          leaderboard_count: status.leaderboardCount,
          markets_count: status.marketsCount,
          status: status.status,
          error_message: status.errorMessage,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'platform' }
      );

    if (error) {
      logger.error('Failed to update platform sync status', error);
      throw error;
    }
  }

  async getPlatformSyncStatuses(): Promise<PlatformSyncStatus[]> {
    const { data, error } = await this.client
      .from('platform_sync_status')
      .select('*')
      .order('platform');

    if (error) {
      logger.error('Failed to fetch platform sync statuses', error);
      throw error;
    }

    return (data || []).map((row: any) => ({
      platform: row.platform,
      lastLeaderboardSync: row.last_leaderboard_sync
        ? new Date(row.last_leaderboard_sync)
        : undefined,
      lastMarketsSync: row.last_markets_sync ? new Date(row.last_markets_sync) : undefined,
      leaderboardCount: row.leaderboard_count || 0,
      marketsCount: row.markets_count || 0,
      status: row.status || 'unknown',
      errorMessage: row.error_message,
      updatedAt: new Date(row.updated_at),
    }));
  }

  // ===========================================
  // Utility Methods
  // ===========================================

  private getBetTableName(platform: Platform): string {
    const tables: Record<Platform, string> = {
      dreamdex: 'simulated_trades',
      polymarket: 'polymarket_simulated_trades',
      azuro: 'azuro_simulated_trades',
      overtime: 'overtime_simulated_trades',
      limitless: 'limitless_simulated_trades',
      speedmarkets: 'speed_simulated_trades',
      sxbet: 'sxbet_simulated_trades',
      gnosis: 'gnosis_simulated_trades',
      drift: 'drift_simulated_trades',
      kalshi: 'kalshi_simulated_trades',
      manifold: 'manifold_simulated_trades',
      metaculus: 'metaculus_simulated_trades',
    };
    return tables[platform] || 'simulated_trades';
  }

  private scoreTotier(score: number): Tier {
    if (score >= 5000) return 'DIAMOND';
    if (score >= 2000) return 'PLATINUM';
    if (score >= 1000) return 'GOLD';
    if (score >= 500) return 'SILVER';
    return 'BRONZE';
  }

  // Raw client access for custom queries
  get raw() {
    return this.client;
  }
}

// ===========================================
// Singleton Export
// ===========================================

export const db = new Database();
