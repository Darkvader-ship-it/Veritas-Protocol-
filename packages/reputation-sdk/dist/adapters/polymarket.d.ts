import { BaseAdapter } from '../core/BaseAdapter.js';
import type { Bet, AdapterConfig, EventCallback } from '../types/index.js';
export interface PolymarketConfig extends AdapterConfig {
    apiKey?: string;
}
export declare class PolymarketAdapter extends BaseAdapter {
    readonly platformId = "polymarket";
    readonly platformName = "Polymarket";
    readonly chainId = 137;
    readonly nativeToken = "MATIC";
    private apiKey?;
    constructor(config: PolymarketConfig);
    /**
     * Fetch user positions from Polymarket API
     */
    private fetchUserPositions;
    /**
     * Fetch user trade history from Polymarket API
     */
    private fetchUserTrades;
    /**
     * Fetch market details
     */
    private fetchMarket;
    getBetsForUser(walletAddress: string, fromBlock?: number): Promise<Bet[]>;
    /**
     * Fallback: Get bets from on-chain events
     */
    private getOnChainBets;
    backfill(fromBlock: number, toBlock: number, onBet: (bet: Bet) => Promise<void>): Promise<void>;
    /**
     * Calculate score with Polymarket-specific adjustments
     */
    calculateScore(stats: import('../types/index.js').UserStats): number;
    subscribe(callback: EventCallback): Promise<void>;
}
export declare function createPolymarketAdapter(rpcUrl: string, wsUrl?: string, apiKey?: string): PolymarketAdapter;
//# sourceMappingURL=polymarket.d.ts.map