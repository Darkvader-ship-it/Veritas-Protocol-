/**
 * Portfolio Optimizer Bot
 *
 * Optimizes prediction market portfolio allocation using:
 * - Kelly Criterion for position sizing
 * - Modern Portfolio Theory for diversification
 * - Risk-adjusted returns (Sharpe ratio optimization)
 * - Cross-platform correlation analysis
 */

import { db } from '../core/database.js';
import { logger } from '../core/logger.js';
import { adapterRegistry, type NormalizedBet } from '../adapters/index.js';
import type { Platform, Trader, Tier } from '../types/index.js';

// ===========================================
// Types
// ===========================================

interface Position {
  platform: Platform;
  marketId: string;
  direction: 'bull' | 'bear';
  amount: string;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  timestamp: Date;
}

interface MarketOpportunity {
  platform: Platform;
  marketId: string;
  marketTitle?: string;
  direction: 'bull' | 'bear';
  expectedEdge: number; // Expected value edge (%)
  confidence: number; // 0-100
  smartMoneyDirection?: 'bull' | 'bear' | 'neutral';
  smartMoneyStrength: number;
  recommendedSize: number; // Fraction of bankroll (0-1)
  riskScore: number; // 1-10
}

interface PortfolioAllocation {
  platform: Platform;
  marketId: string;
  direction: 'bull' | 'bear';
  allocationPercent: number;
  amountWei: string;
  reason: string;
}

interface PortfolioStats {
  totalValueWei: string;
  positionCount: number;
  platformDiversification: Record<Platform, number>;
  avgRiskScore: number;
  expectedReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
}

interface OptimizationParams {
  maxPositionSize: number; // Max % of portfolio per position
  minPositionSize: number; // Min % worth taking
  targetPlatformDiversification: number; // Max % per platform
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  kellyFraction: number; // Fraction of Kelly (usually 0.25-0.5)
  minEdge: number; // Minimum edge to consider (%)
  maxOpenPositions: number;
}

// ===========================================
// Constants
// ===========================================

const DEFAULT_PARAMS: OptimizationParams = {
  maxPositionSize: 0.1, // 10% max per position
  minPositionSize: 0.01, // 1% minimum
  targetPlatformDiversification: 0.4, // 40% max per platform
  riskTolerance: 'moderate',
  kellyFraction: 0.25, // Quarter Kelly
  minEdge: 2, // 2% minimum edge
  maxOpenPositions: 20,
};

const RISK_TOLERANCE_MULTIPLIERS = {
  conservative: 0.5,
  moderate: 1.0,
  aggressive: 1.5,
};

// ===========================================
// Portfolio Optimizer Class
// ===========================================

export class PortfolioOptimizer {
  private isRunning = false;
  private params: OptimizationParams;
  private positions: Map<string, Position> = new Map();
  private opportunities: MarketOpportunity[] = [];
  private topTraders: Map<string, Trader> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(params?: Partial<OptimizationParams>) {
    this.params = { ...DEFAULT_PARAMS, ...params };
    logger.info('Portfolio Optimizer initialized', { params: this.params });
  }

  // ===========================================
  // Lifecycle
  // ===========================================

  async start(): Promise<void> {
    logger.info('Starting Portfolio Optimizer...');

    // Load top traders for smart money analysis
    await this.loadTopTraders();

    this.isRunning = true;

    // Initial opportunity scan
    await this.scanOpportunities();

    // Periodic updates
    this.updateInterval = setInterval(async () => {
      if (!this.isRunning) return;

      await this.scanOpportunities();
      await this.rebalancePositions();
    }, 60000); // Every minute

    logger.info('Portfolio Optimizer started');
  }

  async stop(): Promise<void> {
    logger.info('Stopping Portfolio Optimizer...');

    this.isRunning = false;

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    logger.info('Portfolio Optimizer stopped');
  }

  // ===========================================
  // Trader Analysis
  // ===========================================

  private async loadTopTraders(): Promise<void> {
    try {
      const traders = await db.getTopTraders(100);

      this.topTraders.clear();
      for (const trader of traders) {
        if (['GOLD', 'PLATINUM', 'DIAMOND'].includes(trader.tier)) {
          this.topTraders.set(trader.address.toLowerCase(), trader);
        }
      }

      logger.info(`Loaded ${this.topTraders.size} top traders for analysis`);
    } catch (error) {
      logger.error('Failed to load top traders', error as Error);
    }
  }

  // ===========================================
  // Opportunity Scanning
  // ===========================================

