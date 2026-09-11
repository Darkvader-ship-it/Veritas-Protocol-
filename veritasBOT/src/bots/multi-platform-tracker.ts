/**
 * Multi-Platform Tracker
 * Polls leaderboards from all 12 platforms and builds unified trader profiles
 */

import { db } from '../core/database.js';
import { logger } from '../core/logger.js';
import { config } from '../core/config.js';
import type {
  Platform,
  Tier,
  UnifiedTrader,
  PlatformScore,
  PlatformSyncStatus,
} from '../types/index.js';
import { ALL_PLATFORMS, TIER_WEIGHTS } from '../types/index.js';

// Frontend API base URL
const FRONTEND_API_BASE = process.env.FRONTEND_API_URL || 'http://localhost:3000';

// Polling intervals (staggered to avoid hammering APIs)
const LEADERBOARD_POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes
const STAGGER_DELAY = 25 * 1000; // 25 seconds between platforms

interface LeaderboardEntry {
  address?: string;
  walletAddress?: string;
  username?: string;
  veritasScore?: number;
  score?: number;
  totalBets?: number;
  wins?: number;
  losses?: number;
  winRate?: number;
  totalVolume?: string | number;
  volume?: string | number;
  pnl?: number;
  roi?: number;
}

export class MultiPlatformTracker {
  private isRunning = false;
  private pollTimers: Map<Platform, NodeJS.Timeout> = new Map();
  private traderCache: Map<string, Map<Platform, PlatformScore>> = new Map();

  constructor() {
    logger.info('Multi-Platform Tracker initialized', { bot: 'multi-platform' });
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Multi-Platform Tracker already running', { bot: 'multi-platform' });
      return;
    }

    this.isRunning = true;
    logger.info('Starting Multi-Platform Tracker...', { bot: 'multi-platform' });

    // Start polling each platform with staggered delays
    for (let i = 0; i < ALL_PLATFORMS.length; i++) {
      const platform = ALL_PLATFORMS[i];
      const delay = i * STAGGER_DELAY;

      setTimeout(() => {
        this.startPlatformPolling(platform);
      }, delay);
    }

    // Initial unified leaderboard build after all platforms have been polled
    setTimeout(() => {
      this.buildUnifiedLeaderboard();
    }, ALL_PLATFORMS.length * STAGGER_DELAY + 10000);

