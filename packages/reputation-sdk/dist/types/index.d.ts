/**
 * TruthBounty Reputation SDK - Core Types
 *
 * These interfaces define the contract that all protocol adapters must implement.
 * This allows for a unified reputation system across multiple prediction markets.
 */
/**
 * Represents a single bet/prediction on any platform
 */
export interface Bet {
    id: string;
    userId: string;
    marketId: string;
    position: 'bull' | 'bear' | 'yes' | 'no' | string;
    amount: string;
    timestamp: number;
    txHash?: string;
    blockNumber?: number;
    won?: boolean | null;
    claimedAmount?: string;
    resolvedAt?: number;
}
/**
 * Aggregated stats for a user on a specific platform
 */
export interface UserStats {
    userId: string;
    platformId: string;
    totalBets: number;
    wins: number;
    losses: number;
    pending: number;
    winRate: number;
    volume: string;
    volumeUSD?: number;
    score: number;
    lastBetAt?: number;
    firstBetAt?: number;
}
/**
 * Cross-platform aggregated reputation
 */
export interface TruthScore {
    walletAddress: string;
    totalScore: number;
    breakdown: {
        platformId: string;
        platformName: string;
        score: number;
        weight: number;
    }[];
    tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
    rank?: number;
    lastUpdated: number;
}
/**
 * Configuration for an adapter
 */
export interface AdapterConfig {
    rpcUrl: string;
    wsUrl?: string;
    contractAddress?: string;
    apiKey?: string;
    chainId: number;
    startBlock?: number;
}
/**
 * Event emitted when a new bet is detected
 */
export interface BetEvent {
    type: 'bet';
    bet: Bet;
    platform: string;
}
/**
 * Event emitted when a bet is resolved
 */
export interface ResolveEvent {
    type: 'resolve';
    betId: string;
    won: boolean;
    claimedAmount?: string;
    platform: string;
}
export type AdapterEvent = BetEvent | ResolveEvent;
/**
 * Callback for real-time event streaming
 */
export type EventCallback = (event: AdapterEvent) => void | Promise<void>;
/**
 * Interface that all protocol adapters must implement
 */
export interface ProtocolAdapter {
    readonly platformId: string;
    readonly platformName: string;
    readonly chainId: number;
    readonly nativeToken: string;
    /**
     * Initialize the adapter (connect to RPC, etc.)
     */
    initialize(): Promise<void>;
    /**
     * Get historical bets for a wallet address
     */
    getBetsForUser(walletAddress: string, fromBlock?: number): Promise<Bet[]>;
    /**
     * Get aggregated stats for a user
     */
    getUserStats(walletAddress: string): Promise<UserStats>;
    /**
     * Backfill historical data from a specific block range
     */
    backfill(fromBlock: number, toBlock: number, onBet: (bet: Bet) => Promise<void>): Promise<void>;
    /**
     * Start real-time event streaming
     */
    subscribe(callback: EventCallback): Promise<void>;
    /**
     * Stop real-time event streaming
     */
    unsubscribe(): Promise<void>;
    /**
     * Calculate platform-specific score for a user's stats
     */
    calculateScore(stats: UserStats): number;
    /**
     * Get current block number
     */
    getCurrentBlock(): Promise<number>;
    /**
     * Clean up resources
     */
    destroy(): Promise<void>;
}
/**
 * Storage interface for persisting reputation data
 */
export interface StorageProvider {
    saveBet(bet: Bet): Promise<void>;
    getBet(id: string): Promise<Bet | null>;
    getBetsForUser(userId: string, platformId?: string): Promise<Bet[]>;
    saveUserStats(stats: UserStats): Promise<void>;
    getUserStats(userId: string, platformId: string): Promise<UserStats | null>;
    getAllUserStats(userId: string): Promise<UserStats[]>;
    saveTruthScore(score: TruthScore): Promise<void>;
    getTruthScore(walletAddress: string): Promise<TruthScore | null>;
    getLeaderboard(limit?: number, offset?: number): Promise<TruthScore[]>;
}
/**
 * Options for the main ReputationSDK
 */
export interface ReputationSDKOptions {
    storage?: StorageProvider;
    adapters: ProtocolAdapter[];
    autoRefreshInterval?: number;
}
//# sourceMappingURL=index.d.ts.map