  async scanOpportunities(): Promise<MarketOpportunity[]> {
    logger.info('Scanning for market opportunities...');

    const opportunities: MarketOpportunity[] = [];
    const adapters = adapterRegistry.getAll();

    for (const adapter of adapters) {
      try {
        const platformOpportunities = await this.scanPlatform(adapter.platform);
        opportunities.push(...platformOpportunities);
      } catch (error) {
        logger.warn(`Failed to scan ${adapter.platform}`, { error });
      }
    }

    // Sort by expected edge * confidence
    opportunities.sort((a, b) =>
      (b.expectedEdge * b.confidence) - (a.expectedEdge * a.confidence)
    );

    this.opportunities = opportunities;

    logger.info(`Found ${opportunities.length} opportunities`);

    return opportunities;
  }

  private async scanPlatform(platform: Platform): Promise<MarketOpportunity[]> {
    const adapter = adapterRegistry.get(platform);
    if (!adapter) return [];

    const opportunities: MarketOpportunity[] = [];

    // Get recent bets from smart money traders
    const recentBets = await adapter.getRecentBets(30, 200);
    const smartMoneyBets = recentBets.filter(
      (bet) => this.topTraders.has(bet.trader.toLowerCase())
    );

    // Group by market
    const marketBets = new Map<string, NormalizedBet[]>();
    for (const bet of smartMoneyBets) {
      const existing = marketBets.get(bet.marketId) || [];
      existing.push(bet);
      marketBets.set(bet.marketId, existing);
    }

    // Analyze each market with smart money activity
    for (const [marketId, bets] of marketBets) {
      const analysis = this.analyzeMarketSignal(bets);

      if (analysis.strength >= 60 && analysis.direction !== 'neutral') {
        const edge = this.estimateEdge(analysis, platform);

        if (edge >= this.params.minEdge) {
          opportunities.push({
            platform,
            marketId,
            direction: analysis.direction as 'bull' | 'bear',
            expectedEdge: edge,
            confidence: analysis.strength,
            smartMoneyDirection: analysis.direction,
            smartMoneyStrength: analysis.strength,
            recommendedSize: this.calculateKellySize(edge, analysis.winProbability),
            riskScore: this.assessRisk(platform, marketId, analysis),
          });
        }
      }
    }

    return opportunities;
  }

  private analyzeMarketSignal(bets: NormalizedBet[]): {
    direction: 'bull' | 'bear' | 'neutral';
    strength: number;
    winProbability: number;
  } {
    if (bets.length === 0) {
      return { direction: 'neutral', strength: 0, winProbability: 0.5 };
    }

    let bullWeight = 0;
    let bearWeight = 0;

    const tierWeights: Record<Tier, number> = {
      DIAMOND: 5,
      PLATINUM: 3,
      GOLD: 2,
      SILVER: 1.5,
      BRONZE: 1,
    };

    for (const bet of bets) {
      const trader = this.topTraders.get(bet.trader.toLowerCase());
      const weight = trader ? tierWeights[trader.tier] : 1;
      const amount = Number(BigInt(bet.amount)) / 1e18;

      if (bet.direction === 'bull') {
        bullWeight += weight * Math.log1p(amount);
      } else {
        bearWeight += weight * Math.log1p(amount);
      }
    }

    const total = bullWeight + bearWeight;
    if (total === 0) {
      return { direction: 'neutral', strength: 0, winProbability: 0.5 };
    }

    const bullPercent = (bullWeight / total) * 100;
    const strength = Math.abs(bullPercent - 50) * 2;

    let direction: 'bull' | 'bear' | 'neutral';
    let winProbability: number;

    if (bullPercent > 60) {
      direction = 'bull';
      winProbability = 0.5 + (strength / 200); // Adjust win prob based on signal
    } else if (bullPercent < 40) {
      direction = 'bear';
      winProbability = 0.5 + (strength / 200);
    } else {
      direction = 'neutral';
      winProbability = 0.5;
    }

    return { direction, strength, winProbability };
  }

  // ===========================================
  // Position Sizing
  // ===========================================

  private calculateKellySize(_edge: number, winProbability: number): number {
    // Kelly Criterion: f = (bp - q) / b
    // where b = decimal odds - 1, p = win probability, q = 1 - p
    // For binary markets with ~2x payout: b = 1

    const b = 1; // Even money odds
    const p = winProbability;
    const q = 1 - p;

    const kelly = (b * p - q) / b;

    // Apply Kelly fraction and clamp
    const fractionalKelly = kelly * this.params.kellyFraction *
      RISK_TOLERANCE_MULTIPLIERS[this.params.riskTolerance];

    return Math.max(
      this.params.minPositionSize,
      Math.min(this.params.maxPositionSize, fractionalKelly)
    );
  }

