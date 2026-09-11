/**
 * Smart Money Aggregator V2
 *
 * Multi-platform version that uses the adapter system.
 * Aggregates bets from ALL supported platforms into unified signals.
 *
 * Key changes from V1:
 * - Uses adapter registry instead of hardcoded DreamDEX
 * - Generates signals per platform AND cross-platform
 * - Market IDs are platform-specific strings (not just epochs)
 */

import { config } from '../core/config.js';
import { db } from '../core/database.js';
import { events } from '../core/event-stream.js';
import { smartMoneyLogger as logger } from '../core/logger.js';
import {
  adapterRegistry,
  setupAdapters,
  cleanupAdapters,
} from '../adapters/index.js';
import type { NormalizedBet } from '../adapters/types.js';
import type {
  SmartMoneySignal,
  SignalBet,
  Trader,
  Tier,
  Consensus,
  SignalStrength,
  Platform,
} from '../types/index.js';

// ===========================================
// Tier Weight Configuration
// ===========================================

const TIER_WEIGHTS: Record<Tier, number> = {
  DIAMOND: 5,
  PLATINUM: 3,
  GOLD: 2,
  SILVER: 1.5,
  BRONZE: 1,
};

// ===========================================
// Types
// ===========================================

interface MarketKey {
  platform: Platform;
  marketId: string;
}

function marketKeyToString(key: MarketKey): string {
  return `${key.platform}:${key.marketId}`;
}

function stringToMarketKey(str: string): MarketKey {
  const [platform, marketId] = str.split(':');
  return { platform: platform as Platform, marketId };
}

// ===========================================
// Smart Money Aggregator V2 Class
// ===========================================

export class SmartMoneyAggregatorV2 {
  private isRunning = false;
  private traders: Map<string, Trader> = new Map();
  private marketBets: Map<string, NormalizedBet[]> = new Map(); // key: platform:marketId
  private unsusomniaribe: (() => void) | null = null;
  private refreshInterval: NodeJS.Timeout | null = null;
  private enabledPlatforms: Platform[];

  constructor(platforms?: Platform[]) {
    this.enabledPlatforms = platforms ?? ['dreamdex', 'polymarket'];
    logger.info('Smart Money Aggregator V2 initialized', {
      platforms: this.enabledPlatforms,
    });
  }

  // ===========================================
  // Lifecycle
  // ===========================================

  async start(): Promise<void> {
    logger.info('Starting Smart Money Aggregator V2...');

    // Setup adapters
    await setupAdapters(this.enabledPlatforms);

    // Load top traders
    await this.loadTopTraders();

    this.isRunning = true;

    // Susomniaribe to all platforms
    this.unsusomniaribe = await adapterRegistry.susomniaribeAll(async (bet) => {
      await this.handleBet(bet);
    });

    // Periodically refresh trader list
    this.startTraderRefresh();

    logger.info(
      `Monitoring ${this.traders.size} traders across ${this.enabledPlatforms.length} platforms`
    );
  }

  async stop(): Promise<void> {
    logger.info('Stopping Smart Money Aggregator V2...');

    this.isRunning = false;

    if (this.unsusomniaribe) {
      this.unsusomniaribe();
      this.unsusomniaribe = null;
    }

    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }

    await cleanupAdapters();

