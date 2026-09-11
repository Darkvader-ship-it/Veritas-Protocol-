import { createPublicClient, http, parseAbiItem, Address } from 'viem';
import { polygon, gnosis } from 'viem/chains';
import { PlatformAdapter, PlatformConfig, IndexerResult, PlatformUserStats } from './types';

/**
 * Azuro Protocol Adapter
 * Decentralized sports betting and prediction markets
 * Deployed on Polygon and Gnosis Chain
 */
export class AzuroAdapter implements PlatformAdapter {
  name = 'Azuro Protocol';
  config: PlatformConfig;
  private client;

  // Azuro LP (Liquidity Pool) contract on Polygon
  private readonly AZURO_LP_POLYGON = '0x7043E4e1c4045424858ECBCED80989FeAfC11B36' as Address;

  // Azuro Core contract
  private readonly AZURO_CORE = '0x4fE6A9e47db94a9b2a4FfF3A0D850632fF2e1F8d' as Address;

  private readonly NEW_BET_ABI = parseAbiItem(
    'event NewBet(address indexed owner, uint256 indexed betId, uint256 indexed conditionId, uint64 outcomeId, uint128 amount, uint256 odds, uint256 createdAt)'
  );

  private readonly BET_SETTLED_ABI = parseAbiItem(
    'event BetSettled(uint256 indexed betId, address indexed owner, uint256 amount)'
  );

  constructor(config?: Partial<PlatformConfig>) {
    this.config = {
      name: 'Azuro Protocol',
      chain: 'polygon',
      rpcUrl: config?.rpcUrl || 'https://polygon-rpc.com',
      contractAddress: this.AZURO_CORE,
      enabled: config?.enabled ?? true,
      batchSize: config?.batchSize || 2000n,
      delayMs: config?.delayMs || 150,
      startBlock: config?.startBlock || 40000000n, // Azuro deployment on Polygon
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
      console.error('[Azuro] RPC connection failed:', error);
      return false;
    }
  }

  async indexUsers(fromBlock: bigint, toBlock: bigint): Promise<IndexerResult> {
    console.log(`\n📊 [Azuro] Indexing from block ${fromBlock} to ${toBlock}...`);

    const userMap = new Map<Address, PlatformUserStats>();
    const allBets: any[] = [];
    const allSettlements: any[] = [];
    const errors: string[] = [];

    try {
      // Fetch events in batches
      for (let start = fromBlock; start <= toBlock; start += this.config.batchSize) {
        const end = start + this.config.batchSize - 1n > toBlock ? toBlock : start + this.config.batchSize - 1n;

        try {
          // Fetch NewBet events
          const bets = await this.client.getLogs({
            address: this.config.contractAddress,
            event: this.NEW_BET_ABI,
            fromBlock: start,
            toBlock: end,
          });
          allBets.push(...bets);

          // Fetch BetSettled events (indicates wins)
          const settlements = await this.client.getLogs({
            address: this.config.contractAddress,
            event: this.BET_SETTLED_ABI,
            fromBlock: start,
            toBlock: end,
          });
          allSettlements.push(...settlements);

          console.log(`  ✓ Batch ${start}-${end}: Bets ${bets.length}, Settlements ${settlements.length}`);

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, this.config.delayMs));

        } catch (error) {
          const errMsg = `Error fetching batch ${start}-${end}: ${error}`;
          console.error(`  ✗ ${errMsg}`);
          errors.push(errMsg);
        }
      }

      // Process bet events
      const betIdToUser = new Map<bigint, Address>();

      for (const bet of allBets) {
        const { owner, betId, amount } = bet.args;
        if (!owner || !amount) continue;

        betIdToUser.set(betId, owner);
        this.updateUserStats(userMap, owner, amount, false);
      }

      // Process settlements (wins)
      for (const settlement of allSettlements) {
        const { betId, owner, amount } = settlement.args;
        if (!owner || betId === undefined) continue;

        const user = userMap.get(owner);
        if (user && amount > 0n) {
          // Non-zero payout means win
          user.wins++;
        }
      }

      // Calculate final stats
      for (const [address, stats] of userMap) {
        stats.losses = stats.totalBets - stats.wins;
        stats.winRate = stats.totalBets > 0 ? (stats.wins / stats.totalBets) * 100 : 0;
        stats.platformScore = this.calculatePlatformScore(stats);
      }

      console.log(`✅ [Azuro] Indexed ${userMap.size} users, ${allBets.length} bets, ${allSettlements.length} settlements`);

      return {
        platform: this.name,
        chain: this.config.chain,
        userStats: userMap,
        totalBetsIndexed: allBets.length,
        totalClaimsIndexed: allSettlements.length,
        blockRange: { from: fromBlock, to: toBlock },
        indexedAt: Date.now(),
        errors,
      };

    } catch (error) {
      console.error(`❌ [Azuro] Fatal error:`, error);
      return {
        platform: this.name,
        chain: this.config.chain,
        userStats: userMap,
        totalBetsIndexed: allBets.length,
        totalClaimsIndexed: allSettlements.length,
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
    amount: bigint,
    isWin: boolean
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
    if (isWin) stats.wins++;
  }

  private calculatePlatformScore(stats: PlatformUserStats): number {
    const winRate = stats.totalBets > 0 ? (stats.wins / stats.totalBets) : 0;
    const volumeInMATIC = Number(stats.totalVolume) / 1e18;

    const score = Math.floor(
      (winRate * 1000) +
      (stats.totalBets * 2) +
      (volumeInMATIC / 10)
    );

    return Math.max(0, Math.min(10000, score));
  }
}