  private estimateEdge(
    analysis: { direction: string; strength: number; winProbability: number },
    platform: Platform
  ): number {
    // Base edge from signal strength
    let edge = analysis.strength / 20; // Max 5% edge from signal alone

    // Platform-specific adjustments
    const platformEdgeMultipliers: Record<Platform, number> = {
      dreamdex: 0.9, // Lower due to high volume/efficiency
      polymarket: 1.0,
      azuro: 1.1, // Sports may have more inefficiencies
      overtime: 1.1,
      limitless: 1.2, // Newer market, potentially more alpha
      speedmarkets: 0.8, // Fast markets are more efficient
      sxbet: 1.1, // Sports betting
      gnosis: 1.0,
      drift: 1.0,
      kalshi: 0.9, // Regulated, more efficient
      manifold: 1.3, // Play money, less efficient
      metaculus: 1.3, // Prediction-focused
    };

    edge *= platformEdgeMultipliers[platform] || 1.0;

    // Adjust for win probability
    edge *= (analysis.winProbability - 0.5) * 4 + 1;

    return Math.max(0, edge);
  }

  private assessRisk(
    platform: Platform,
    _marketId: string,
    analysis: { direction: string; strength: number }
  ): number {
    let risk = 5; // Base risk

    // Lower signal strength = higher risk
    if (analysis.strength < 70) risk += 1;
    if (analysis.strength < 50) risk += 2;

    // Platform risk factors
    const platformRisk: Record<Platform, number> = {
      dreamdex: 0, // Established
      polymarket: 0, // Well-known
      azuro: 1, // Sports-specific
      overtime: 1,
      limitless: 2, // Newer
      speedmarkets: 1, // Fast-paced
      sxbet: 1, // Sports betting
      gnosis: 1,
      drift: 2, // Solana-based
      kalshi: 0, // Regulated
      manifold: 2, // Play money
      metaculus: 2, // Prediction-focused
    };

    risk += platformRisk[platform] || 0;

    return Math.min(10, Math.max(1, risk));
  }

  // ===========================================
  // Portfolio Optimization
  // ===========================================

  async optimizePortfolio(
    bankrollWei: string
  ): Promise<PortfolioAllocation[]> {
    const bankroll = BigInt(bankrollWei);
    const allocations: PortfolioAllocation[] = [];

    // Filter and sort opportunities
    const validOpportunities = this.opportunities
      .filter((o) => o.expectedEdge >= this.params.minEdge)
      .filter((o) => o.riskScore <= (this.params.riskTolerance === 'conservative' ? 5 : 7))
      .slice(0, this.params.maxOpenPositions);

    // Track platform allocations
    const platformAllocations: Record<Platform, number> = {
      dreamdex: 0,
      polymarket: 0,
      azuro: 0,
      overtime: 0,
      limitless: 0,
      speedmarkets: 0,
      sxbet: 0,
      gnosis: 0,
      drift: 0,
      kalshi: 0,
      manifold: 0,
      metaculus: 0,
    };

    let totalAllocated = 0;

    for (const opportunity of validOpportunities) {
      // Check platform diversification limit
      if (platformAllocations[opportunity.platform] >= this.params.targetPlatformDiversification) {
        continue;
      }

      // Calculate allocation
      let allocation = opportunity.recommendedSize;

      // Apply diversification constraints
      const remainingForPlatform =
        this.params.targetPlatformDiversification - platformAllocations[opportunity.platform];
      allocation = Math.min(allocation, remainingForPlatform);

      // Don't exceed total
      if (totalAllocated + allocation > 0.95) {
        allocation = 0.95 - totalAllocated;
      }

      if (allocation < this.params.minPositionSize) {
        continue;
      }

      const amountWei = (bankroll * BigInt(Math.floor(allocation * 10000))) / BigInt(10000);

      allocations.push({
        platform: opportunity.platform,
        marketId: opportunity.marketId,
        direction: opportunity.direction,
        allocationPercent: allocation * 100,
        amountWei: amountWei.toString(),
        reason: `Edge: ${opportunity.expectedEdge.toFixed(1)}%, Confidence: ${opportunity.confidence.toFixed(0)}%, Risk: ${opportunity.riskScore}/10`,
      });

      platformAllocations[opportunity.platform] += allocation;
      totalAllocated += allocation;

      if (totalAllocated >= 0.95) break;
    }

    logger.info('Portfolio optimized', {
      allocations: allocations.length,
      totalAllocated: (totalAllocated * 100).toFixed(1) + '%',
      platformDiversification: platformAllocations,
    });

    return allocations;
  }

  async rebalancePositions(): Promise<void> {
    // This would check current positions against optimal allocation
    // and suggest rebalancing trades
    logger.info('Checking portfolio balance...');

    const stats = this.getPortfolioStats();

    // Check if any platform is over-allocated
    for (const [platform, allocation] of Object.entries(stats.platformDiversification)) {
      if (allocation > this.params.targetPlatformDiversification * 100) {
        logger.warn(`Platform ${platform} is over-allocated at ${allocation.toFixed(1)}%`);
      }
    }
  }