    logger.info('Multi-Platform Tracker running', {
      bot: 'multi-platform',
      platforms: ALL_PLATFORMS.length,
    });
  }

  async stop(): Promise<void> {
    this.isRunning = false;

    // Clear all poll timers
    for (const timer of this.pollTimers.values()) {
      clearInterval(timer);
    }
    this.pollTimers.clear();

    logger.info('Multi-Platform Tracker stopped', { bot: 'multi-platform' });
  }

  private startPlatformPolling(platform: Platform): void {
    // Initial poll
    this.pollPlatformLeaderboard(platform);

    // Set up recurring poll
    const timer = setInterval(() => {
      this.pollPlatformLeaderboard(platform);
    }, LEADERBOARD_POLL_INTERVAL);

    this.pollTimers.set(platform, timer);
  }

  private async pollPlatformLeaderboard(platform: Platform): Promise<void> {
    const startTime = Date.now();

    try {
      logger.info(`Polling ${platform} leaderboard...`, { bot: 'multi-platform', platform });

      const leaderboard = await this.fetchLeaderboard(platform);

      if (leaderboard.length === 0) {
        logger.warn(`No data from ${platform} leaderboard`, { bot: 'multi-platform', platform });
        await this.updateSyncStatus(platform, 'error', 0, 'No data returned');
        return;
      }

      // Process and cache trader data
      for (const entry of leaderboard) {
        const address = this.normalizeAddress(entry);
        if (!address) continue;

        const score = this.extractPlatformScore(entry, platform);

        if (!this.traderCache.has(address)) {
          this.traderCache.set(address, new Map());
        }
        this.traderCache.get(address)!.set(platform, score);
      }

      const elapsed = Date.now() - startTime;
      logger.info(`Polled ${platform}: ${leaderboard.length} traders in ${elapsed}ms`, {
        bot: 'multi-platform',
        platform,
        count: leaderboard.length,
      });

      await this.updateSyncStatus(platform, 'ok', leaderboard.length);

    } catch (error) {
      logger.error(`Failed to poll ${platform} leaderboard`, error as Error, {
        bot: 'multi-platform',
        platform,
      });
      await this.updateSyncStatus(platform, 'error', 0, (error as Error).message);
    }
  }

  private async fetchLeaderboard(platform: Platform): Promise<LeaderboardEntry[]> {
    const url = `${FRONTEND_API_BASE}/api/${platform}-leaderboard`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as Record<string, unknown>;

      // Handle different response formats
      if (Array.isArray(data)) {
        return data as LeaderboardEntry[];
      }
      if (data.data && Array.isArray(data.data)) {
        return data.data as LeaderboardEntry[];
      }
      if (data.leaderboard && Array.isArray(data.leaderboard)) {
        return data.leaderboard as LeaderboardEntry[];
      }
      if (data.traders && Array.isArray(data.traders)) {
        return data.traders as LeaderboardEntry[];
      }

      logger.warn(`Unexpected response format from ${platform}`, {
        bot: 'multi-platform',
        platform,
        keys: Object.keys(data as object),
      });
      return [];

    } catch (error) {
      throw error;
    }
  }

  private normalizeAddress(entry: LeaderboardEntry): string | null {
    const addr = entry.address || entry.walletAddress || entry.username;
    if (!addr) return null;

    // For blockchain addresses, lowercase
    if (addr.startsWith('0x')) {
      return addr.toLowerCase();
    }

    // For usernames (Manifold, Metaculus), keep as-is
    return addr;
  }

  private extractPlatformScore(entry: LeaderboardEntry, platform: Platform): PlatformScore {
    const score = entry.veritasScore || entry.score || 0;
    const totalBets = entry.totalBets || 0;
    const wins = entry.wins || 0;
    const losses = entry.losses || (totalBets - wins);
    const winRate = entry.winRate || (totalBets > 0 ? wins / totalBets : 0);
    const volume = this.parseVolume(entry.totalVolume || entry.volume || 0);
    const roi = entry.roi || entry.pnl || 0;

    return {
      platform,
      score,
      tier: this.scoreToTier(score),
      totalBets,
      wins,
      losses,
      winRate,
      volume,
      roi,
      lastActive: new Date(),
    };
  }

  private parseVolume(volume: string | number): number {
    if (typeof volume === 'number') return volume;

    // Handle wei strings
    if (volume.length > 15) {
      return Number(BigInt(volume) / BigInt(1e18));
    }

    return parseFloat(volume) || 0;
  }

  private scoreToTier(score: number): Tier {
    if (score >= 5000) return 'DIAMOND';
    if (score >= 2000) return 'PLATINUM';
    if (score >= 1000) return 'GOLD';
    if (score >= 500) return 'SILVER';
    return 'BRONZE';
  }

  async buildUnifiedLeaderboard(): Promise<void> {
    logger.info('Building unified leaderboard...', { bot: 'multi-platform' });

    const traders: UnifiedTrader[] = [];

    for (const [address, platformScores] of this.traderCache.entries()) {
      const scoresArray = Array.from(platformScores.values());

      if (scoresArray.length === 0) continue;

      // Calculate unified metrics
      const unifiedScore = this.calculateUnifiedScore(scoresArray);
      const totalVolume = scoresArray.reduce((sum, s) => sum + s.volume, 0);
      const totalBets = scoresArray.reduce((sum, s) => sum + s.totalBets, 0);
      const totalWins = scoresArray.reduce((sum, s) => sum + s.wins, 0);
      const totalLosses = scoresArray.reduce((sum, s) => sum + s.losses, 0);
      const overallRoi = this.calculateWeightedRoi(scoresArray);
      const activePlatforms = scoresArray.map(s => s.platform);

      const trader: UnifiedTrader = {
        primaryAddress: address,
        displayName: undefined,
        unifiedScore,
        overallRoi,
        totalVolume,
        totalBets,
        wins: totalWins,
        losses: totalLosses,
        winRate: totalBets > 0 ? totalWins / totalBets : 0,
        tier: this.scoreToTier(unifiedScore),
        platformScores: scoresArray,
        activePlatforms,
        lastActive: new Date(),
        createdAt: new Date(),
      };

      traders.push(trader);
    }

    // Sort by unified score and save top traders
    traders.sort((a, b) => b.unifiedScore - a.unifiedScore);

    let saved = 0;
    for (const trader of traders.slice(0, 500)) { // Top 500
      try {
        await db.saveUnifiedTrader(trader);
        saved++;
      } catch (error) {
        logger.error('Failed to save unified trader', error as Error, {
          bot: 'multi-platform',
          address: trader.primaryAddress,
        });
      }
    }

    logger.info(`Built unified leaderboard: ${saved} traders saved`, {
      bot: 'multi-platform',
      totalCached: this.traderCache.size,
      saved,
    });
  }

  private calculateUnifiedScore(scores: PlatformScore[]): number {
    if (scores.length === 0) return 0;

    // Weight scores by tier and volume
    let weightedSum = 0;
    let totalWeight = 0;

    for (const score of scores) {
      const tierWeight = TIER_WEIGHTS[score.tier] || 1;
      const volumeWeight = Math.log10(Math.max(score.volume, 1) + 1);
      const weight = tierWeight * volumeWeight;

      weightedSum += score.score * weight;
      totalWeight += weight;
    }

    // Bonus for multi-platform presence
    const platformBonus = Math.min(scores.length * 100, 500);

    return Math.round((weightedSum / totalWeight) + platformBonus);
  }

  private calculateWeightedRoi(scores: PlatformScore[]): number {
    if (scores.length === 0) return 0;

    let weightedSum = 0;
    let totalVolume = 0;

    for (const score of scores) {
      weightedSum += score.roi * score.volume;
      totalVolume += score.volume;
    }

    return totalVolume > 0 ? weightedSum / totalVolume : 0;
  }

  private async updateSyncStatus(
    platform: Platform,
    status: 'ok' | 'error',
    count: number,
    errorMessage?: string
  ): Promise<void> {
    try {
      await db.updatePlatformSyncStatus(platform, {
        status,
        leaderboardCount: count,
        lastLeaderboardSync: new Date(),
        errorMessage,
      });
    } catch (error) {
      logger.error('Failed to update sync status', error as Error, {
        bot: 'multi-platform',
        platform,
      });
    }
  }

  // ===========================================
  // Public API
  // ===========================================

  getStats(): object {
    return {
      isRunning: this.isRunning,
      cachedTraders: this.traderCache.size,
      activePlatforms: this.pollTimers.size,
      platforms: ALL_PLATFORMS,
    };
  }

  async getUnifiedLeaderboard(limit = 100): Promise<UnifiedTrader[]> {
    return db.getUnifiedLeaderboard(limit);
  }

  async getTraderProfile(address: string): Promise<UnifiedTrader | null> {
    return db.getUnifiedTrader(address);
  }

  async getPlatformStatuses(): Promise<PlatformSyncStatus[]> {
    return db.getPlatformSyncStatuses();
  }

  // Force refresh a specific platform
  async refreshPlatform(platform: Platform): Promise<void> {
    await this.pollPlatformLeaderboard(platform);
    await this.buildUnifiedLeaderboard();
  }

  // Force refresh all platforms
  async refreshAll(): Promise<void> {
    for (const platform of ALL_PLATFORMS) {
      await this.pollPlatformLeaderboard(platform);
    }
    await this.buildUnifiedLeaderboard();
  }
}

// Singleton export
export const multiPlatformTracker = new MultiPlatformTracker();
