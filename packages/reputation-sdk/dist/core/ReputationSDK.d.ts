import type { ReputationSDKOptions, TruthScore, UserStats, Bet, AdapterEvent } from '../types/index.js';
/**
 * TruthBounty Reputation SDK
 *
 * A decentralized reputation system for prediction markets.
 * Index any protocol, get unified TruthScore.
 *
 * @example
 * ```typescript
 * import { ReputationSDK, createPancakeSwapAdapter } from '@truthbounty/reputation-sdk';
 *
 * const sdk = new ReputationSDK({
 *   adapters: [
 *     createPancakeSwapAdapter('https://bsc-dataseed.binance.org'),
 *   ],
 * });
 *
 * await sdk.initialize();
 * const score = await sdk.getTruthScore('0x...');
 * console.log(score);
 * ```
 */
export declare class ReputationSDK {
    private adapters;
    private storage?;
    private scoringEngine;
    private refreshInterval?;
    private isInitialized;
    constructor(options: ReputationSDKOptions);
    /**
     * Initialize all adapters
     */
    initialize(): Promise<void>;
    /**
     * Get TruthScore for a wallet address
     */
    getTruthScore(walletAddress: string): Promise<TruthScore>;
    /**
     * Get all bets for a wallet across all platforms
     */
    getAllBets(walletAddress: string): Promise<Bet[]>;
    /**
     * Get platform-specific stats
     */
    getPlatformStats(walletAddress: string, platformId: string): Promise<UserStats | null>;
    /**
     * Backfill historical data for all adapters
     */
    backfillAll(blocksPerPlatform: number, onProgress?: (platform: string, progress: number) => void): Promise<void>;
    /**
     * Subscribe to real-time events from all adapters
     */
    subscribeAll(callback: (event: AdapterEvent) => void | Promise<void>): Promise<void>;
    /**
     * Unsubscribe from all adapters
     */
    unsubscribeAll(): Promise<void>;
    /**
     * Get list of supported platforms
     */
    getPlatforms(): {
        id: string;
        name: string;
        chainId: number;
        token: string;
    }[];
    /**
     * Get leaderboard (requires storage)
     */
    getLeaderboard(limit?: number, offset?: number): Promise<TruthScore[]>;
    /**
     * Clean up resources
     */
    destroy(): Promise<void>;
}
//# sourceMappingURL=ReputationSDK.d.ts.map