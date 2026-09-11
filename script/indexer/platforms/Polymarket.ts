import { createPublicClient, http, parseAbiItem, Address } from 'viem';
import { polygon } from 'viem/chains';
import { PlatformAdapter, PlatformConfig, IndexerResult, PlatformUserStats } from './types';

/**
 * Polymarket Adapter
 * Note: Polymarket uses CLOB (Central Limit Order Book) on Polygon
 * This adapter uses their CTFEXCHANGE contract for order fills
 */
export class PolymarketAdapter implements PlatformAdapter {
  name = 'Polymarket';
  config: PlatformConfig;
  private client;

  // Polymarket CTF Exchange on Polygon
  private readonly CTF_EXCHANGE = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E' as Address;

  // Order filled event - when trades happen on the CLOB
  private readonly ORDER_FILLED_ABI = parseAbiItem(
    'event OrderFilled(bytes32 indexed orderHash, address indexed maker, address indexed taker, uint256 makerAssetId, uint256 takerAssetId, uint256 makerAmountFilled, uint256 takerAmountFilled, uint256 fee)'
  );

  constructor(config?: Partial<PlatformConfig>) {
    this.config = {
      name: 'Polymarket',
      chain: 'polygon',
      rpcUrl: config?.rpcUrl || 'https://polygon-rpc.com',
      contractAddress: this.CTF_EXCHANGE,
      apiEndpoint: 'https://clob.polymarket.com',
      enabled: config?.enabled ?? true,
      batchSize: config?.batchSize || 2000n,
      delayMs: config?.delayMs || 150,
      startBlock: config?.startBlock || 35000000n, // CTF Exchange deployment
    };

    this.client = createPublicClient({
      chain: polygon,
      transport: http(this.config.rpcUrl),
    });
  }

  async isAvailable(): Promise<boolean> {
    if (!this.config.enabled) return false;

    try {
      const blockNumber = await this.client.getBlockNumber();
      return blockNumber > 0n;
    } catch (error) {
      console.error('[Polymarket] RPC connection failed:', error);
      return false;
    }
  }

  async indexUsers(fromBlock: bigint, toBlock: bigint): Promise<IndexerResult> {
    console.log(`\n📊 [Polymarket] Indexing from block ${fromBlock} to ${toBlock}...`);

    const userMap = new Map<Address, PlatformUserStats>();
    const allTrades: any[] = [];
    const errors: string[] = [];

    try {
      // Fetch order filled events in batches
      for (let start = fromBlock; start <= toBlock; start += this.config.batchSize) {
        const end = start + this.config.batchSize - 1n > toBlock ? toBlock : start + this.config.batchSize - 1n;

        try {
          const trades = await this.client.getLogs({
            address: this.config.contractAddress,
            event: this.ORDER_FILLED_ABI,
            fromBlock: start,
            toBlock: end,
          });
          allTrades.push(...trades);

          console.log(`  ✓ Batch ${start}-${end}: Trades ${trades.length}`);

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, this.config.delayMs));

        } catch (error) {
          const errMsg = `Error fetching batch ${start}-${end}: ${error}`;
          console.error(`  ✗ ${errMsg}`);
          errors.push(errMsg);
        }
      }

      // Process trades - both makers and takers are participants
      for (const trade of allTrades) {
        const { maker, taker, makerAmountFilled, takerAmountFilled } = trade.args;

        if (maker && makerAmountFilled) {
          this.updateUserStats(userMap, maker, makerAmountFilled);
        }

        if (taker && takerAmountFilled) {
          this.updateUserStats(userMap, taker, takerAmountFilled);
        }
      }

      // For Polymarket, we estimate wins based on trade frequency
      // Active traders likely have better performance
      for (const [address, stats] of userMap) {
        // Rough estimate: assume 55% win rate for active traders (above 50% random)
        stats.wins = Math.floor(stats.totalBets * 0.55);
        stats.losses = stats.totalBets - stats.wins;
        stats.winRate = stats.totalBets > 0 ? (stats.wins / stats.totalBets) * 100 : 0;
        stats.platformScore = this.calculatePlatformScore(stats);
      }

      console.log(`✅ [Polymarket] Indexed ${userMap.size} users, ${allTrades.length} trades`);

      return {
        platform: this.name,
        chain: this.config.chain,
        userStats: userMap,
        totalBetsIndexed: allTrades.length,
        totalClaimsIndexed: 0,
        blockRange: { from: fromBlock, to: toBlock },
        indexedAt: Date.now(),
        errors,
      };

    } catch (error) {
      console.error(`❌ [Polymarket] Fatal error:`, error);
      return {
        platform: this.name,
        chain: this.config.chain,
        userStats: userMap,
        totalBetsIndexed: allTrades.length,
        totalClaimsIndexed: 0,
        blockRange: { from: fromBlock, to: toBlock },
        indexedAt: Date.now(),
        errors: [...errors, `Fatal error: ${error}`],
      };
    }
  }

  async getUserStats(address: Address): Promise<PlatformUserStats | null> {
    return null;
  }

  private updateUserStats(
    userMap: Map<Address, PlatformUserStats>,
    address: Address,
    amount: bigint
  ) {
    let stats = userMap.get(address);

    if (!stats) {
      stats = {
        address,
        platform: this.name,
        totalBets: 0,
        totalVolume: 0n,
        wins: 0,
        losses: 0,
        winRate: 0,
        platformScore: 0,
      };
      userMap.set(address, stats);
    }

    stats.totalBets++;
    stats.totalVolume += amount;
  }

  private calculatePlatformScore(stats: PlatformUserStats): number {
    const winRate = stats.totalBets > 0 ? (stats.wins / stats.totalBets) : 0;
    const volumeInUSDC = Number(stats.totalVolume) / 1e6; // USDC has 6 decimals

    const score = Math.floor(
      (winRate * 1000) +
      (stats.totalBets * 2) +
      (volumeInUSDC / 100) // Adjusted for USDC vs ETH
    );

    return Math.max(0, Math.min(10000, score));
  }
}
