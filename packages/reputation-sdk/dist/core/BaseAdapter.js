import { ethers } from 'ethers';
/**
 * Base adapter class with common functionality for EVM-based prediction markets.
 * Protocol-specific adapters should extend this class.
 */
export class BaseAdapter {
    provider = null;
    wsProvider = null;
    config;
    isSubscribed = false;
    eventCallback = null;
    constructor(config) {
        this.config = config;
    }
    async initialize() {
        this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
        // Verify connection
        const network = await this.provider.getNetwork();
        if (Number(network.chainId) !== this.chainId) {
            throw new Error(`Chain ID mismatch: expected ${this.chainId}, got ${network.chainId}`);
        }
        console.log(`[${this.platformName}] Initialized on chain ${this.chainId}`);
    }
    async getCurrentBlock() {
        if (!this.provider) {
            throw new Error('Adapter not initialized');
        }
        return this.provider.getBlockNumber();
    }
    /**
     * Default score calculation - can be overridden by subclasses
     */
    calculateScore(stats) {
        const { wins, totalBets, winRate, volume } = stats;
        // Base points from wins
        const winPoints = wins * 100;
        // Bonus for win rate above 55%
        const winRateBonus = winRate > 55 ? (winRate - 55) * 10 : 0;
        // Volume bonus (capped at 500)
        const volumeNative = Number(volume) / 1e18;
        const volumeBonus = Math.min(500, Math.floor(volumeNative * 10));
        // Consistency bonus for active traders
        const consistencyBonus = totalBets >= 50 ? 200 : totalBets >= 20 ? 100 : 0;
        return Math.floor(winPoints + winRateBonus + volumeBonus + consistencyBonus);
    }
    /**
     * Get aggregated stats for a user based on their bets
     */
    async getUserStats(walletAddress) {
        const bets = await this.getBetsForUser(walletAddress);
        const totalBets = bets.length;
        const resolvedBets = bets.filter((b) => b.won !== null && b.won !== undefined);
        const wins = resolvedBets.filter((b) => b.won === true).length;
        const losses = resolvedBets.filter((b) => b.won === false).length;
        const pending = totalBets - resolvedBets.length;
        const winRate = resolvedBets.length > 0 ? (wins / resolvedBets.length) * 100 : 0;
        const volume = bets
            .reduce((sum, b) => sum + BigInt(b.amount || '0'), 0n)
            .toString();
        const stats = {
            userId: walletAddress.toLowerCase(),
            platformId: this.platformId,
            totalBets,
            wins,
            losses,
            pending,
            winRate: Math.round(winRate * 100) / 100,
            volume,
            score: 0,
            firstBetAt: bets.length > 0 ? Math.min(...bets.map((b) => b.timestamp)) : undefined,
            lastBetAt: bets.length > 0 ? Math.max(...bets.map((b) => b.timestamp)) : undefined,
        };
        stats.score = this.calculateScore(stats);
        return stats;
    }
    async subscribe(callback) {
        if (!this.config.wsUrl) {
            throw new Error('WebSocket URL required for real-time subscriptions');
        }
        this.eventCallback = callback;
        this.isSubscribed = true;
        // Subclasses should implement WebSocket subscription logic
        console.log(`[${this.platformName}] Subscribed to real-time events`);
    }
    async unsubscribe() {
        this.isSubscribed = false;
        this.eventCallback = null;
        if (this.wsProvider) {
            await this.wsProvider.destroy();
            this.wsProvider = null;
        }
        console.log(`[${this.platformName}] Unsubscribed from events`);
    }
    async destroy() {
        await this.unsubscribe();
        this.provider = null;
        console.log(`[${this.platformName}] Adapter destroyed`);
    }
    /**
     * Helper to delay execution (for rate limiting)
     */
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    /**
     * Helper to process logs in chunks with rate limiting
     */
    async processInChunks(fromBlock, toBlock, chunkSize, delayMs, processor) {
        const results = [];
        const totalChunks = Math.ceil((toBlock - fromBlock) / chunkSize);
        let processedChunks = 0;
        for (let start = fromBlock; start <= toBlock; start += chunkSize) {
            const end = Math.min(start + chunkSize - 1, toBlock);
            processedChunks++;
            try {
                const chunkResults = await processor(start, end);
                results.push(...chunkResults);
                const progress = ((processedChunks / totalChunks) * 100).toFixed(1);
                console.log(`[${this.platformName}] Progress: ${progress}% | Blocks: ${start}-${end} | Found: ${chunkResults.length}`);
            }
            catch (error) {
                console.error(`[${this.platformName}] Error at blocks ${start}-${end}:`, error);
                // Wait longer on error before retrying
                await this.delay(delayMs * 10);
            }
            await this.delay(delayMs);
        }
        return results;
    }
}
//# sourceMappingURL=BaseAdapter.js.map