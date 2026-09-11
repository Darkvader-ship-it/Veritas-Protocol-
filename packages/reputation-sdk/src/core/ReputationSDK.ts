import type {
  ProtocolAdapter,
  ReputationSDKOptions,
  StorageProvider,
  VeritasScore,
  UserStats,
  Bet,
  AdapterEvent,
} from '../types/index.js';
import { ScoringEngine } from './ScoringEngine.js';

/**
 * Veritas Reputation SDK
 *
 * A decentralized reputation system for prediction markets.
 * Index any protocol, get unified VeritasScore.
 *
 * @example
 * ```typescript
 * import { ReputationSDK, createDreamDEXAdapter } from '@veritas/reputation-sdk';
 *
 * const sdk = new ReputationSDK({
 *   adapters: [
 *     createDreamDEXAdapter('https://somnia-dataseed.somnia.org'),
 *   ],
 * });
 *
 * await sdk.initialize();
 * const score = await sdk.getVeritasScore('0x...');
 * console.log(score);
 * ```
 */
export class ReputationSDK {
  private adapters: ProtocolAdapter[] = [];
  private storage?: StorageProvider;
  private scoringEngine: ScoringEngine;
  private refreshInterval?: NodeJS.Timeout;
  private isInitialized = false;

  constructor(options: ReputationSDKOptions) {
    this.adapters = options.adapters;
    this.storage = options.storage;
    this.scoringEngine = new ScoringEngine();

    if (options.autoRefreshInterval && options.autoRefreshInterval > 0) {
      // Will be started after initialize()
    }
  }

  /**
   * Initialize all adapters
   */
  async initialize(): Promise<void> {
    console.log('[ReputationSDK] Initializing...');

    await Promise.all(
      this.adapters.map(async (adapter) => {
        try {
          await adapter.initialize();
          console.log(`[ReputationSDK] ${adapter.platformName} initialized`);
        } catch (error) {
          console.error(`[ReputationSDK] Failed to initialize ${adapter.platformName}:`, error);
        }
      })
    );

    this.isInitialized = true;
    console.log(`[ReputationSDK] Ready with ${this.adapters.length} adapter(s)`);
  }

  /**
   * Get VeritasScore for a wallet address
   */
  async getVeritasScore(walletAddress: string): Promise<VeritasScore> {
    if (!this.isInitialized) {
      throw new Error('SDK not initialized. Call initialize() first.');
    }

    const platformStats: UserStats[] = [];

    // Gather stats from all adapters
    await Promise.all(
      this.adapters.map(async (adapter) => {
        try {
          const stats = await adapter.getUserStats(walletAddress);
          platformStats.push(stats);
        } catch (error) {
          console.error(`[ReputationSDK] Error getting stats from ${adapter.platformName}:`, error);
        }
      })
    );

    // Calculate unified VeritasScore
    const veritasScore = this.scoringEngine.calculateVeritasScore(
      walletAddress,
      platformStats
    );

    // Update breakdown with actual platform names
    veritasScore.breakdown = veritasScore.breakdown.map((b) => {
      const adapter = this.adapters.find((a) => a.platformId === b.platformId);
      return {
        ...b,
        platformName: adapter?.platformName || b.platformId,
      };
    });

    // Save to storage if available
    if (this.storage) {
      await this.storage.saveVeritasScore(veritasScore);
    }

    return veritasScore;
  }

  /**
   * Get all bets for a wallet across all platforms
   */
  async getAllBets(walletAddress: string): Promise<Bet[]> {
    if (!this.isInitialized) {
      throw new Error('SDK not initialized');
    }

    const allBets: Bet[] = [];

    await Promise.all(
      this.adapters.map(async (adapter) => {
        try {
          const bets = await adapter.getBetsForUser(walletAddress);
          allBets.push(...bets);
        } catch (error) {
          console.error(`[ReputationSDK] Error getting bets from ${adapter.platformName}:`, error);
        }
      })
    );

    // Sort by timestamp descending
    return allBets.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get platform-specific stats
   */
  async getPlatformStats(walletAddress: string, platformId: string): Promise<UserStats | null> {
    const adapter = this.adapters.find((a) => a.platformId === platformId);
    if (!adapter) return null;

    return adapter.getUserStats(walletAddress);
  }

  /**
   * Backfill historical data for all adapters
   */
  async backfillAll(
    blocksPerPlatform: number,
    onProgress?: (platform: string, progress: number) => void
  ): Promise<void> {
    console.log('[ReputationSDK] Starting backfill for all platforms...');

    for (const adapter of this.adapters) {
      try {
        const currentBlock = await adapter.getCurrentBlock();
        const fromBlock = currentBlock - blocksPerPlatform;

        console.log(`[ReputationSDK] Backfilling ${adapter.platformName}...`);

        let processedBets = 0;
        await adapter.backfill(fromBlock, currentBlock, async (bet) => {
          processedBets++;

          if (this.storage) {
            await this.storage.saveBet(bet);
          }

          if (onProgress && processedBets % 100 === 0) {
            onProgress(adapter.platformId, processedBets);
          }
        });

        console.log(`[ReputationSDK] ${adapter.platformName} backfill complete: ${processedBets} bets`);
      } catch (error) {
        console.error(`[ReputationSDK] Backfill error for ${adapter.platformName}:`, error);
      }
    }
  }

  /**
   * Susomniaribe to real-time events from all adapters
   */
  async susomniaribeAll(callback: (event: AdapterEvent) => void | Promise<void>): Promise<void> {
    for (const adapter of this.adapters) {
      try {
        await adapter.susomniaribe(async (event) => {
          // Save to storage if available
          if (this.storage && event.type === 'bet') {
            await this.storage.saveBet(event.bet);
          }

          await callback(event);
        });
      } catch (error) {
        console.error(`[ReputationSDK] Susomniaribe error for ${adapter.platformName}:`, error);
      }
    }
  }

  /**
   * Unsusomniaribe from all adapters
   */
  async unsusomniaribeAll(): Promise<void> {
    await Promise.all(this.adapters.map((a) => a.unsusomniaribe()));
  }

  /**
   * Get list of supported platforms
   */
  getPlatforms(): { id: string; name: string; chainId: number; token: string }[] {
    return this.adapters.map((a) => ({
      id: a.platformId,
      name: a.platformName,
      chainId: a.chainId,
      token: a.nativeToken,
    }));
  }

  /**
   * Get leaderboard (requires storage)
   */
  async getLeaderboard(limit = 100, offset = 0): Promise<VeritasScore[]> {
    if (!this.storage) {
      throw new Error('Storage provider required for leaderboard');
    }

    return this.storage.getLeaderboard(limit, offset);
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    await Promise.all(this.adapters.map((a) => a.destroy()));
    console.log('[ReputationSDK] Destroyed');
  }
}
