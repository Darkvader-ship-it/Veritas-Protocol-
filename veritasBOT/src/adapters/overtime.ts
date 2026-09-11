/**
 * Overtime Markets Adapter
 *
 * Handles bet monitoring and data fetching for Overtime Markets.
 * Overtime is a sports betting protocol on Optimism using Thales infrastructure.
 *
 * Key concepts:
 * - Markets: Individual betting markets for games
 * - Positions: 0 = Home, 1 = Away, 2 = Draw (for 3-way markets)
 * - Uses sUSD as the betting currency
 *
 * API: https://api.thalesmarket.io
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
// Overtime API Types
// ===========================================

interface OvertimeMarket {
  address: string;
  gameId: string;
  sport: string;
  leagueId: number;
  leagueName: string;
  homeTeam: string;
  awayTeam: string;
  maturityDate: number; // Unix timestamp
  tags: number[];
  isOpen: boolean;
  isResolved: boolean;
  isCanceled: boolean;
  finalResult: number; // 0 = home, 1 = away, 2 = draw
  homeOdds: number;
  awayOdds: number;
  drawOdds: number | null;
  homeScore: number | null;
  awayScore: number | null;
  isPaused: boolean;
}

interface OvertimeTrade {
  id: string;
  timestamp: number;
  account: string;
  market: string;
  position: number; // 0 = home, 1 = away, 2 = draw
  amount: string; // sUSD amount
  paid: string;
  txHash: string;
  blockNumber: number;
  gameId: string;
}

interface OvertimePosition {
  market: string;
  account: string;
  position: number;
  amount: string;
  paid: string;
  claimable: boolean;
}

// ===========================================
// Overtime Adapter Implementation
// ===========================================

export class OvertimeAdapter implements PlatformAdapter {
  readonly platform = 'overtime' as const;
  readonly name = 'Overtime Markets';
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

    // Get API URL from platform config
    const platformConfig = config.platforms['overtime'];
    this.apiBaseUrl = platformConfig?.apiUrl || 'https://api.thalesmarket.io';
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
      const markets = await this.fetchApi<OvertimeMarket[]>(
        '/overtime/networks/10/markets?type=open&limit=1'
      );

      if (markets !== null) {
        logger.info('Overtime adapter connected');
        this.isInitialized = true;
      }
    } catch (error) {
      logger.error('Failed to connect to Overtime API', error as Error);
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
    logger.info('Overtime adapter cleaned up');
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
            `Overtime API attempt ${attempt} failed, retrying...`,
            { endpoint }
          );
          await this.sleep(this.config.retryDelayMs * attempt);
        } else {
          logger.error(
            `Overtime API failed after ${attempt} attempts`,
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
    logger.info('Overtime: Starting polling-based susomniaription');

    this.pollInterval = setInterval(async () => {
      try {
        const bets = await this.getRecentBets(5);

        for (const bet of bets) {
          if (!this.lastSeenTradeIds.has(bet.id)) {
            callback(bet);
            this.lastSeenTradeIds.add(bet.id);
          }
        }

        // Cleanup old IDs
        if (this.lastSeenTradeIds.size > 1000) {
          const idsArray = Array.from(this.lastSeenTradeIds);
          this.lastSeenTradeIds = new Set(idsArray.slice(-1000));
        }
      } catch (error) {
        logger.error('Overtime polling error', error as Error);
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

  private normalizeTrade(trade: OvertimeTrade): NormalizedBet {
    // Position 0 = Home (favorite usually) = bull
    // Position 1 = Away (underdog usually) = bear
    // Position 2 = Draw (ignored for signal calculation)
    const direction = trade.position === 0 ? 'bull' : 'bear';

    return {
      id: trade.id || `${trade.txHash}-${trade.position}`,
      trader: trade.account.toLowerCase(),
      platform: 'overtime',
      marketId: trade.market,
      direction,
      amount: this.susdToWei(trade.amount),
      timestamp: new Date(trade.timestamp * 1000),
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
    // First try the API for recent trades
    const since = Math.floor((Date.now() - minutes * 60 * 1000) / 1000);

    const trades = await this.fetchApi<OvertimeTrade[]>(
      `/overtime/networks/10/trades?minTimestamp=${since}&limit=${limit ?? this.config.maxBetsPerRequest}`
    );

    if (trades && trades.length > 0) {
      return trades.map((t) => this.normalizeTrade(t));
    }

    // Fallback to database
    const bets = await db.getRecentBets(
      'overtime',
      minutes,
      limit ?? this.config.maxBetsPerRequest
    );

    return bets.map((bet) => ({
      id: bet.id,
      trader: bet.trader.toLowerCase(),
      platform: 'overtime' as const,
      marketId: bet.epoch.toString(),
      direction: bet.isBull ? 'bull' : 'bear',
      amount: bet.amount,
      timestamp: bet.timestamp,
      transactionHash: bet.transactionHash,
    }));
  }

  async getBetsForMarket(marketId: string): Promise<NormalizedBet[]> {
    const trades = await this.fetchApi<OvertimeTrade[]>(
      `/overtime/networks/10/trades?market=${marketId}&limit=${this.config.maxBetsPerRequest}`
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
    const trades = await this.fetchApi<OvertimeTrade[]>(
      `/overtime/networks/10/trades?account=${trader.toLowerCase()}&limit=${limit ?? this.config.maxBetsPerRequest}`
    );

    if (trades) {
      return trades.map((t) => this.normalizeTrade(t));
    }

    // Fallback to database
    const bets = await db.getTraderBets(
      trader,
      'overtime',
      limit ?? this.config.maxBetsPerRequest
    );

    return bets.map((bet) => ({
      id: bet.id,
      trader: bet.trader.toLowerCase(),
      platform: 'overtime' as const,
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
      const market = await this.fetchApi<OvertimeMarket>(
        `/overtime/networks/10/markets/${marketId}`
      );

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

      // finalResult: 0 = home wins (bull), 1 = away wins (bear), 2 = draw
      let winner: 'bull' | 'bear' | null = null;
      if (market.finalResult === 0) {
        winner = 'bull';
      } else if (market.finalResult === 1) {
        winner = 'bear';
      }
      // Draw (2) remains null

      return {
        marketId,
        resolved: true,
        winner,
        resolvedAt: new Date(market.maturityDate * 1000),
        raw: market,
      };
    } catch (error) {
      logger.error(
        `Failed to get Overtime outcome for ${marketId}`,
        error as Error
      );
      return null;
    }
  }

  async isMarketActive(marketId: string): Promise<boolean> {
    try {
      const market = await this.fetchApi<OvertimeMarket>(
        `/overtime/networks/10/markets/${marketId}`
      );

      return market?.isOpen === true && !market.isPaused && !market.isResolved;
    } catch (error) {
      return false;
    }
  }

  async getActiveMarkets(limit?: number): Promise<string[]> {
    try {
      const markets = await this.fetchApi<OvertimeMarket[]>(
        `/overtime/networks/10/markets?type=open&limit=${limit ?? 50}`
      );

      return markets?.map((m) => m.address) ?? [];
    } catch (error) {
      logger.error('Failed to fetch active Overtime markets', error as Error);
      return [];
    }
  }

  // ===========================================
  // Overtime-specific Methods
  // ===========================================

  /**
   * Get markets by sport
   */
  async getMarketsBySport(
    sport: string,
    limit = 20
  ): Promise<OvertimeMarket[]> {
    const markets = await this.fetchApi<OvertimeMarket[]>(
      `/overtime/networks/10/markets?type=open&sport=${sport}&limit=${limit}`
    );

    return markets ?? [];
  }

  /**
   * Get live (in-progress) markets
   */
  async getLiveMarkets(limit = 20): Promise<OvertimeMarket[]> {
    const markets = await this.fetchApi<OvertimeMarket[]>(
      `/overtime/networks/10/markets?type=live&limit=${limit}`
    );

    return markets ?? [];
  }

  /**
   * Get user's positions
   */
  async getUserPositions(account: string): Promise<OvertimePosition[]> {
    const positions = await this.fetchApi<OvertimePosition[]>(
      `/overtime/networks/10/positions?account=${account.toLowerCase()}`
    );

    return positions ?? [];
  }

  /**
   * Get market details including odds
   */
  async getMarketDetails(marketId: string): Promise<OvertimeMarket | null> {
    return this.fetchApi<OvertimeMarket>(
      `/overtime/networks/10/markets/${marketId}`
    );
  }

  // ===========================================
  // Utility Methods
  // ===========================================

  /**
   * Convert sUSD amount to wei-like string (18 decimals)
   */
  private susdToWei(susdAmount: string): string {
    // sUSD already has 18 decimals on Optimism
    return susdAmount;
  }

  /**
   * Get sport name from tag
   */
  getSportFromTag(tag: number): string {
    const sportMap: Record<number, string> = {
      9001: 'Soccer',
      9002: 'Football',
      9003: 'Basketball',
      9004: 'Baseball',
      9005: 'Hockey',
      9006: 'MMA',
      9007: 'Tennis',
      9008: 'eSports',
      9010: 'Golf',
      9011: 'Motorsport',
      9012: 'Cricket',
    };
    return sportMap[tag] || 'Unknown';
  }
}

// ===========================================
// Default Export
// ===========================================

export const overtimeAdapter = new OvertimeAdapter();
export default OvertimeAdapter;
