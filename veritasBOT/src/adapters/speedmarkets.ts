/**
 * Speed Markets Adapter
 *
 * Handles bet monitoring for Thales Speed Markets.
 * Speed Markets offer fast-paced price predictions (Up/Down) on crypto assets.
 *
 * Key concepts:
 * - Markets: Short-duration price direction bets (5min, 10min, 1hr, etc.)
 * - Positions: UP or DOWN on asset price
 * - Uses sUSD as betting currency
 * - Available on Optimism, Arbitrum, Base
 *
 * API: https://api.thalesmarket.io
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
// Speed Markets API Types
// ===========================================

interface SpeedMarket {
  id: string;
  user: string;
  asset: string;
  strikePrice: string;
  strikePriceFormatted: number;
  finalPrice: string | null;
  finalPriceFormatted: number | null;
  direction: 'up' | 'down';
  buyinAmount: string;
  fee: string;
  safeBoxImpact: string;
  lpFee: string;
  createdAt: number; // Unix timestamp
  maturityDate: number; // Unix timestamp
  isResolved: boolean;
  isUserWinner: boolean | null;
  network: number; // Chain ID
  txHash: string;
}

interface SpeedMarketsResponse {
  speedMarkets: SpeedMarket[];
  total: number;
}

// ===========================================
// Speed Markets Adapter Implementation
// ===========================================

export class SpeedMarketsAdapter implements PlatformAdapter {
  readonly platform = 'speedmarkets' as const;
  readonly name = 'Speed Markets';
  readonly supportsRealtime = false;

  private config: AdapterConfig;
  private pollInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;
  private apiBaseUrl: string;
  private lastSeenMarketIds: Set<string> = new Set();
  private chainId: number;

  constructor(adapterConfig?: Partial<AdapterConfig>) {
    this.config = {
      pollIntervalMs: adapterConfig?.pollIntervalMs ?? 8000,
      maxBetsPerRequest: adapterConfig?.maxBetsPerRequest ?? 100,
      timeoutMs: adapterConfig?.timeoutMs ?? 15000,
      retryAttempts: adapterConfig?.retryAttempts ?? 3,
      retryDelayMs: adapterConfig?.retryDelayMs ?? 2000,
    };

    // Default to Optimism (chain ID 10)
    this.chainId = 10;
    this.apiBaseUrl = 'https://api.thalesmarket.io';
  }

  // ===========================================
  // Lifecycle
  // ===========================================

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      const response = await this.fetchApi<SpeedMarketsResponse>(
        `/speed-markets/networks/${this.chainId}/markets?limit=1`
      );

      if (response !== null) {
        logger.info('Speed Markets adapter connected', { chainId: this.chainId });
        this.isInitialized = true;
      }
    } catch (error) {
      logger.error('Failed to connect to Speed Markets API', error as Error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    this.lastSeenMarketIds.clear();
    this.isInitialized = false;
    logger.info('Speed Markets adapter cleaned up');
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
          logger.warn(`Speed Markets API attempt ${attempt} failed, retrying...`);
          await this.sleep(this.config.retryDelayMs * attempt);
        } else {
          logger.error(
            `Speed Markets API failed after ${attempt} attempts`,
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
    logger.info('Speed Markets: Starting polling-based susomniaription');

    this.pollInterval = setInterval(async () => {
      try {
        const bets = await this.getRecentBets(5);

        for (const bet of bets) {
          if (!this.lastSeenMarketIds.has(bet.id)) {
            callback(bet);
            this.lastSeenMarketIds.add(bet.id);
          }
        }

        // Cleanup old IDs
        if (this.lastSeenMarketIds.size > 1000) {
          const idsArray = Array.from(this.lastSeenMarketIds);
          this.lastSeenMarketIds = new Set(idsArray.slice(-1000));
        }
      } catch (error) {
        logger.error('Speed Markets polling error', error as Error);
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

  private normalizeMarket(market: SpeedMarket): NormalizedBet {
    return {
      id: market.id,
      trader: market.user.toLowerCase(),
      platform: 'speedmarkets',
      marketId: `${market.asset}-${market.maturityDate}`,
      direction: market.direction === 'up' ? 'bull' : 'bear',
      amount: market.buyinAmount,
      timestamp: new Date(market.createdAt * 1000),
      transactionHash: market.txHash,
      raw: market,
    };
  }

  // ===========================================
  // Data Fetching
  // ===========================================

  async getRecentBets(
    minutes: number,
    limit?: number
  ): Promise<NormalizedBet[]> {
    const since = Math.floor((Date.now() - minutes * 60 * 1000) / 1000);

    const response = await this.fetchApi<SpeedMarketsResponse>(
      `/speed-markets/networks/${this.chainId}/markets?minTimestamp=${since}&limit=${limit ?? this.config.maxBetsPerRequest}`
    );

    if (response?.speedMarkets && response.speedMarkets.length > 0) {
      return response.speedMarkets.map((m) => this.normalizeMarket(m));
    }

    // Fallback to database
    const bets = await db.getRecentBets(
      'speedmarkets',
      minutes,
      limit ?? this.config.maxBetsPerRequest
    );

    return bets.map((bet) => ({
      id: bet.id,
      trader: bet.trader.toLowerCase(),
      platform: 'speedmarkets' as const,
      marketId: bet.epoch.toString(),
      direction: bet.isBull ? 'bull' : 'bear',
      amount: bet.amount,
      timestamp: bet.timestamp,
    }));
  }

  async getBetsForMarket(marketId: string): Promise<NormalizedBet[]> {
    // Speed Markets are individual per user, so we can filter by asset
    const [asset] = marketId.split('-');

    const response = await this.fetchApi<SpeedMarketsResponse>(
      `/speed-markets/networks/${this.chainId}/markets?asset=${asset}&limit=${this.config.maxBetsPerRequest}`
    );

    if (response?.speedMarkets) {
      return response.speedMarkets.map((m) => this.normalizeMarket(m));
    }

    return [];
  }

  async getTraderBets(
    trader: string,
    limit?: number
  ): Promise<NormalizedBet[]> {
    const response = await this.fetchApi<SpeedMarketsResponse>(
      `/speed-markets/networks/${this.chainId}/markets?user=${trader.toLowerCase()}&limit=${limit ?? this.config.maxBetsPerRequest}`
    );

    if (response?.speedMarkets) {
      return response.speedMarkets.map((m) => this.normalizeMarket(m));
    }

    // Fallback to database
    const bets = await db.getTraderBets(
      trader,
      'speedmarkets',
      limit ?? this.config.maxBetsPerRequest
    );

    return bets.map((bet) => ({
      id: bet.id,
      trader: bet.trader.toLowerCase(),
      platform: 'speedmarkets' as const,
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
      const response = await this.fetchApi<SpeedMarketsResponse>(
        `/speed-markets/networks/${this.chainId}/markets?id=${marketId}`
      );

      const market = response?.speedMarkets?.[0];

      if (!market) {
        return null;
      }

      if (!market.isResolved) {
        return {
          marketId,
          resolved: false,
          winner: null,
          raw: market,
        };
      }

      // Determine winner based on price movement vs direction
      let winner: 'bull' | 'bear' | null = null;

      if (market.finalPriceFormatted !== null) {
        const priceWentUp = market.finalPriceFormatted > market.strikePriceFormatted;

        if (priceWentUp) {
          winner = 'bull'; // UP bets win
        } else {
          winner = 'bear'; // DOWN bets win
        }
      }

      return {
        marketId,
        resolved: true,
        winner,
        resolvedAt: new Date(market.maturityDate * 1000),
        raw: market,
      };
    } catch (error) {
      logger.error(`Failed to get Speed Markets outcome for ${marketId}`, error as Error);
      return null;
    }
  }

  async isMarketActive(marketId: string): Promise<boolean> {
    try {
      const response = await this.fetchApi<SpeedMarketsResponse>(
        `/speed-markets/networks/${this.chainId}/markets?id=${marketId}`
      );

      const market = response?.speedMarkets?.[0];
      return market ? !market.isResolved : false;
    } catch (error) {
      return false;
    }
  }

  async getActiveMarkets(limit?: number): Promise<string[]> {
    try {
      const response = await this.fetchApi<SpeedMarketsResponse>(
        `/speed-markets/networks/${this.chainId}/markets?resolved=false&limit=${limit ?? 50}`
      );

      return response?.speedMarkets?.map((m) => m.id) ?? [];
    } catch (error) {
      logger.error('Failed to fetch active Speed Markets', error as Error);
      return [];
    }
  }

  // ===========================================
  // Speed Markets-specific Methods
  // ===========================================

  /**
   * Get markets by asset (ETH, BTC, etc.)
   */
  async getMarketsByAsset(
    asset: string,
    limit = 50
  ): Promise<SpeedMarket[]> {
    const response = await this.fetchApi<SpeedMarketsResponse>(
      `/speed-markets/networks/${this.chainId}/markets?asset=${asset.toUpperCase()}&limit=${limit}`
    );

    return response?.speedMarkets ?? [];
  }

  /**
   * Get user's market history
   */
  async getUserHistory(
    user: string,
    limit = 50
  ): Promise<SpeedMarket[]> {
    const response = await this.fetchApi<SpeedMarketsResponse>(
      `/speed-markets/networks/${this.chainId}/markets?user=${user.toLowerCase()}&limit=${limit}`
    );

    return response?.speedMarkets ?? [];
  }

  /**
   * Get user's win rate and stats
   */
  async getUserStats(user: string): Promise<{
    totalTrades: number;
    wins: number;
    losses: number;
    winRate: number;
    totalVolume: bigint;
  }> {
    const markets = await this.getUserHistory(user, 1000);

    const resolved = markets.filter((m) => m.isResolved);
    const wins = resolved.filter((m) => m.isUserWinner === true).length;
    const losses = resolved.length - wins;

    const totalVolume = markets.reduce(
      (sum, m) => sum + BigInt(m.buyinAmount),
      BigInt(0)
    );

    return {
      totalTrades: markets.length,
      wins,
      losses,
      winRate: resolved.length > 0 ? (wins / resolved.length) * 100 : 0,
      totalVolume,
    };
  }

  /**
   * Set the chain to use (Optimism, Arbitrum, Base)
   */
  setChain(chainId: 10 | 42161 | 8453): void {
    this.chainId = chainId;
    logger.info(`Speed Markets adapter switched to chain ${chainId}`);
  }

  /**
   * Get supported assets
   */
  getSupportedAssets(): string[] {
    return ['ETH', 'BTC', 'ARB', 'OP', 'LINK', 'SOL', 'DOGE', 'STT'];
  }
}

// ===========================================
// Export
// ===========================================

export const speedMarketsAdapter = new SpeedMarketsAdapter();
export default SpeedMarketsAdapter;
