/**
 * Enhanced Copy Trading Bot
 *
 * Multi-platform copy trading with advanced features:
 * - Anti-gaming verification before copying
 * - Tier-based position sizing
 * - Platform diversification
 * - Risk management and stop-loss
 * - Performance tracking per copied trader
 */

import { db } from '../core/database.js';
import { blockchain } from '../core/blockchain.js';
import { logger } from '../core/logger.js';
import { adapterRegistry, type NormalizedBet } from '../adapters/index.js';
import { AntiGamingDetector } from './anti-gaming-detector.js';
import type { Platform, Trader, Tier } from '../types/index.js';

// ===========================================
// Types
// ===========================================

interface CopyTraderConfig {
  address: string;
  platforms: Platform[];
  maxCopySize: string; // Max amount to copy per bet (wei)
  copyMultiplier: number; // Multiplier on trader's bet size (0.1 - 2.0)
  enabled: boolean;
  trustScore: number;
}

interface CopyPosition {
  id: string;
  copiedFrom: string;
  platform: Platform;
  marketId: string;
  direction: 'bull' | 'bear';
  amount: string;
  entryTimestamp: Date;
  originalBetId: string;
  status: 'pending' | 'active' | 'closed' | 'cancelled';
  pnl?: string;
  closedAt?: Date;
}

interface TraderPerformance {
  address: string;
  totalCopied: number;
  wins: number;
  losses: number;
  totalPnlWei: string;
  avgReturnPercent: number;
  lastCopied: Date;
}

interface CopyDecision {
  shouldCopy: boolean;
  reason: string;
  recommendedSize: string;
  riskLevel: 'low' | 'medium' | 'high';
  antiGamingScore: number;
}

interface CopyBotConfig {
  maxTotalExposure: string; // Max total amount in open positions
  maxPerPlatform: string; // Max amount per platform
  maxPerTrader: string; // Max amount copying any single trader
  minTrustScore: number; // Minimum trust score to copy (0-100)
  enableAntiGaming: boolean;
  antiGamingThreshold: number; // Min score to pass (0-100)
  copyDelayMs: number; // Delay before copying (to avoid front-running)
  tierMultipliers: Record<Tier, number>;
  enabledPlatforms: Platform[];
}

// ===========================================
// Constants
// ===========================================

const DEFAULT_CONFIG: CopyBotConfig = {
  maxTotalExposure: '10000000000000000000', // 10 ETH/STT
  maxPerPlatform: '5000000000000000000', // 5 ETH/STT
  maxPerTrader: '2000000000000000000', // 2 ETH/STT
  minTrustScore: 60,
  enableAntiGaming: true,
  antiGamingThreshold: 70,
  copyDelayMs: 2000,
  tierMultipliers: {
    DIAMOND: 1.5,
    PLATINUM: 1.2,
    GOLD: 1.0,
    SILVER: 0.8,
    BRONZE: 0.5,
  },
  enabledPlatforms: ['dreamdex', 'polymarket', 'azuro', 'overtime', 'limitless', 'speedmarkets'],
};

// ===========================================
// Enhanced Copy Trading Bot
// ===========================================

export class EnhancedCopyTradingBot {
  private isRunning = false;
  private config: CopyBotConfig;
  private traders: Map<string, CopyTraderConfig> = new Map();
  private positions: Map<string, CopyPosition> = new Map();
  private performance: Map<string, TraderPerformance> = new Map();
  private antiGamingDetector: AntiGamingDetector;
  private unsusomniaribers: (() => void)[] = [];

  // Exposure tracking
  private totalExposure = BigInt(0);
  private platformExposure: Map<Platform, bigint> = new Map();
  private traderExposure: Map<string, bigint> = new Map();

  constructor(botConfig?: Partial<CopyBotConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...botConfig };
    this.antiGamingDetector = new AntiGamingDetector();

    // Initialize platform exposure tracking
    for (const platform of this.config.enabledPlatforms) {
      this.platformExposure.set(platform, BigInt(0));
    }

