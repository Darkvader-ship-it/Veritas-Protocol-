import { createPublicClient, http, parseAbiItem, Address } from 'viem';
import { optimism } from 'viem/chains';
import { PlatformAdapter, PlatformConfig, IndexerResult, PlatformUserStats } from './types';

/**
 * Thales Markets Adapter (Optimism)
 * Binary options prediction markets on Optimism
 * Main contract: ThalesAMM for market making
 */
export class ThalesAdapter implements PlatformAdapter {
  name = 'Thales';
  config: PlatformConfig;
  private client;

  // Thales AMM contract on Optimism
  private readonly THALES_AMM = '0x278b5A44397c9D8E52743FeadFa8293F7C114c10' as Address;

  // Thales Market Data contract
  private readonly THALES_MARKET_DATA = '0x8C32beC4E6F5F9df6E62E91064e0Bd7d161cB7A8' as Address;

  private readonly BUY_FROM_AMM_ABI = parseAbiItem(
    'event BuyFromAmm(address buyer, address market, uint8 position, uint256 amount, uint256 sUSDPaid, address susd, address asset)'
  );

  private readonly SELL_TO_AMM_ABI = parseAbiItem(
    'event SellToAmm(address seller, address market, uint8 position, uint256 amount, uint256 sUSDPaid, address susd, address asset)'
  );

  constructor(config?: Partial<PlatformConfig>) {
    this.config = {
      name: 'Thales',
      chain: 'optimism',
      rpcUrl: config?.rpcUrl || 'https://mainnet.optimism.io',
      contractAddress: this.THALES_AMM,
      enabled: config?.enabled ?? true,
      batchSize: config?.batchSize || 2000n,
      delayMs: config?.delayMs || 150,
      startBlock: config?.startBlock || 10000000n, // Thales deployment on Optimism
    };

    this.client = createPublicClient({
      chain: optimism,
      transport: http(this.config.rpcUrl),
    });
  }

  async isAvailable(): Promise<boolean> {
    if (!this.config.enabled) return false;

    try {
      const blockNumber = await this.client.getBlockNumber();
      return blockNumber > 0n;
    } catch (error) {
      console.error('[Thales] RPC connection failed:', error);
      return false;
    }
  }

  async indexUsers(fromBlock: bigint, toBlock: bigint): Promise<IndexerResult> {
    console.log(`\n📊 [Thales] Indexing from block ${fromBlock} to ${toBlock}...`);

    const userMap = new Map<Address, PlatformUserStats>();
    const allBuys: any[] = [];
    const allSells: any[] = [];
    const errors: string[] = [];

    try {
      // Fetch events in batches
      for (let start = fromBlock; start <= toBlock; start += this.config.batchSize) {
        const end = start + this.config.batchSize - 1n > toBlock ? toBlock : start + this.config.batchSize - 1n;

        try {
          // Fetch Buy events
          const buys = await this.client.getLogs({
            address: this.config.contractAddress,
            event: this.BUY_FROM_AMM_ABI,
            fromBlock: start,
            toBlock: end,
          });
          allBuys.push(...buys);

          // Fetch Sell events (which can indicate wins)
          const sells = await this.client.getLogs({
            address: this.config.contractAddress,
            event: this.SELL_TO_AMM_ABI,
            fromBlock: start,
            toBlock: end,
          });
          allSells.push(...sells);

          console.log(`  ✓ Batch ${start}-${end}: Buys ${buys.length}, Sells ${sells.length}`);

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, this.config.delayMs));

        } catch (error) {
          const errMsg = `Error fetching batch ${start}-${end}: ${error}`;
          console.error(`  ✗ ${errMsg}`);
          errors.push(errMsg);
        }
      }

      // Process buy events
      for (const buy of allBuys) {
        const { buyer, market, position, amount, sUSDPaid } = buy.args;
        if (!buyer || !amount) continue;

        this.updateUserStats(userMap, buyer, sUSDPaid || amount);
      }

      // Process sell events (estimate wins)
      const sellsByUser = new Map<Address, number>();
      for (const sell of allSells) {
        const { seller, amount } = sell.args;
        if (!seller || !amount) continue;

        sellsByUser.set(seller, (sellsByUser.get(seller) || 0) + 1);
      }

      // Estimate wins based on sell volume (users who sell likely won)
      for (const [address, sellCount] of sellsByUser) {
        const user = userMap.get(address);
        if (user) {
          // Rough estimate: if user sold, they likely won those positions
          user.wins = Math.min(sellCount, user.totalBets);
        }
      }

      // Calculate final stats
      for (const [address, stats] of userMap) {
        stats.losses = stats.totalBets - stats.wins;
        stats.winRate = stats.totalBets > 0 ? (stats.wins / stats.totalBets) * 100 : 0;
        stats.platformScore = this.calculatePlatformScore(stats);
      }

      console.log(`✅ [Thales] Indexed ${userMap.size} users, ${allBuys.length} buys, ${allSells.length} sells`);

      return {
        platform: this.name,
        chain: this.config.chain,
        userStats: userMap,
        totalBetsIndexed: allBuys.length,
        totalClaimsIndexed: allSells.length,
        blockRange: { from: fromBlock, to: toBlock },
        indexedAt: Date.now(),
        errors,
      };

    } catch (error) {
      console.error(`❌ [Thales] Fatal error:`, error);
      return {
        platform: this.name,
        chain: this.config.chain,
        userStats: userMap,
        totalBetsIndexed: allBuys.length,
        totalClaimsIndexed: allSells.length,
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
    const volumeInETH = Number(stats.totalVolume) / 1e18;

    const score = Math.floor(
      (winRate * 1000) +
      (stats.totalBets * 2) +
      (volumeInETH / 10)
    );

    return Math.max(0, Math.min(10000, score));
  }
}
