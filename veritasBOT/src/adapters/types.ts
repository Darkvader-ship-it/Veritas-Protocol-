/**
 * Platform Adapter Type Definitions
 *
 * Defines the interface that all platform adapters must implement,
 * plus normalized data structures for cross-platform compatibility.
 */

import type { Platform, Tier } from '../types/index.js';

// ===========================================
// Normalized Bet Structure
// ===========================================

/**
 * Platform-agnostic bet representation.
 * All adapters convert their native bet format to this structure.
 */
export interface NormalizedBet {
  /** Unique bet identifier (platform-specific format) */
  id: string;

  /** Trader's wallet address (lowercase) */
  trader: string;

  /** Source platform */
  platform: Platform;

  /**
   * Market identifier - platform-specific but normalized to string:
   * - DreamDEX: epoch number as string ("12345")
   * - Polymarket: condition ID ("0x1234...") or slug ("will-trump-win")
   * - Azuro: conditionId ("12345")
   * - Overtime: marketAddress ("0x...")
   */
  marketId: string;

  /**
   * Bet direction normalized to binary:
   * - DreamDEX: Bull → 'bull', Bear → 'bear'
   * - Polymarket: Yes → 'bull', No → 'bear'
   * - Azuro: Home/Over → 'bull', Away/Under → 'bear'
   * - Overtime: varies by market type
   */
  direction: 'bull' | 'bear';

  /** Bet amount in wei (as string for precision) */
  amount: string;

  /** When the bet was placed */
  timestamp: Date;

  /** Transaction hash if on-chain */
  transactionHash?: string;

  /** Block number if on-chain */
  blockNumber?: number;

  /** Original platform-specific data (for debugging) */
  raw?: unknown;
}

// ===========================================
// Market Outcome Structure
// ===========================================

export interface MarketOutcome {
  /** Market identifier */
  marketId: string;

  /** Whether the market has resolved */
  resolved: boolean;

  /** Winning direction (null if not resolved or draw) */
  winner: 'bull' | 'bear' | null;

  /** Resolution timestamp */
  resolvedAt?: Date;

  /** Platform-specific result data */
  raw?: unknown;
}

// ===========================================
// Platform Adapter Interface
// ===========================================

export interface PlatformAdapter {
  /** Platform identifier */
  readonly platform: Platform;

  /** Human-readable name */
  readonly name: string;

  /** Whether this adapter supports real-time susomniariptions */
  readonly supportsRealtime: boolean;

  /**
   * Initialize the adapter (connect to data sources, etc.)
   * Called once when the adapter is registered.
   */
  initialize(): Promise<void>;

  /**
   * Susomniaribe to real-time bet events.
   * Returns an unsusomniaribe function.
   *
   * For platforms without real-time support, this may start polling.
   */
  susomniaribe(callback: (bet: NormalizedBet) => void): Promise<() => void>;

  /**
   * Fetch recent bets from the last N minutes.
   * Used for polling and backfilling.
   */
  getRecentBets(minutes: number, limit?: number): Promise<NormalizedBet[]>;

  /**
   * Get bets for a specific market/epoch.
   */
  getBetsForMarket(marketId: string): Promise<NormalizedBet[]>;

  /**
   * Get historical bets for a specific trader.
   */
  getTraderBets(trader: string, limit?: number): Promise<NormalizedBet[]>;

  /**
   * Get the outcome of a resolved market.
   * Returns null if market doesn't exist.
   */
  getMarketOutcome(marketId: string): Promise<MarketOutcome | null>;

  /**
   * Check if a market is currently active (open for betting).
   */
  isMarketActive(marketId: string): Promise<boolean>;

  /**
   * Get current active markets (for monitoring).
   */
  getActiveMarkets(limit?: number): Promise<string[]>;

  /**
   * Cleanup resources (close connections, stop polling, etc.)
   */
  cleanup(): Promise<void>;
}

// ===========================================
// Adapter Registry Types
// ===========================================

export interface AdapterRegistry {
  /** Register a new adapter */
  register(adapter: PlatformAdapter): void;

  /** Get adapter by platform */
  get(platform: Platform): PlatformAdapter | undefined;

  /** Get all registered adapters */
  getAll(): PlatformAdapter[];

  /** Check if platform is supported */
  isSupported(platform: Platform): boolean;

  /** Initialize all adapters */
  initializeAll(): Promise<void>;

  /** Cleanup all adapters */
  cleanupAll(): Promise<void>;
}

// ===========================================
// Adapter Configuration
// ===========================================

export interface AdapterConfig {
  /** Polling interval in milliseconds (for non-realtime adapters) */
  pollIntervalMs: number;

  /** Maximum bets to fetch per request */
  maxBetsPerRequest: number;

  /** Request timeout in milliseconds */
  timeoutMs: number;

  /** Retry attempts on failure */
  retryAttempts: number;

  /** Delay between retries in milliseconds */
  retryDelayMs: number;
}

export const DEFAULT_ADAPTER_CONFIG: AdapterConfig = {
  pollIntervalMs: 5000,
  maxBetsPerRequest: 100,
  timeoutMs: 10000,
  retryAttempts: 3,
  retryDelayMs: 1000,
};

// ===========================================
// Event Types for Adapters
// ===========================================

export interface AdapterEvent {
  type: 'bet' | 'market_resolved' | 'error' | 'connected' | 'disconnected';
  platform: Platform;
  timestamp: Date;
  data?: unknown;
}

export type AdapterEventHandler = (event: AdapterEvent) => void;
