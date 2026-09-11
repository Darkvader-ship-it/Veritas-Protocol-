import { ethers } from 'ethers';
import type { ProtocolAdapter, AdapterConfig, Bet, UserStats, EventCallback } from '../types/index.js';
/**
 * Base adapter class with common functionality for EVM-based prediction markets.
 * Protocol-specific adapters should extend this class.
 */
export declare abstract class BaseAdapter implements ProtocolAdapter {
    abstract readonly platformId: string;
    abstract readonly platformName: string;
    abstract readonly chainId: number;
    abstract readonly nativeToken: string;
    protected provider: ethers.JsonRpcProvider | null;
    protected wsProvider: ethers.WebSocketProvider | null;
    protected config: AdapterConfig;
    protected isSubscribed: boolean;
    protected eventCallback: EventCallback | null;
    constructor(config: AdapterConfig);
    initialize(): Promise<void>;
    getCurrentBlock(): Promise<number>;
    /**
     * Default score calculation - can be overridden by subclasses
     */
    calculateScore(stats: UserStats): number;
    /**
     * Get aggregated stats for a user based on their bets
     */
    getUserStats(walletAddress: string): Promise<UserStats>;
    subscribe(callback: EventCallback): Promise<void>;
    unsubscribe(): Promise<void>;
    destroy(): Promise<void>;
    /**
     * Helper to delay execution (for rate limiting)
     */
    protected delay(ms: number): Promise<void>;
    /**
     * Helper to process logs in chunks with rate limiting
     */
    protected processInChunks<T>(fromBlock: number, toBlock: number, chunkSize: number, delayMs: number, processor: (from: number, to: number) => Promise<T[]>): Promise<T[]>;
    abstract getBetsForUser(walletAddress: string, fromBlock?: number): Promise<Bet[]>;
    abstract backfill(fromBlock: number, toBlock: number, onBet: (bet: Bet) => Promise<void>): Promise<void>;
}
//# sourceMappingURL=BaseAdapter.d.ts.map