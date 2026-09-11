/**
 * Polymarket Adapter
 *
 * Handles bet monitoring and data fetching for Polymarket prediction markets.
 * Uses REST API polling since Polymarket doesn't expose real-time trade feeds.
 *
 * Key differences from DreamDEX:
 * - Markets last days/weeks (not 5-minute rounds)
 * - Markets identified by condition ID or slug
 * - Yes/No positions (normalized to bull/bear)
 * - REST API polling (no WebSocket for trades)
 */

import { db } from '../core/database.js';
import { config } from '../core/config.js';
import { logger } from '../core/logger.js';
import type {
  PlatformAdapter,
  NormalizedBet,
  MarketOutcome,
  AdapterConfig,
} from './types.js';

// ===========================================
// Polymarket API Types
// ===========================================

interface PolymarketMarket {
  id: string;
  condition_id: string;
  question: string;
  slug: string;
  end_date_iso: string;
  active: boolean;
  closed: boolean;
  resolved: boolean;
  resolution: string | null; // "Yes" | "No" | null
  tokens: Array<{
    token_id: string;
    outcome: string; // "Yes" | "No"
    price: number;
  }>;
  volume: string;
  liquidity: string;
}

interface PolymarketTrade {
  id: string;
  market: string; // condition_id
  maker: string;
  taker: string;
  side: 'BUY' | 'SELL';
  outcome: 'Yes' | 'No';
  size: string; // USDC amount
  price: string;
  timestamp: string;
  transaction_hash: string;
}

interface PolymarketPosition {
  market: string;
  user: string;
  outcome: 'Yes' | 'No';
  size: string;
  entry_price: string;
  current_value: string;
}

// ===========================================
// Polymarket Adapter Implementation
// ===========================================

export class PolymarketAdapter implements PlatformAdapter {
  readonly platform = 'polymarket' as const;
  readonly name = 'Polymarket';
  readonly supportsRealtime = false; // No WebSocket for trades

  private config: AdapterConfig;
  private pollInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;
  private apiBaseUrl: string;
  private lastSeenTradeIds: Set<string> = new Set();

  constructor(adapterConfig?: Partial<AdapterConfig>) {
    this.config = {
      pollIntervalMs: adapterConfig?.pollIntervalMs ?? 10000, // Slower for API rate limits
      maxBetsPerRequest: adapterConfig?.maxBetsPerRequest ?? 100,
      timeoutMs: adapterConfig?.timeoutMs ?? 15000,
      retryAttempts: adapterConfig?.retryAttempts ?? 3,
      retryDelayMs: adapterConfig?.retryDelayMs ?? 2000,
    };
    this.apiBaseUrl = config.externalApis.polymarketUrl;
  }

