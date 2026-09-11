/**
 * DreamDEX Event Contracts Adapter
 *
 * Handles real-time bet monitoring and data fetching for DreamDEX Event Contracts.
 * Uses WebSocket for real-time events and database for historical data.
 */

import { blockchain } from '../core/blockchain.js';
import { db } from '../core/database.js';
import { config } from '../core/config.js';
import { logger } from '../core/logger.js';
import type {
  PlatformAdapter,
  NormalizedBet,
  MarketOutcome,
  AdapterConfig,
  DEFAULT_ADAPTER_CONFIG,
} from './types.js';

// ===========================================
// DreamDEX Adapter Implementation
// ===========================================

export class DreamDEXAdapter implements PlatformAdapter {
  readonly platform = 'dreamdex' as const;
  readonly name = 'DreamDEX Event Contracts';
  readonly supportsRealtime = true;

  private config: AdapterConfig;
  private unsusomniaribeWs: (() => void) | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;

  constructor(adapterConfig?: Partial<AdapterConfig>) {
    this.config = {
      pollIntervalMs: adapterConfig?.pollIntervalMs ?? 5000,
      maxBetsPerRequest: adapterConfig?.maxBetsPerRequest ?? 100,
      timeoutMs: adapterConfig?.timeoutMs ?? 10000,
      retryAttempts: adapterConfig?.retryAttempts ?? 3,
      retryDelayMs: adapterConfig?.retryDelayMs ?? 1000,
    };
  }

