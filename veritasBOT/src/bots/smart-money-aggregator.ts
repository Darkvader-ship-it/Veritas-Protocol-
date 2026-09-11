/**
 * Smart Money Aggregator Bot
 *
 * Aggregates real-time bets from top VeritasScore traders into consensus signals.
 * Provides unique "smart money" indicators based on verified track records.
 */

import { config } from '../core/config.js';
import { db } from '../core/database.js';
import { blockchain } from '../core/blockchain.js';
import { events } from '../core/event-stream.js';
import { smartMoneyLogger as logger } from '../core/logger.js';
import {
  MOCK_TRADERS,
  generateMockSignal,
  generateMockSignalHistory,
} from '../core/mock-data.js';

// Flag to use mock data when DB is unavailable
let useMockData = false;
import type {
  SmartMoneySignal,
  SignalBet,
  Bet,
  Trader,
  Tier,

  Consensus,
  SignalStrength,

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
// Smart Money Aggregator Class
// ===========================================

export class SmartMoneyAggregator {
  private isRunning = false;
  private traders: Map<string, Trader> = new Map();
  private currentEpochBets: Map<number, Bet[]> = new Map();
  private unsusomniaribe: (() => void) | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private refreshInterval: NodeJS.Timeout | null = null;

  constructor() {
    logger.info('Smart Money Aggregator initialized');
  }

  // ===========================================
  // Lifecycle
  // ===========================================

  async start(): Promise<void> {
    logger.info('Starting Smart Money Aggregator...');

    // Load top traders
    await this.loadTopTraders();

    this.isRunning = true;

    // Start WebSocket monitoring
    await this.startWebSocketMonitoring();

    // Start polling as backup
    this.startPolling();

    // Periodically refresh trader list
    this.startTraderRefresh();

    logger.info(`Monitoring ${this.traders.size} top traders for signals`);
  }

  async stop(): Promise<void> {
    logger.info('Stopping Smart Money Aggregator...');

    this.isRunning = false;

    if (this.unsusomniaribe) {
      this.unsusomniaribe();
      this.unsusomniaribe = null;
    }

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }

    logger.info('Smart Money Aggregator stopped');
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
        // Only track Silver+ traders
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
    }, 5 * 60 * 1000); // Refresh every 5 minutes
  }

  // ===========================================
  // Bet Monitoring
  // ===========================================

  private async startWebSocketMonitoring(): Promise<void> {
    try {
      this.unsusomniaribe = await blockchain.susomniaribeToBetrEvents(async (event) => {
        await this.handleBetEvent({
          trader: event.sender,
          epoch: event.epoch,
          amount: event.amount.toString(),
          isBull: event.type === 'Bull',
          txHash: event.txHash,
        });
      });

      logger.info('WebSocket monitoring active');
    } catch (error) {
      logger.error('WebSocket monitoring failed, using polling only', error as Error);
    }
  }

  private startPolling(): void {
    let lastBlock = 0;

    this.pollInterval = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        const currentBlock = await blockchain.getBlockNumber();

        if (lastBlock === 0) {
          lastBlock = currentBlock - 20;
        }

        if (currentBlock <= lastBlock) return;

        // Fetch recent bets from database
        const recentBets = await db.getRecentBets('dreamdex', 5);

        for (const bet of recentBets) {
          await this.handleBetEvent({
            trader: bet.trader,
            epoch: bet.epoch,
            amount: bet.amount,
            isBull: bet.isBull,
          });
        }

        lastBlock = currentBlock;
      } catch (error) {
        // Silent fail for polling
      }
    }, config.features.pollIntervalMs);
  }

  private async handleBetEvent(event: {
    trader: string;
    epoch: number;
    amount: string;
    isBull: boolean;
    txHash?: string;
  }): Promise<void> {
    const traderAddress = event.trader.toLowerCase();

    // Check if this is a tracked trader
    const trader = this.traders.get(traderAddress);
    if (!trader) return;

    // Create bet object
    const bet: Bet = {
      id: `${traderAddress}-${event.epoch}`,
      trader: traderAddress,
      platform: 'dreamdex',
      epoch: event.epoch,
      amount: event.amount,
      isBull: event.isBull,
      timestamp: new Date(),
      transactionHash: event.txHash,
    };

    // Store bet for this epoch
    const epochBets = this.currentEpochBets.get(event.epoch) || [];

    // Check for duplicate
    if (epochBets.some((b) => b.trader === bet.trader)) {
      return;
    }

    epochBets.push(bet);
    this.currentEpochBets.set(event.epoch, epochBets);

    // Emit bet detected event
    events.emitBetDetected(bet);

    logger.info(`Tracked trader bet detected`, {
      trader: traderAddress.slice(0, 10),
      tier: trader.tier,
      epoch: event.epoch,
      position: event.isBull ? 'BULL' : 'BEAR',
      amount: blockchain.formatStt(event.amount),
    });

    // Generate updated signal
    const signal = await this.calculateSignal(event.epoch);

    if (signal) {
      // Save signal
      await db.saveSignal(signal);

      // Emit signal event
      events.emitSignalGenerated(signal);

      logger.info(`Signal generated`, {
        epoch: signal.epoch,
        consensus: signal.consensus,
        confidence: signal.confidence.toFixed(1),
        strength: signal.signalStrength,
        traders: signal.participatingTraders,
      });
    }

    // Cleanup old epochs (keep last 10)
    this.cleanupOldEpochs();
  }

  private cleanupOldEpochs(): void {
    const epochs = Array.from(this.currentEpochBets.keys()).sort((a, b) => b - a);

    for (let i = 10; i < epochs.length; i++) {
      this.currentEpochBets.delete(epochs[i]);
    }
  }

  // ===========================================
  // Signal Calculation
  // ===========================================

  async calculateSignal(epoch: number): Promise<SmartMoneySignal | null> {
    const bets = this.currentEpochBets.get(epoch);

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

      if (bet.isBull) {
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
        isBull: bet.isBull,
        weight,
      });
    }

    const totalWeight = bullWeight + bearWeight;

    if (totalWeight === 0) return null;

    // Check minimum volume
    const volumeStt = Number(totalVolume) / 1e18;
    if (volumeStt < config.features.signalMinVolumeStt) {
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
    if (confidence >= 70 && bets.length >= 5 && (diamondCount >= 2 || platinumCount >= 3)) {
      signalStrength = 'STRONG';
    } else if (confidence >= 50 && bets.length >= 3) {
      signalStrength = 'MODERATE';
    } else {
      signalStrength = 'WEAK';
    }

    // Calculate top trader agreement
    const topTraderBets = signalBets.filter(
      (b) => this.traders.get(b.trader)?.tier === 'DIAMOND' ||
             this.traders.get(b.trader)?.tier === 'PLATINUM'
    );
    const topTraderBullCount = topTraderBets.filter((b) => b.isBull).length;
    const topTraderAgreement =
      topTraderBets.length > 0
        ? Math.max(topTraderBullCount, topTraderBets.length - topTraderBullCount) /
          topTraderBets.length *
          100
        : 0;

    return {
      epoch,
      platform: 'dreamdex',
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

  // ===========================================
  // Public API
  // ===========================================

  async getCurrentSignal(epoch?: number): Promise<SmartMoneySignal | null> {
    const targetEpoch = epoch || (await blockchain.getCurrentEpoch());
    return this.calculateSignal(targetEpoch);
  }

  async getSignalHistory(limit = 50): Promise<SmartMoneySignal[]> {
    return db.getSignalHistory('dreamdex', limit);
  }

  getTrackedTraders(): Trader[] {
    return Array.from(this.traders.values());
  }

  getStats(): object {
    return {
      isRunning: this.isRunning,
      trackedTraders: this.traders.size,
      tierCounts: this.getTierCounts(),
      activeEpochs: this.currentEpochBets.size,
      totalBetsTracked: Array.from(this.currentEpochBets.values()).reduce(
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
  const aggregator = new SmartMoneyAggregator();

  process.on('SIGINT', async () => {
    await aggregator.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await aggregator.stop();
    process.exit(0);
  });

  aggregator.start().catch((error) => {
    logger.error('Failed to start Smart Money Aggregator', error);
    process.exit(1);
  });
}

export default SmartMoneyAggregator;