  // ===========================================
  // Lifecycle
  // ===========================================

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Test API connectivity
    try {
      const response = await this.fetchApi('/markets?limit=1');
      if (response) {
        logger.info('Polymarket adapter connected');
        this.isInitialized = true;
      }
    } catch (error) {
      logger.error('Failed to connect to Polymarket API', error as Error);
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
    logger.info('Polymarket adapter cleaned up');
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
          logger.warn(
            `Polymarket API attempt ${attempt} failed, retrying...`,
            { endpoint }
          );
          await this.sleep(this.config.retryDelayMs * attempt);
        } else {
          logger.error(
            `Polymarket API failed after ${attempt} attempts`,
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
  // Susomniaription (Polling-based)
  // ===========================================

  async susomniaribe(
    callback: (bet: NormalizedBet) => void
  ): Promise<() => void> {
    logger.info('Polymarket: Starting polling-based susomniaription');

    this.pollInterval = setInterval(async () => {
      try {
        // Fetch recent trades from database (indexed from Polymarket)
        const bets = await this.getRecentBets(5);

        for (const bet of bets) {
          if (!this.lastSeenTradeIds.has(bet.id)) {
            callback(bet);
            this.lastSeenTradeIds.add(bet.id);
          }
        }

        // Cleanup old IDs (keep last 1000)
        if (this.lastSeenTradeIds.size > 1000) {
          const idsArray = Array.from(this.lastSeenTradeIds);
          this.lastSeenTradeIds = new Set(idsArray.slice(-1000));
        }
      } catch (error) {
        logger.error('Polymarket polling error', error as Error);
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

  private normalizeApiTrade(trade: PolymarketTrade): NormalizedBet {
    // In Polymarket:
    // - BUY Yes = bullish (betting it will happen)
    // - BUY No = bearish (betting it won't happen)
    // - SELL Yes = bearish
    // - SELL No = bullish

    let direction: 'bull' | 'bear';
    if (trade.side === 'BUY') {
      direction = trade.outcome === 'Yes' ? 'bull' : 'bear';
    } else {
      direction = trade.outcome === 'Yes' ? 'bear' : 'bull';
    }

    return {
      id: trade.id,
      trader: trade.taker.toLowerCase(), // Taker is the active trader
      platform: 'polymarket',
      marketId: trade.market,
      direction,
      amount: this.usdcToWei(trade.size), // Convert USDC to wei-like format
      timestamp: new Date(trade.timestamp),
      transactionHash: trade.transaction_hash,
      raw: trade,
    };
  }

  private normalizeDatabaseBet(row: {
    id: string;
    wallet_address: string;
    market_id: string;
    outcome: string;
    amount: string;
    timestamp: string;
    tx_hash?: string;
  }): NormalizedBet {
    return {
      id: row.id,
      trader: row.wallet_address.toLowerCase(),
      platform: 'polymarket',
      marketId: row.market_id,
      direction: row.outcome === 'Yes' ? 'bull' : 'bear',
      amount: row.amount,
      timestamp: new Date(row.timestamp),
      transactionHash: row.tx_hash,
      raw: row,
    };
  }

  // ===========================================
  // Data Fetching
  // ===========================================

  async getRecentBets(
    minutes: number,
    limit?: number
  ): Promise<NormalizedBet[]> {
    // Fetch from our indexed database
    const bets = await db.getRecentBets(
      'polymarket',
      minutes,
      limit ?? this.config.maxBetsPerRequest
    );

    return bets.map((bet) => ({
      id: bet.id,
      trader: bet.trader.toLowerCase(),
      platform: 'polymarket' as const,
      marketId: bet.epoch.toString(), // epoch is market_id for polymarket
      direction: bet.isBull ? 'bull' : 'bear',
      amount: bet.amount,
      timestamp: bet.timestamp,
      transactionHash: bet.transactionHash,
    }));
  }

  async getBetsForMarket(marketId: string): Promise<NormalizedBet[]> {
    // Try fetching from API first
    const trades = await this.fetchApi<PolymarketTrade[]>(
      `/trades?market=${marketId}&limit=${this.config.maxBetsPerRequest}`
    );

    if (trades) {
      return trades.map((t) => this.normalizeApiTrade(t));
    }

    // Fallback to database
    const bets = await db.getBetsForEpoch(
      parseInt(marketId, 10) || 0,
      'polymarket'
    );

    return bets.map((bet) => ({
      id: bet.id,
      trader: bet.trader.toLowerCase(),
      platform: 'polymarket' as const,
      marketId: marketId,
      direction: bet.isBull ? 'bull' : 'bear',
      amount: bet.amount,
      timestamp: bet.timestamp,
    }));
  }

  async getTraderBets(
    trader: string,
    limit?: number
  ): Promise<NormalizedBet[]> {
    const bets = await db.getTraderBets(
      trader,
      'polymarket',
      limit ?? this.config.maxBetsPerRequest
    );

    return bets.map((bet) => ({
      id: bet.id,
      trader: bet.trader.toLowerCase(),
      platform: 'polymarket' as const,
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
      const market = await this.fetchApi<PolymarketMarket>(
        `/markets/${marketId}`
      );

      if (!market) {
        return null;
      }

      if (!market.resolved) {
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
        winner: market.resolution === 'Yes' ? 'bull' : 'bear',
        resolvedAt: new Date(market.end_date_iso),
        raw: market,
      };
    } catch (error) {
      logger.error(
        `Failed to get Polymarket outcome for ${marketId}`,
        error as Error
      );
      return null;
    }
  }

  async isMarketActive(marketId: string): Promise<boolean> {
    try {
      const market = await this.fetchApi<PolymarketMarket>(
        `/markets/${marketId}`
      );
      return market?.active === true && !market.closed && !market.resolved;
    } catch (error) {
      return false;
    }
  }

  async getActiveMarkets(limit?: number): Promise<string[]> {
    try {
      const markets = await this.fetchApi<PolymarketMarket[]>(
        `/markets?active=true&limit=${limit ?? 50}`
      );

      return markets?.map((m) => m.condition_id) ?? [];
    } catch (error) {
      logger.error('Failed to fetch active Polymarket markets', error as Error);
      return [];
    }
  }

  // ===========================================
  // Polymarket-specific Methods
  // ===========================================

  /**
   * Get market by slug (e.g., "will-trump-win-2024")
   */
  async getMarketBySlug(slug: string): Promise<PolymarketMarket | null> {
    return this.fetchApi<PolymarketMarket>(`/markets?slug=${slug}`);
  }

  /**
   * Get user's current positions
   */
  async getUserPositions(userAddress: string): Promise<PolymarketPosition[]> {
    const positions = await this.fetchApi<PolymarketPosition[]>(
      `/positions?user=${userAddress}`
    );
    return positions ?? [];
  }

  /**
   * Get trending markets by volume
   */
  async getTrendingMarkets(limit = 20): Promise<PolymarketMarket[]> {
    const markets = await this.fetchApi<PolymarketMarket[]>(
      `/markets?active=true&order=volume&limit=${limit}`
    );
    return markets ?? [];
  }

  // ===========================================
  // Utility Methods
  // ===========================================

  /**
   * Convert USDC amount (6 decimals) to wei-like string (18 decimals)
   * for consistency with other adapters
   */
  private usdcToWei(usdcAmount: string): string {
    const usdc = parseFloat(usdcAmount);
    // USDC has 6 decimals, convert to 18 decimal representation
    return (usdc * 1e12).toString();
  }

  /**
   * Convert wei-like string back to USDC
   */
  private weiToUsdc(weiAmount: string): string {
    const wei = parseFloat(weiAmount);
    return (wei / 1e12).toFixed(6);
  }
}

// ===========================================
// Default Export
// ===========================================

export const polymarketAdapter = new PolymarketAdapter();
export default PolymarketAdapter;