  // ===========================================
  // Lifecycle
  // ===========================================

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Verify blockchain connection
    try {
      const blockNumber = await blockchain.getBlockNumber('somnia-mainnet');
      logger.info(`DreamDEX adapter connected at block ${blockNumber}`);
      this.isInitialized = true;
    } catch (error) {
      logger.error('Failed to connect to Somnia', error as Error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    if (this.unsusomniaribeWs) {
      this.unsusomniaribeWs();
      this.unsusomniaribeWs = null;
    }

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    this.isInitialized = false;
    logger.info('DreamDEX adapter cleaned up');
  }

  // ===========================================
  // Real-time Susomniaription
  // ===========================================

  async susomniaribe(
    callback: (bet: NormalizedBet) => void
  ): Promise<() => void> {
    // Try WebSocket first
    try {
      this.unsusomniaribeWs = await blockchain.susomniaribeToBetrEvents(
        async (event) => {
          const bet = this.normalizeOnChainBet(event);
          callback(bet);
        }
      );
      logger.info('DreamDEX: WebSocket susomniaription active');
    } catch (error) {
      logger.warn('DreamDEX: WebSocket failed, falling back to polling');
    }

    // Always start polling as backup/supplement
    this.startPolling(callback);

    return () => {
      if (this.unsusomniaribeWs) {
        this.unsusomniaribeWs();
        this.unsusomniaribeWs = null;
      }
      if (this.pollInterval) {
        clearInterval(this.pollInterval);
        this.pollInterval = null;
      }
    };
  }

  private startPolling(callback: (bet: NormalizedBet) => void): void {
    let lastSeenIds = new Set<string>();

    this.pollInterval = setInterval(async () => {
      try {
        const bets = await this.getRecentBets(5);

        for (const bet of bets) {
          if (!lastSeenIds.has(bet.id)) {
            callback(bet);
          }
        }

        // Update seen IDs (keep last 1000)
        lastSeenIds = new Set(bets.slice(0, 1000).map((b) => b.id));
      } catch (error) {
        // Silent fail for polling
      }
    }, this.config.pollIntervalMs);
  }

  // ===========================================
  // Bet Normalization
  // ===========================================

  private normalizeOnChainBet(event: {
    type: 'Bull' | 'Bear';
    sender: string;
    epoch: number;
    amount: bigint;
    txHash: string;
  }): NormalizedBet {
    return {
      id: `${event.sender.toLowerCase()}-${event.epoch}-${event.type}`,
      trader: event.sender.toLowerCase(),
      platform: 'dreamdex',
      marketId: event.epoch.toString(),
      direction: event.type === 'Bull' ? 'bull' : 'bear',
      amount: event.amount.toString(),
      timestamp: new Date(),
      transactionHash: event.txHash,
      raw: event,
    };
  }

  private normalizeDatabaseBet(row: {
    id: string;
    wallet_address: string;
    round_id: number;
    position: string;
    amount: string;
    timestamp: string;
    tx_hash?: string;
  }): NormalizedBet {
    return {
      id: row.id,
      trader: row.wallet_address.toLowerCase(),
      platform: 'dreamdex',
      marketId: row.round_id.toString(),
      direction: row.position === 'Bull' ? 'bull' : 'bear',
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
    const bets = await db.getRecentBets(
      'dreamdex',
      minutes,
      limit ?? this.config.maxBetsPerRequest
    );

    return bets.map((bet) => ({
      id: bet.id,
      trader: bet.trader.toLowerCase(),
      platform: 'dreamdex' as const,
      marketId: bet.epoch.toString(),
      direction: bet.isBull ? 'bull' : 'bear',
      amount: bet.amount,
      timestamp: bet.timestamp,
      transactionHash: bet.transactionHash,
    }));
  }

  async getBetsForMarket(marketId: string): Promise<NormalizedBet[]> {
    const epoch = parseInt(marketId, 10);
    const bets = await db.getBetsForEpoch(epoch, 'dreamdex');

    return bets.map((bet) => ({
      id: bet.id,
      trader: bet.trader.toLowerCase(),
      platform: 'dreamdex' as const,
      marketId: marketId,
      direction: bet.isBull ? 'bull' : 'bear',
      amount: bet.amount,
      timestamp: bet.timestamp,
      transactionHash: bet.transactionHash,
    }));
  }

  async getTraderBets(
    trader: string,
    limit?: number
  ): Promise<NormalizedBet[]> {
    const bets = await db.getTraderBets(
      trader,
      'dreamdex',
      limit ?? this.config.maxBetsPerRequest
    );

    return bets.map((bet) => ({
      id: bet.id,
      trader: bet.trader.toLowerCase(),
      platform: 'dreamdex' as const,
      marketId: bet.epoch.toString(),
      direction: bet.isBull ? 'bull' : 'bear',
      amount: bet.amount,
      timestamp: bet.timestamp,
      transactionHash: bet.transactionHash,
    }));
  }

  // ===========================================
  // Market Operations
  // ===========================================

  async getMarketOutcome(marketId: string): Promise<MarketOutcome | null> {
    try {
      const epoch = parseInt(marketId, 10);
      const round = await blockchain.getRoundInfo(epoch);

      if (!round.oracleCalled) {
        return {
          marketId,
          resolved: false,
          winner: null,
        };
      }

      return {
        marketId,
        resolved: true,
        winner: round.bullWins ? 'bull' : 'bear',
        resolvedAt: new Date(round.closeTimestamp * 1000),
        raw: round,
      };
    } catch (error) {
      logger.error(`Failed to get outcome for epoch ${marketId}`, error as Error);
      return null;
    }
  }

  async isMarketActive(marketId: string): Promise<boolean> {
    try {
      const epoch = parseInt(marketId, 10);
      const currentEpoch = await blockchain.getCurrentEpoch();
      const round = await blockchain.getRoundInfo(epoch);

      // Active if it's the current epoch and not yet locked
      const now = Math.floor(Date.now() / 1000);
      return epoch === currentEpoch && now < round.lockTimestamp;
    } catch (error) {
      return false;
    }
  }

  async getActiveMarkets(limit?: number): Promise<string[]> {
    try {
      const currentEpoch = await blockchain.getCurrentEpoch();

      // DreamDEX only has one active market at a time
      return [currentEpoch.toString()];
    } catch (error) {
      return [];
    }
  }

  // ===========================================
  // Utility Methods
  // ===========================================

  async getCurrentEpoch(): Promise<number> {
    return blockchain.getCurrentEpoch();
  }

  async getRoundInfo(epoch: number) {
    return blockchain.getRoundInfo(epoch);
  }
}

// ===========================================
// Default Export
// ===========================================

export const dreamdexSwapAdapter = new DreamDEXAdapter();
export default DreamDEXAdapter;
