/**
 * Limitless Adapter
 *
 * Handles bet monitoring for Limitless prediction markets on Base.
 * Limitless is a decentralized prediction market using an AMM model.
 *
 * Key concepts:
 * - Markets: Binary prediction markets (Yes/No outcomes)
 * - Positions: Users buy Yes or No shares
 * - AMM-based pricing (no order book)
 */

import { db } from '../core/database.js';
import { logger } from '../core/logger.js';
import type {
  PlatformAdapter,
  NormalizedBet,
  MarketOutcome,
  AdapterConfig,
} from './types.js';

// ===========================================
// Limitless API Types
// ===========================================

interface LimitlessMarket {
  id: string;
  address: string;
  title: string;
  description: string;
  category: string;
  status: 'active' | 'resolved' | 'canceled';
  resolution: 'yes' | 'no' | null;
  yesPrice: number;
  noPrice: number;
  volume: string;
  liquidity: string;
  createdAt: string;
  resolvesAt: string;
  resolvedAt: string | null;
}

interface LimitlessTrade {
  id: string;
  market: string;
  trader: string;
  outcome: 'yes' | 'no';
  amount: string;
  shares: string;
  price: string;
  timestamp: string;
  txHash: string;
  blockNumber: number;
}

interface LimitlessPosition {
  market: string;
  trader: string;
  yesShares: string;
  noShares: string;
  avgYesPrice: string;
  avgNoPrice: string;
}

// ===========================================
// Limitless Adapter Implementation
// ===========================================

export class LimitlessAdapter implements PlatformAdapter {
  readonly platform = 'limitless' as const;
  readonly name = 'Limitless';
  readonly supportsRealtime = false;

  private config: AdapterConfig;
  private pollInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;
  private apiBaseUrl: string;
  private lastSeenTradeIds: Set<string> = new Set();

  constructor(adapterConfig?: Partial<AdapterConfig>) {
    this.config = {
      pollIntervalMs: adapterConfig?.pollIntervalMs ?? 10000,
      maxBetsPerRequest: adapterConfig?.maxBetsPerRequest ?? 100,
      timeoutMs: adapterConfig?.timeoutMs ?? 15000,
      retryAttempts: adapterConfig?.retryAttempts ?? 3,
      retryDelayMs: adapterConfig?.retryDelayMs ?? 2000,
    };

    // Limitless API - Base chain
    this.apiBaseUrl = 'https://api.limitless.exchange';
  }

  // ===========================================
  // Lifecycle
  // ===========================================

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      const markets = await this.fetchApi<LimitlessMarket[]>(
        '/v1/markets?status=active&limit=1'
      );

