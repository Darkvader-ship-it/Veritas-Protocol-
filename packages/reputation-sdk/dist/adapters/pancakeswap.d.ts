import { BaseAdapter } from '../core/BaseAdapter.js';
import type { Bet, AdapterConfig, EventCallback } from '../types/index.js';
export interface PancakeSwapConfig extends AdapterConfig {
    contractAddress?: string;
}
export declare class PancakeSwapAdapter extends BaseAdapter {
    readonly platformId = "pancakeswap-prediction";
    readonly platformName = "PancakeSwap Prediction";
    readonly chainId = 56;
    readonly nativeToken = "BNB";
    private contractAddress;
    private betCache;
    constructor(config: PancakeSwapConfig);
    /**
     * Parse a bet event log into a Bet object
     */
    private parseBetLog;
    /**
     * Parse a claim event log
     */
    private parseClaimLog;
    getBetsForUser(walletAddress: string, fromBlock?: number): Promise<Bet[]>;
    backfill(fromBlock: number, toBlock: number, onBet: (bet: Bet) => Promise<void>): Promise<void>;
    subscribe(callback: EventCallback): Promise<void>;
}
export declare function createPancakeSwapAdapter(rpcUrl: string, wsUrl?: string): PancakeSwapAdapter;
//# sourceMappingURL=pancakeswap.d.ts.map