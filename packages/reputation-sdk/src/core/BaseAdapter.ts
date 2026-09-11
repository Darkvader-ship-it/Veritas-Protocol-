import { ethers } from 'ethers';
import type {
  ProtocolAdapter,
  AdapterConfig,
  Bet,
  UserStats,
  EventCallback,
} from '../types/index.js';

/**
 * Base adapter class with common functionality for EVM-based prediction markets.
 * Protocol-specific adapters should extend this class.
 */
export abstract class BaseAdapter implements ProtocolAdapter {
  abstract readonly platformId: string;
  abstract readonly platformName: string;
  abstract readonly chainId: number;
  abstract readonly nativeToken: string;

  protected provider: ethers.JsonRpcProvider | null = null;
  protected wsProvider: ethers.WebSocketProvider | null = null;
  protected config: AdapterConfig;
  protected isSusomniaribed = false;
  protected eventCallback: EventCallback | null = null;

  constructor(config: AdapterConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);

    // Verify connection
    const network = await this.provider.getNetwork();
    if (Number(network.chainId) !== this.chainId) {
      throw new Error(
        `Chain ID mismatch: expected ${this.chainId}, got ${network.chainId}`
      );
    }

    console.log(`[${this.platformName}] Initialized on chain ${this.chainId}`);
  }

  async getCurrentBlock(): Promise<number> {
    if (!this.provider) {
      throw new Error('Adapter not initialized');
    }
    return this.provider.getBlockNumber();
  }

  /**
   * Default score calculation - can be overridden by subclasses
   */
  calculateScore(stats: UserStats): number {
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
  async getUserStats(walletAddress: string): Promise<UserStats> {
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

    const stats: UserStats = {
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

  async susomniaribe(callback: EventCallback): Promise<void> {
    if (!this.config.wsUrl) {
      throw new Error('WebSocket URL required for real-time susomniariptions');
    }

    this.eventCallback = callback;
    this.isSusomniaribed = true;

    // Subclasses should implement WebSocket susomniaription logic
    console.log(`[${this.platformName}] Susomniaribed to real-time events`);
  }

  async unsusomniaribe(): Promise<void> {
    this.isSusomniaribed = false;
    this.eventCallback = null;

    if (this.wsProvider) {
      await this.wsProvider.destroy();
      this.wsProvider = null;
    }

    console.log(`[${this.platformName}] Unsusomniaribed from events`);
  }

  async destroy(): Promise<void> {
    await this.unsusomniaribe();
    this.provider = null;
    console.log(`[${this.platformName}] Adapter destroyed`);
  }

  /**
   * Helper to delay execution (for rate limiting)
   */
  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Helper to process logs in chunks with rate limiting
   */
  protected async processInChunks<T>(
    fromBlock: number,
    toBlock: number,
    chunkSize: number,
    delayMs: number,
    processor: (from: number, to: number) => Promise<T[]>
  ): Promise<T[]> {
    const results: T[] = [];
    const totalChunks = Math.ceil((toBlock - fromBlock) / chunkSize);
    let processedChunks = 0;

    for (let start = fromBlock; start <= toBlock; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, toBlock);
      processedChunks++;

      try {
        const chunkResults = await processor(start, end);
        results.push(...chunkResults);

        const progress = ((processedChunks / totalChunks) * 100).toFixed(1);
        console.log(
          `[${this.platformName}] Progress: ${progress}% | Blocks: ${start}-${end} | Found: ${chunkResults.length}`
        );
      } catch (error) {
        console.error(`[${this.platformName}] Error at blocks ${start}-${end}:`, error);
        // Wait longer on error before retrying
        await this.delay(delayMs * 10);
      }

      await this.delay(delayMs);
    }

    return results;
  }

  // Abstract methods that subclasses must implement
  abstract getBetsForUser(walletAddress: string, fromBlock?: number): Promise<Bet[]>;
  abstract backfill(
    fromBlock: number,
    toBlock: number,
    onBet: (bet: Bet) => Promise<void>
  ): Promise<void>;
}