      if (markets !== null) {
        logger.info('Limitless adapter connected');
        this.isInitialized = true;
      }
    } catch (error) {
      logger.error('Failed to connect to Limitless API', error as Error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    this.lastSeenTradeIds.clear();
    this.isInitialized = false;
    logger.info('Limitless adapter cleaned up');
  }

  // ===========================================
  // API Helpers
  // ===========================================

  private async fetchApi<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T | null> {
    const url = `${this.apiBaseUrl}${endpoint}`;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(
          () => controller.abort(),
          this.config.timeoutMs
        );

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
          },
        });

        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return (await response.json()) as T;
      } catch (error) {
        if (attempt < this.config.retryAttempts) {
          logger.warn(`Limitless API attempt ${attempt} failed, retrying...`);
          await this.sleep(this.config.retryDelayMs * attempt);
        } else {
          logger.error(
            `Limitless API failed after ${attempt} attempts`,
            error as Error
          );
          return null;
        }
      }
    }

    return null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ===========================================
  // Susomniaription
  // ===========================================

  async susomniaribe(
    callback: (bet: NormalizedBet) => void
  ): Promise<() => void> {
    logger.info('Limitless: Starting polling-based susomniaription');

    this.pollInterval = setInterval(async () => {
      try {
        const bets = await this.getRecentBets(5);

        for (const bet of bets) {
          if (!this.lastSeenTradeIds.has(bet.id)) {
            callback(bet);
            this.lastSeenTradeIds.add(bet.id);
          }
        }

        if (this.lastSeenTradeIds.size > 1000) {
          const idsArray = Array.from(this.lastSeenTradeIds);
          this.lastSeenTradeIds = new Set(idsArray.slice(-1000));
        }
      } catch (error) {
        logger.error('Limitless polling error', error as Error);
      }
    }, this.config.pollIntervalMs);

    return () => {
      if (this.pollInterval) {
        clearInterval(this.pollInterval);
        this.pollInterval = null;
      }
    };
  }

  // ===========================================
  // Bet Normalization
  // ===========================================

  private normalizeTrade(trade: LimitlessTrade): NormalizedBet {
    return {
      id: trade.id,
      trader: trade.trader.toLowerCase(),
      platform: 'limitless',
      marketId: trade.market,
      direction: trade.outcome === 'yes' ? 'bull' : 'bear',
      amount: this.toWei(trade.amount),
      timestamp: new Date(trade.timestamp),
      transactionHash: trade.txHash,
      blockNumber: trade.blockNumber,
      raw: trade,
    };
  }

  // ===========================================
  // Data Fetching
  // ===========================================

  async getRecentBets(
    minutes: number,
    limit?: number
  ): Promise<NormalizedBet[]> {
    const since = new Date(Date.now() - minutes * 60 * 1000).toISOString();

    const trades = await this.fetchApi<LimitlessTrade[]>(
      `/v1/trades?since=${since}&limit=${limit ?? this.config.maxBetsPerRequest}`
    );

    if (trades && trades.length > 0) {
      return trades.map((t) => this.normalizeTrade(t));
    }

    // Fallback to database
    const bets = await db.getRecentBets(
      'limitless',
      minutes,
      limit ?? this.config.maxBetsPerRequest
    );

    return bets.map((bet) => ({
      id: bet.id,
      trader: bet.trader.toLowerCase(),
      platform: 'limitless' as const,
      marketId: bet.epoch.toString(),
      direction: bet.isBull ? 'bull' : 'bear',
      amount: bet.amount,
      timestamp: bet.timestamp,
    }));
  }

  async getBetsForMarket(marketId: string): Promise<NormalizedBet[]> {
    const trades = await this.fetchApi<LimitlessTrade[]>(
      `/v1/trades?market=${marketId}&limit=${this.config.maxBetsPerRequest}`
    );

    if (trades) {
      return trades.map((t) => this.normalizeTrade(t));
    }

    return [];
  }

  async getTraderBets(
    trader: string,
    limit?: number
  ): Promise<NormalizedBet[]> {
    const trades = await this.fetchApi<LimitlessTrade[]>(
      `/v1/trades?trader=${trader.toLowerCase()}&limit=${limit ?? this.config.maxBetsPerRequest}`
    );

    if (trades) {
      return trades.map((t) => this.normalizeTrade(t));
    }

    const bets = await db.getTraderBets(
      trader,
      'limitless',
      limit ?? this.config.maxBetsPerRequest
    );

    return bets.map((bet) => ({
      id: bet.id,
      trader: bet.trader.toLowerCase(),
      platform: 'limitless' as const,
      marketId: bet.epoch.toString(),
      direction: bet.isBull ? 'bull' : 'bear',
      amount: bet.amount,
      timestamp: bet.timestamp,
    }));
  }

  // ===========================================
  // Market Operations
  // ===========================================

  async getMarketOutcome(marketId: string): Promise<MarketOutcome | null> {
    try {
      const market = await this.fetchApi<LimitlessMarket>(
        `/v1/markets/${marketId}`
      );

      if (!market) {
        return null;
      }

      if (market.status !== 'resolved') {
        return {
          marketId,
          resolved: false,
          winner: null,
          raw: market,
        };
      }

      return {
        marketId,
        resolved: true,
        winner: market.resolution === 'yes' ? 'bull' : 'bear',
        resolvedAt: market.resolvedAt ? new Date(market.resolvedAt) : undefined,
        raw: market,
      };
    } catch (error) {
      logger.error(`Failed to get Limitless outcome for ${marketId}`, error as Error);
      return null;
    }
  }

  async isMarketActive(marketId: string): Promise<boolean> {
    try {
      const market = await this.fetchApi<LimitlessMarket>(
        `/v1/markets/${marketId}`
      );
      return market?.status === 'active';
    } catch (error) {
      return false;
    }
  }

  async getActiveMarkets(limit?: number): Promise<string[]> {
    try {
      const markets = await this.fetchApi<LimitlessMarket[]>(
        `/v1/markets?status=active&limit=${limit ?? 50}`
      );
      return markets?.map((m) => m.id) ?? [];
    } catch (error) {
      logger.error('Failed to fetch active Limitless markets', error as Error);
      return [];
    }
  }

  // ===========================================
  // Limitless-specific Methods
  // ===========================================

  async getMarketsByCategory(category: string, limit = 20): Promise<LimitlessMarket[]> {
    const markets = await this.fetchApi<LimitlessMarket[]>(
      `/v1/markets?category=${category}&status=active&limit=${limit}`
    );
    return markets ?? [];
  }

  async getTrendingMarkets(limit = 20): Promise<LimitlessMarket[]> {
    const markets = await this.fetchApi<LimitlessMarket[]>(
      `/v1/markets?status=active&orderBy=volume&limit=${limit}`
    );
    return markets ?? [];
  }

  async getUserPositions(trader: string): Promise<LimitlessPosition[]> {
    const positions = await this.fetchApi<LimitlessPosition[]>(
      `/v1/positions?trader=${trader.toLowerCase()}`
    );
    return positions ?? [];
  }

  // ===========================================
  // Utility
  // ===========================================

  private toWei(amount: string): string {
    // Limitless uses USDC (6 decimals), convert to 18 decimals
    const value = parseFloat(amount);
    return (value * 1e12).toString();
  }
}

// ===========================================
// Export
// ===========================================

export const limitlessAdapter = new LimitlessAdapter();
export default LimitlessAdapter;