  // ===========================================
  // Portfolio Stats
  // ===========================================

  getPortfolioStats(): PortfolioStats {
    let totalValue = BigInt(0);
    const platformValues: Record<Platform, bigint> = {
      dreamdex: BigInt(0),
      polymarket: BigInt(0),
      azuro: BigInt(0),
      overtime: BigInt(0),
      limitless: BigInt(0),
      speedmarkets: BigInt(0),
      sxbet: BigInt(0),
      gnosis: BigInt(0),
      drift: BigInt(0),
      kalshi: BigInt(0),
      manifold: BigInt(0),
      metaculus: BigInt(0),
    };

    let totalRisk = 0;
    let positionCount = 0;

    for (const position of this.positions.values()) {
      const value = BigInt(position.amount);
      totalValue += value;
      platformValues[position.platform] += value;
      positionCount++;
    }

    // Calculate platform diversification percentages
    const platformDiversification: Record<Platform, number> = {
      dreamdex: 0,
      polymarket: 0,
      azuro: 0,
      overtime: 0,
      limitless: 0,
      speedmarkets: 0,
      sxbet: 0,
      gnosis: 0,
      drift: 0,
      kalshi: 0,
      manifold: 0,
      metaculus: 0,
    };

    if (totalValue > 0) {
      for (const platform of Object.keys(platformValues) as Platform[]) {
        platformDiversification[platform] =
          (Number(platformValues[platform] * BigInt(10000) / totalValue) / 100);
      }
    }

    return {
      totalValueWei: totalValue.toString(),
      positionCount,
      platformDiversification,
      avgRiskScore: positionCount > 0 ? totalRisk / positionCount : 0,
      expectedReturn: this.calculateExpectedReturn(),
      sharpeRatio: this.calculateSharpeRatio(),
      maxDrawdown: this.calculateMaxDrawdown(),
    };
  }

  private calculateExpectedReturn(): number {
    let totalExpectedReturn = 0;

    for (const opportunity of this.opportunities.slice(0, 10)) {
      totalExpectedReturn += opportunity.expectedEdge * opportunity.recommendedSize;
    }

    return totalExpectedReturn;
  }

  private calculateSharpeRatio(): number {
    // Simplified Sharpe calculation
    const expectedReturn = this.calculateExpectedReturn();
    const riskFreeRate = 0.05; // 5% annual
    const volatility = 0.2; // Assumed 20% volatility

    return (expectedReturn - riskFreeRate) / volatility;
  }

  private calculateMaxDrawdown(): number {
    // Would need historical position data to calculate properly
    // For now, return estimated max drawdown based on risk tolerance
    const baseDrawdown = {
      conservative: 10,
      moderate: 20,
      aggressive: 35,
    };

    return baseDrawdown[this.params.riskTolerance];
  }

  // ===========================================
  // Public API
  // ===========================================

  getOpportunities(): MarketOpportunity[] {
    return this.opportunities;
  }

  getTopOpportunities(limit = 10): MarketOpportunity[] {
    return this.opportunities.slice(0, limit);
  }

  getPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  setParams(params: Partial<OptimizationParams>): void {
    this.params = { ...this.params, ...params };
    logger.info('Optimization parameters updated', { params: this.params });
  }

  getParams(): OptimizationParams {
    return { ...this.params };
  }

  async getRecommendation(bankrollWei: string): Promise<{
    allocations: PortfolioAllocation[];
    stats: PortfolioStats;
    summary: string;
  }> {
    const allocations = await this.optimizePortfolio(bankrollWei);
    const stats = this.getPortfolioStats();

    const topPlatform = Object.entries(stats.platformDiversification)
      .sort((a, b) => b[1] - a[1])[0];

    const summary = `Recommended ${allocations.length} positions across ${
      new Set(allocations.map((a) => a.platform)).size
    } platforms. Expected return: ${stats.expectedReturn.toFixed(1)}%. ` +
      `Top platform: ${topPlatform[0]} (${topPlatform[1].toFixed(1)}%). ` +
      `Risk level: ${this.params.riskTolerance}`;

    return { allocations, stats, summary };
  }
}

// ===========================================
// Standalone Execution
// ===========================================

if (import.meta.url === `file://${process.argv[1]}`) {
  const optimizer = new PortfolioOptimizer();

  process.on('SIGINT', async () => {
    await optimizer.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await optimizer.stop();
    process.exit(0);
  });

  optimizer.start().catch((error) => {
    logger.error('Failed to start Portfolio Optimizer', error);
    process.exit(1);
  });
}

export default PortfolioOptimizer;