    logger.info('Smart Money Aggregator V2 stopped');
  }

  // ===========================================
  // Trader Management
  // ===========================================

  private async loadTopTraders(): Promise<void> {
    logger.info('Loading top traders...');

    try {
      const topTraders = await db.getTopTraders(100);

      this.traders.clear();
      for (const trader of topTraders) {
        if (['SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'].includes(trader.tier)) {
          this.traders.set(trader.address.toLowerCase(), trader);
        }
      }

      const tierCounts = this.getTierCounts();
      logger.info(`Loaded ${this.traders.size} traders`, tierCounts);
    } catch (error) {
      logger.error('Failed to load top traders', error as Error);
    }
  }

  private getTierCounts(): Record<Tier, number> {
    const counts: Record<Tier, number> = {
      DIAMOND: 0,
      PLATINUM: 0,
      GOLD: 0,
      SILVER: 0,
      BRONZE: 0,
    };

    for (const trader of this.traders.values()) {
      counts[trader.tier]++;
    }

    return counts;
  }

  private startTraderRefresh(): void {
    this.refreshInterval = setInterval(async () => {
      if (!this.isRunning) return;
      await this.loadTopTraders();
    }, 5 * 60 * 1000);
  }

  // ===========================================
  // Bet Handling
  // ===========================================

  private async handleBet(bet: NormalizedBet): Promise<void> {
    const traderAddress = bet.trader.toLowerCase();

    // Check if this is a tracked trader
    const trader = this.traders.get(traderAddress);
    if (!trader) return;

    // Store bet for this market
    const marketKey = marketKeyToString({
      platform: bet.platform,
      marketId: bet.marketId,
    });

    const existingBets = this.marketBets.get(marketKey) || [];

    // Check for duplicate
    if (existingBets.some((b) => b.id === bet.id)) {
      return;
    }

    existingBets.push(bet);
    this.marketBets.set(marketKey, existingBets);

    // Emit bet detected event (convert to old format for compatibility)
    events.emitBetDetected({
      id: bet.id,
      trader: bet.trader,
      platform: bet.platform,
      epoch: parseInt(bet.marketId, 10) || 0,
      amount: bet.amount,
      isBull: bet.direction === 'bull',
      timestamp: bet.timestamp,
      transactionHash: bet.transactionHash,
    });

    logger.info(`Tracked trader bet detected`, {
      trader: traderAddress.slice(0, 10),
      tier: trader.tier,
      platform: bet.platform,
      market: bet.marketId.slice(0, 10),
      direction: bet.direction.toUpperCase(),
    });

    // Generate updated signal
    const signal = await this.calculateSignal(bet.platform, bet.marketId);

    if (signal) {
      await db.saveSignal(signal);
      events.emitSignalGenerated(signal);

      logger.info(`Signal generated`, {
        platform: signal.platform,
        market: signal.epoch,
        consensus: signal.consensus,
        confidence: signal.confidence.toFixed(1),
        strength: signal.signalStrength,
        traders: signal.participatingTraders,
      });
    }

    // Cleanup old markets (keep last 20 per platform)
    this.cleanupOldMarkets();
  }

  private cleanupOldMarkets(): void {
    const marketsByPlatform: Map<Platform, string[]> = new Map();

    for (const key of this.marketBets.keys()) {
      const { platform, marketId } = stringToMarketKey(key);
      const markets = marketsByPlatform.get(platform) || [];
      markets.push(marketId);
      marketsByPlatform.set(platform, markets);
    }

    for (const [platform, markets] of marketsByPlatform) {
      if (markets.length > 20) {
        // Sort by marketId (assumes newer markets have higher IDs)
        markets.sort((a, b) => b.localeCompare(a));

        for (let i = 20; i < markets.length; i++) {
          this.marketBets.delete(marketKeyToString({ platform, marketId: markets[i] }));
        }
      }
    }
  }

  // ===========================================
  // Signal Calculation
  // ===========================================

  async calculateSignal(
    platform: Platform,
    marketId: string
  ): Promise<SmartMoneySignal | null> {
    const marketKey = marketKeyToString({ platform, marketId });
    const bets = this.marketBets.get(marketKey);

    if (!bets || bets.length < config.features.signalMinTraders) {
      return null;
    }

    // Calculate weighted consensus
    let bullWeight = 0;
    let bearWeight = 0;
    let totalVolume = BigInt(0);
    let diamondCount = 0;
    let platinumCount = 0;
    const signalBets: SignalBet[] = [];

    for (const bet of bets) {
      const trader = this.traders.get(bet.trader);
      if (!trader) continue;

      const tierWeight = TIER_WEIGHTS[trader.tier];
      const amount = BigInt(bet.amount);
      const weight = tierWeight * Number(amount);

      if (bet.direction === 'bull') {
        bullWeight += weight;
      } else {
        bearWeight += weight;
      }

      totalVolume += amount;

      if (trader.tier === 'DIAMOND') diamondCount++;
      if (trader.tier === 'PLATINUM') platinumCount++;

      signalBets.push({
        trader: bet.trader,
        tier: trader.tier,
        amount: bet.amount,
        isBull: bet.direction === 'bull',
        weight,
      });
    }

    const totalWeight = bullWeight + bearWeight;

    if (totalWeight === 0) return null;

    // Check minimum volume (convert based on platform)
    const volumeInStandard = this.normalizeVolume(platform, totalVolume);
    if (volumeInStandard < config.features.signalMinVolumeStt) {
      return null;
    }

    // Calculate metrics
    const bullPercent = (bullWeight / totalWeight) * 100;
    const confidence = Math.abs(bullPercent - 50) * 2;

    // Determine consensus
    let consensus: Consensus;
    if (bullPercent > 60) {
      consensus = 'BULL';
    } else if (bullPercent < 40) {
      consensus = 'BEAR';
    } else {
      consensus = 'NEUTRAL';
    }

    // Calculate signal strength
    let signalStrength: SignalStrength;
    if (
      confidence >= 70 &&
      bets.length >= 5 &&
      (diamondCount >= 2 || platinumCount >= 3)
    ) {
      signalStrength = 'STRONG';
    } else if (confidence >= 50 && bets.length >= 3) {
      signalStrength = 'MODERATE';
    } else {
      signalStrength = 'WEAK';
    }

    // Calculate top trader agreement
    const topTraderBets = signalBets.filter((b) => {
      const t = this.traders.get(b.trader);
      return t?.tier === 'DIAMOND' || t?.tier === 'PLATINUM';
    });
    const topTraderBullCount = topTraderBets.filter((b) => b.isBull).length;
    const topTraderAgreement =
      topTraderBets.length > 0
        ? (Math.max(topTraderBullCount, topTraderBets.length - topTraderBullCount) /
            topTraderBets.length) *
          100
        : 0;

    return {
      epoch: parseInt(marketId, 10) || 0, // For compatibility
      platform,
      consensus,
      confidence,
      weightedBullPercent: bullPercent,
      participatingTraders: bets.length,
      diamondTraderCount: diamondCount,
      platinumTraderCount: platinumCount,
      totalVolumeWei: totalVolume.toString(),
      signalStrength,
      topTraderAgreement,
      timestamp: new Date(),
      bets: signalBets,
    };
  }

  /**
   * Normalize volume to STT equivalent for comparison.
   * Different platforms use different currencies.
   */
  private normalizeVolume(platform: Platform, volumeWei: bigint): number {
    const volumeNum = Number(volumeWei) / 1e18;

    switch (platform) {
      case 'dreamdex':
        return volumeNum; // Already in STT
      case 'polymarket':
        // USDC (was converted to 18 decimals in adapter)
        // Approximate: 1 STT ≈ $600 USDC
        return volumeNum / 600;
      case 'azuro':
      case 'overtime':
      case 'limitless':
        // TODO: Add proper conversion rates
        return volumeNum / 500;
      default:
        return volumeNum;
    }
  }

  // ===========================================
  // Public API
  // ===========================================

  async getCurrentSignal(
    platform: Platform,
    marketId?: string
  ): Promise<SmartMoneySignal | null> {
    // If no marketId provided, get current/active market
    if (!marketId) {
      const adapter = adapterRegistry.get(platform);
      if (!adapter) return null;

      const activeMarkets = await adapter.getActiveMarkets(1);
      if (activeMarkets.length === 0) return null;

      marketId = activeMarkets[0];
    }

    return this.calculateSignal(platform, marketId);
  }

  async getSignalHistory(
    platform: Platform,
    limit = 50
  ): Promise<SmartMoneySignal[]> {
    return db.getSignalHistory(platform, limit);
  }

  getTrackedTraders(): Trader[] {
    return Array.from(this.traders.values());
  }

  getActiveMarkets(): Map<string, number> {
    const result = new Map<string, number>();
    for (const [key, bets] of this.marketBets) {
      result.set(key, bets.length);
    }
    return result;
  }

  getStats(): object {
    const marketCounts: Record<string, number> = {};
    for (const [key, bets] of this.marketBets) {
      const { platform } = stringToMarketKey(key);
      marketCounts[platform] = (marketCounts[platform] || 0) + bets.length;
    }

    return {
      isRunning: this.isRunning,
      enabledPlatforms: this.enabledPlatforms,
      trackedTraders: this.traders.size,
      tierCounts: this.getTierCounts(),
      activeMarkets: this.marketBets.size,
      betsByPlatform: marketCounts,
      totalBetsTracked: Array.from(this.marketBets.values()).reduce(
        (sum, bets) => sum + bets.length,
        0
      ),
    };
  }
}

// ===========================================
// Standalone Execution
// ===========================================

if (import.meta.url === `file://${process.argv[1]}`) {
  // Parse command line args for platforms
  const platforms = process.argv.slice(2) as Platform[];
  const aggregator = new SmartMoneyAggregatorV2(
    platforms.length > 0 ? platforms : undefined
  );

  process.on('SIGINT', async () => {
    await aggregator.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await aggregator.stop();
    process.exit(0);
  });

  aggregator.start().catch((error) => {
    logger.error('Failed to start Smart Money Aggregator V2', error);
    process.exit(1);
  });
}

export default SmartMoneyAggregatorV2;