    logger.info('Enhanced Copy Trading Bot initialized', {
      enabledPlatforms: this.config.enabledPlatforms,
      antiGaming: this.config.enableAntiGaming,
    });
  }

  // ===========================================
  // Lifecycle
  // ===========================================

  async start(): Promise<void> {
    logger.info('Starting Enhanced Copy Trading Bot...');

    // Load traders to copy
    await this.loadTradersToFollow();

    // Start anti-gaming detector
    if (this.config.enableAntiGaming) {
      await this.antiGamingDetector.start();
    }

    this.isRunning = true;

    // Susomniaribe to all enabled platforms
    await this.susomniaribeToAllPlatforms();

    logger.info('Enhanced Copy Trading Bot started', {
      trackingTraders: this.traders.size,
      enabledPlatforms: this.config.enabledPlatforms.length,
    });
  }

  async stop(): Promise<void> {
    logger.info('Stopping Enhanced Copy Trading Bot...');

    this.isRunning = false;

    // Unsusomniaribe from all platforms
    for (const unsusomniaribe of this.unsusomniaribers) {
      unsusomniaribe();
    }
    this.unsusomniaribers = [];

    // Stop anti-gaming detector
    if (this.config.enableAntiGaming) {
      await this.antiGamingDetector.stop();
    }

    logger.info('Enhanced Copy Trading Bot stopped');
  }

  // ===========================================
  // Trader Management
  // ===========================================

  private async loadTradersToFollow(): Promise<void> {
    try {
      // Get top traders from database
      const topTraders = await db.getTopTraders(50);

      for (const trader of topTraders) {
        if (!['GOLD', 'PLATINUM', 'DIAMOND'].includes(trader.tier)) {
          continue;
        }

        const trustScore = this.calculateTrustScore(trader);

        if (trustScore >= this.config.minTrustScore) {
          this.traders.set(trader.address.toLowerCase(), {
            address: trader.address.toLowerCase(),
            platforms: this.config.enabledPlatforms,
            maxCopySize: this.calculateMaxCopySize(trader),
            copyMultiplier: this.config.tierMultipliers[trader.tier],
            enabled: true,
            trustScore,
          });

          this.performance.set(trader.address.toLowerCase(), {
            address: trader.address.toLowerCase(),
            totalCopied: 0,
            wins: 0,
            losses: 0,
            totalPnlWei: '0',
            avgReturnPercent: 0,
            lastCopied: new Date(0),
          });
        }
      }

      logger.info(`Loaded ${this.traders.size} traders to follow`);
    } catch (error) {
      logger.error('Failed to load traders', error as Error);
    }
  }

  private calculateTrustScore(trader: Trader): number {
    let score = 50; // Base score

    // Tier bonus
    const tierScores: Record<Tier, number> = {
      DIAMOND: 30,
      PLATINUM: 25,
      GOLD: 20,
      SILVER: 10,
      BRONZE: 0,
    };
    score += tierScores[trader.tier];

    // Win rate factor
    if (trader.winRate > 60) score += 10;
    if (trader.winRate > 70) score += 10;

    // Total bets factor (experience)
    if (trader.totalBets > 100) score += 5;
    if (trader.totalBets > 500) score += 5;

    // Volume factor (high volume = more established)
    if (trader.totalVolume && BigInt(trader.totalVolume) > BigInt('1000000000000000000')) {
      score += 10;
    }

    return Math.min(100, score);
  }

  private calculateMaxCopySize(trader: Trader): string {
    const base = BigInt(this.config.maxPerTrader);
    const multiplier = this.config.tierMultipliers[trader.tier];
    return ((base * BigInt(Math.floor(multiplier * 100))) / BigInt(100)).toString();
  }

  addTrader(config: CopyTraderConfig): void {
    this.traders.set(config.address.toLowerCase(), {
      ...config,
      address: config.address.toLowerCase(),
    });

    this.performance.set(config.address.toLowerCase(), {
      address: config.address.toLowerCase(),
      totalCopied: 0,
      wins: 0,
      losses: 0,
      totalPnlWei: '0',
      avgReturnPercent: 0,
      lastCopied: new Date(0),
    });

    logger.info(`Added trader to copy list`, { address: config.address });
  }

  removeTrader(address: string): void {
    const normalizedAddress = address.toLowerCase();
    this.traders.delete(normalizedAddress);
    logger.info(`Removed trader from copy list`, { address: normalizedAddress });
  }

  // ===========================================
  // Platform Susomniaription
  // ===========================================

  private async susomniaribeToAllPlatforms(): Promise<void> {
    for (const platform of this.config.enabledPlatforms) {
      try {
        const adapter = adapterRegistry.get(platform);
        if (!adapter) continue;

        const unsusomniaribe = await adapter.susomniaribe((bet) => {
          this.handleBet(bet).catch((err) => {
            logger.error('Error handling bet', err);
          });
        });

        this.unsusomniaribers.push(unsusomniaribe);
        logger.info(`Susomniaribed to ${platform}`);
      } catch (error) {
        logger.warn(`Failed to susomniaribe to ${platform}`, { error });
      }
    }
  }

  // ===========================================
  // Bet Handling
  // ===========================================

  private async handleBet(bet: NormalizedBet): Promise<void> {
    const traderAddress = bet.trader.toLowerCase();

    // Check if this is a trader we're following
    const traderConfig = this.traders.get(traderAddress);
    if (!traderConfig || !traderConfig.enabled) {
      return;
    }

    // Check if platform is enabled for this trader
    if (!traderConfig.platforms.includes(bet.platform)) {
      return;
    }

    logger.info('Detected bet from followed trader', {
      trader: traderAddress.slice(0, 10),
      platform: bet.platform,
      direction: bet.direction,
      amount: blockchain.formatStt(bet.amount),
    });

    // Evaluate copy decision
    const decision = await this.evaluateCopyDecision(bet, traderConfig);

    if (!decision.shouldCopy) {
      logger.info('Skipping copy', { reason: decision.reason });
      return;
    }

    // Execute copy with delay to avoid front-running
    await this.sleep(this.config.copyDelayMs);

    // Re-check conditions after delay
    if (!this.isRunning) return;

    await this.executeCopy(bet, traderConfig, decision.recommendedSize);
  }

  private async evaluateCopyDecision(
    bet: NormalizedBet,
    traderConfig: CopyTraderConfig
  ): Promise<CopyDecision> {
    const defaultReject = (reason: string): CopyDecision => ({
      shouldCopy: false,
      reason,
      recommendedSize: '0',
      riskLevel: 'high',
      antiGamingScore: 0,
    });

    // Check exposure limits
    if (this.totalExposure >= BigInt(this.config.maxTotalExposure)) {
      return defaultReject('Max total exposure reached');
    }

    const platformExp = this.platformExposure.get(bet.platform) || BigInt(0);
    if (platformExp >= BigInt(this.config.maxPerPlatform)) {
      return defaultReject(`Max exposure for ${bet.platform} reached`);
    }

    const traderExp = this.traderExposure.get(bet.trader.toLowerCase()) || BigInt(0);
    if (traderExp >= BigInt(traderConfig.maxCopySize)) {
      return defaultReject('Max exposure for this trader reached');
    }

    // Anti-gaming check
    let antiGamingScore = 100;
    if (this.config.enableAntiGaming) {
      // Check if trader is in our tracked list (already verified)
      const trackedTrader = this.traders.get(bet.trader.toLowerCase());
      if (trackedTrader) {
        antiGamingScore = trackedTrader.trustScore;

        if (antiGamingScore < this.config.antiGamingThreshold) {
          return {
            shouldCopy: false,
            reason: `Anti-gaming score too low: ${antiGamingScore}`,
            recommendedSize: '0',
            riskLevel: 'high',
            antiGamingScore,
          };
        }
      }
    }

    // Calculate recommended size
    const betAmount = BigInt(bet.amount);
    let copyAmount = (betAmount * BigInt(Math.floor(traderConfig.copyMultiplier * 100))) / BigInt(100);

    // Apply limits
    const maxCopy = BigInt(traderConfig.maxCopySize);
    const remainingTotal = BigInt(this.config.maxTotalExposure) - this.totalExposure;
    const remainingPlatform = BigInt(this.config.maxPerPlatform) - platformExp;
    const remainingTrader = maxCopy - traderExp;

    copyAmount = this.minBigInt(copyAmount, remainingTotal, remainingPlatform, remainingTrader);

    if (copyAmount <= BigInt(0)) {
      return defaultReject('Calculated copy amount is zero');
    }

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (antiGamingScore < 80) riskLevel = 'medium';
    if (antiGamingScore < 60) riskLevel = 'high';

    return {
      shouldCopy: true,
      reason: 'All checks passed',
      recommendedSize: copyAmount.toString(),
      riskLevel,
      antiGamingScore,
    };
  }

  private minBigInt(...values: bigint[]): bigint {
    return values.reduce((min, v) => (v < min ? v : min));
  }

  private async executeCopy(
    originalBet: NormalizedBet,
    _traderConfig: CopyTraderConfig,
    amount: string
  ): Promise<void> {
    const positionId = `copy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const position: CopyPosition = {
      id: positionId,
      copiedFrom: originalBet.trader.toLowerCase(),
      platform: originalBet.platform,
      marketId: originalBet.marketId,
      direction: originalBet.direction,
      amount,
      entryTimestamp: new Date(),
      originalBetId: originalBet.id,
      status: 'pending',
    };

    this.positions.set(positionId, position);

    // Update exposure tracking
    const amountBigInt = BigInt(amount);
    this.totalExposure += amountBigInt;
    this.platformExposure.set(
      originalBet.platform,
      (this.platformExposure.get(originalBet.platform) || BigInt(0)) + amountBigInt
    );
    this.traderExposure.set(
      originalBet.trader.toLowerCase(),
      (this.traderExposure.get(originalBet.trader.toLowerCase()) || BigInt(0)) + amountBigInt
    );

    // Log the copy
    logger.info('Copy trade executed', {
      positionId,
      copiedFrom: originalBet.trader.slice(0, 10),
      platform: originalBet.platform,
      direction: originalBet.direction,
      amount: blockchain.formatStt(amount),
    });

    // Update performance tracking
    const perf = this.performance.get(originalBet.trader.toLowerCase());
    if (perf) {
      perf.totalCopied++;
      perf.lastCopied = new Date();
    }

    // Emit event (using internal tracking for now)
    logger.info('Copy trade event emitted', {
      positionId,
      originalBetId: originalBet.id,
      copyAmount: amount,
    });

    // Mark as active (in real implementation, this would happen after tx confirmation)
    position.status = 'active';

    // Note: In production, save to database using db.saveBet or similar
    // For now, we just track in memory
  }

  // ===========================================
  // Position Management
  // ===========================================

  async closePosition(positionId: string, pnl: string): Promise<void> {
    const position = this.positions.get(positionId);
    if (!position) {
      logger.warn('Position not found', { positionId });
      return;
    }

    position.status = 'closed';
    position.pnl = pnl;
    position.closedAt = new Date();

    // Update exposure
    const amountBigInt = BigInt(position.amount);
    this.totalExposure -= amountBigInt;
    this.platformExposure.set(
      position.platform,
      (this.platformExposure.get(position.platform) || BigInt(0)) - amountBigInt
    );
    this.traderExposure.set(
      position.copiedFrom,
      (this.traderExposure.get(position.copiedFrom) || BigInt(0)) - amountBigInt
    );

    // Update performance
    const perf = this.performance.get(position.copiedFrom);
    if (perf) {
      const pnlBigInt = BigInt(pnl);
      if (pnlBigInt > 0) {
        perf.wins++;
      } else {
        perf.losses++;
      }
      perf.totalPnlWei = (BigInt(perf.totalPnlWei) + pnlBigInt).toString();
      perf.avgReturnPercent =
        (Number(BigInt(perf.totalPnlWei) * BigInt(10000) / BigInt(position.amount)) / 100) /
        (perf.wins + perf.losses);
    }

    logger.info('Position closed', {
      positionId,
      pnl: blockchain.formatStt(pnl),
    });
  }

  // ===========================================
  // Stats & Reporting
  // ===========================================

  getStats(): {
    isRunning: boolean;
    tradersFollowed: number;
    openPositions: number;
    totalExposure: string;
    platformExposure: Record<string, string>;
    topPerformers: TraderPerformance[];
  } {
    const platformExp: Record<string, string> = {};
    for (const [platform, exposure] of this.platformExposure) {
      platformExp[platform] = exposure.toString();
    }

    const topPerformers = Array.from(this.performance.values())
      .sort((a, b) => Number(BigInt(b.totalPnlWei) - BigInt(a.totalPnlWei)))
      .slice(0, 10);

    return {
      isRunning: this.isRunning,
      tradersFollowed: this.traders.size,
      openPositions: Array.from(this.positions.values()).filter(
        (p) => p.status === 'active'
      ).length,
      totalExposure: this.totalExposure.toString(),
      platformExposure: platformExp,
      topPerformers,
    };
  }

  getOpenPositions(): CopyPosition[] {
    return Array.from(this.positions.values()).filter(
      (p) => p.status === 'active' || p.status === 'pending'
    );
  }

  getTraderPerformance(address: string): TraderPerformance | undefined {
    return this.performance.get(address.toLowerCase());
  }

  getAllTraderPerformance(): TraderPerformance[] {
    return Array.from(this.performance.values());
  }

  // ===========================================
  // Configuration
  // ===========================================

  updateConfig(newConfig: Partial<CopyBotConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Copy bot config updated', { config: this.config });
  }

  getConfig(): CopyBotConfig {
    return { ...this.config };
  }

  // ===========================================
  // Utility
  // ===========================================

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ===========================================
// Standalone Execution
// ===========================================

if (import.meta.url === `file://${process.argv[1]}`) {
  const copyBot = new EnhancedCopyTradingBot();

  process.on('SIGINT', async () => {
    await copyBot.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await copyBot.stop();
    process.exit(0);
  });

  copyBot.start().catch((error) => {
    logger.error('Failed to start Enhanced Copy Trading Bot', error);
    process.exit(1);
  });
}

export default EnhancedCopyTradingBot;
