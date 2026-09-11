import { ScoringEngine } from './ScoringEngine.js';
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
export class ReputationSDK {
    adapters = [];
    storage;
    scoringEngine;
    refreshInterval;
    isInitialized = false;
    constructor(options) {
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
    async initialize() {
        console.log('[ReputationSDK] Initializing...');
        await Promise.all(this.adapters.map(async (adapter) => {
            try {
                await adapter.initialize();
                console.log(`[ReputationSDK] ${adapter.platformName} initialized`);
            }
            catch (error) {
                console.error(`[ReputationSDK] Failed to initialize ${adapter.platformName}:`, error);
            }
        }));
        this.isInitialized = true;
        console.log(`[ReputationSDK] Ready with ${this.adapters.length} adapter(s)`);
    }
    /**
     * Get TruthScore for a wallet address
     */
    async getTruthScore(walletAddress) {
        if (!this.isInitialized) {
            throw new Error('SDK not initialized. Call initialize() first.');
        }
        const platformStats = [];
        // Gather stats from all adapters
        await Promise.all(this.adapters.map(async (adapter) => {
            try {
                const stats = await adapter.getUserStats(walletAddress);
                platformStats.push(stats);
            }
            catch (error) {
                console.error(`[ReputationSDK] Error getting stats from ${adapter.platformName}:`, error);
            }
        }));
        // Calculate unified TruthScore
        const truthScore = this.scoringEngine.calculateTruthScore(walletAddress, platformStats);
        // Update breakdown with actual platform names
        truthScore.breakdown = truthScore.breakdown.map((b) => {
            const adapter = this.adapters.find((a) => a.platformId === b.platformId);
            return {
                ...b,
                platformName: adapter?.platformName || b.platformId,
            };
        });
        // Save to storage if available
        if (this.storage) {
            await this.storage.saveTruthScore(truthScore);
        }
        return truthScore;
    }
    /**
     * Get all bets for a wallet across all platforms
     */
    async getAllBets(walletAddress) {
        if (!this.isInitialized) {
            throw new Error('SDK not initialized');
        }
        const allBets = [];
        await Promise.all(this.adapters.map(async (adapter) => {
            try {
                const bets = await adapter.getBetsForUser(walletAddress);
                allBets.push(...bets);
            }
            catch (error) {
                console.error(`[ReputationSDK] Error getting bets from ${adapter.platformName}:`, error);
            }
        }));
        // Sort by timestamp descending
        return allBets.sort((a, b) => b.timestamp - a.timestamp);
    }
    /**
     * Get platform-specific stats
     */
    async getPlatformStats(walletAddress, platformId) {
        const adapter = this.adapters.find((a) => a.platformId === platformId);
        if (!adapter)
            return null;
        return adapter.getUserStats(walletAddress);
    }
    /**
     * Backfill historical data for all adapters
     */
    async backfillAll(blocksPerPlatform, onProgress) {
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
            }
            catch (error) {
                console.error(`[ReputationSDK] Backfill error for ${adapter.platformName}:`, error);
            }
        }
    }
    /**
     * Subscribe to real-time events from all adapters
     */
    async subscribeAll(callback) {
        for (const adapter of this.adapters) {
            try {
                await adapter.subscribe(async (event) => {
                    // Save to storage if available
                    if (this.storage && event.type === 'bet') {
                        await this.storage.saveBet(event.bet);
                    }
                    await callback(event);
                });
            }
            catch (error) {
                console.error(`[ReputationSDK] Subscribe error for ${adapter.platformName}:`, error);
            }
        }
    }
    /**
     * Unsubscribe from all adapters
     */
    async unsubscribeAll() {
        await Promise.all(this.adapters.map((a) => a.unsubscribe()));
    }
    /**
     * Get list of supported platforms
     */
    getPlatforms() {
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
    async getLeaderboard(limit = 100, offset = 0) {
        if (!this.storage) {
            throw new Error('Storage provider required for leaderboard');
        }
        return this.storage.getLeaderboard(limit, offset);
    }
    /**
     * Clean up resources
     */
    async destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        await Promise.all(this.adapters.map((a) => a.destroy()));
        console.log('[ReputationSDK] Destroyed');
    }
}
//# sourceMappingURL=ReputationSDK.js.map