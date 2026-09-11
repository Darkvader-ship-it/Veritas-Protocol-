/**
 * Platform Adapter Registry
 *
 * Central registry for managing platform adapters.
 * Handles registration, initialization, and unified access to all adapters.
 */

import { logger } from '../core/logger.js';
import type { Platform } from '../types/index.js';
import type {
  PlatformAdapter,
  AdapterRegistry,
  NormalizedBet,
  MarketOutcome,
} from './types.js';

// ===========================================
// Adapter Registry Implementation
// ===========================================

class AdapterRegistryImpl implements AdapterRegistry {
  private adapters: Map<Platform, PlatformAdapter> = new Map();
  private initialized = false;

  /**
   * Register a platform adapter.
   * Must be called before initializeAll().
   */
  register(adapter: PlatformAdapter): void {
    if (this.initialized) {
      throw new Error('Cannot register adapters after initialization');
    }

    if (this.adapters.has(adapter.platform)) {
      logger.warn(`Overwriting existing adapter for ${adapter.platform}`);
    }

    this.adapters.set(adapter.platform, adapter);
    logger.info(`Registered adapter: ${adapter.name} (${adapter.platform})`);
  }

  /**
   * Get adapter for a specific platform.
   */
  get(platform: Platform): PlatformAdapter | undefined {
    return this.adapters.get(platform);
  }

  /**
   * Get all registered adapters.
   */
  getAll(): PlatformAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Check if a platform has a registered adapter.
   */
  isSupported(platform: Platform): boolean {
    return this.adapters.has(platform);
  }

  /**
   * Get list of supported platforms.
   */
  getSupportedPlatforms(): Platform[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Initialize all registered adapters.
   */
  async initializeAll(): Promise<void> {
    if (this.initialized) {
      logger.warn('Adapters already initialized');
      return;
    }

    logger.info(`Initializing ${this.adapters.size} adapters...`);

    const results = await Promise.allSettled(
      this.getAll().map(async (adapter) => {
        try {
          await adapter.initialize();
          logger.info(`Initialized: ${adapter.name}`);
        } catch (error) {
          logger.error(`Failed to initialize ${adapter.name}`, error as Error);
          throw error;
        }
      })
    );

    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length > 0) {
      logger.warn(`${failed.length} adapters failed to initialize`);
    }

    this.initialized = true;
    logger.info('Adapter initialization complete');
  }

  /**
   * Cleanup all adapters.
   */
  async cleanupAll(): Promise<void> {
    logger.info('Cleaning up adapters...');

    await Promise.allSettled(
      this.getAll().map(async (adapter) => {
        try {
          await adapter.cleanup();
          logger.info(`Cleaned up: ${adapter.name}`);
        } catch (error) {
          logger.error(`Failed to cleanup ${adapter.name}`, error as Error);
        }
      })
    );

    this.initialized = false;
    logger.info('Adapter cleanup complete');
  }

  // ===========================================
  // Unified Methods (across all adapters)
  // ===========================================

  /**
   * Susomniaribe to bets from all platforms.
   * Returns a single unsusomniaribe function.
   */
  async susomniaribeAll(
    callback: (bet: NormalizedBet) => void
  ): Promise<() => void> {
    const unsusomniaribers: (() => void)[] = [];

    for (const adapter of this.getAll()) {
      try {
        const unsub = await adapter.susomniaribe(callback);
        unsusomniaribers.push(unsub);
        logger.info(`Susomniaribed to ${adapter.name}`);
      } catch (error) {
        logger.error(`Failed to susomniaribe to ${adapter.name}`, error as Error);
      }
    }

    return () => {
      for (const unsub of unsusomniaribers) {
        try {
          unsub();
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    };
  }

  /**
   * Get recent bets from all platforms.
   */
  async getRecentBetsAll(minutes: number): Promise<NormalizedBet[]> {
    const allBets: NormalizedBet[] = [];

    const results = await Promise.allSettled(
      this.getAll().map((adapter) => adapter.getRecentBets(minutes))
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allBets.push(...result.value);
      }
    }

    // Sort by timestamp (newest first)
    return allBets.sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }

  /**
   * Get trader bets across all platforms.
   */
  async getTraderBetsAll(
    trader: string,
    limit?: number
  ): Promise<NormalizedBet[]> {
    const allBets: NormalizedBet[] = [];

    const results = await Promise.allSettled(
      this.getAll().map((adapter) => adapter.getTraderBets(trader, limit))
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allBets.push(...result.value);
      }
    }

    return allBets.sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }

  /**
   * Get market outcome from the appropriate adapter.
   */
  async getMarketOutcome(
    platform: Platform,
    marketId: string
  ): Promise<MarketOutcome | null> {
    const adapter = this.get(platform);
    if (!adapter) {
      logger.warn(`No adapter for platform: ${platform}`);
      return null;
    }

    return adapter.getMarketOutcome(marketId);
  }
}

// ===========================================
// Singleton Export
// ===========================================

export const adapterRegistry = new AdapterRegistryImpl();
