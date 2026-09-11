import { createPublicClient, http, parseAbiItem, Address } from 'viem';
import { somnia } from 'viem/chains';
import { PlatformAdapter, PlatformConfig, IndexerResult, PlatformUserStats, PlatformBet, PlatformClaim } from './types';

const DREAMDEX_PREDICTION_ADDRESS = '0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9' as Address;

const PREDICTION_ABI = [
  parseAbiItem('event BetBull(address indexed sender, uint256 indexed epoch, uint256 amount)'),
  parseAbiItem('event BetBear(address indexed sender, uint256 indexed epoch, uint256 amount)'),
  parseAbiItem('event Claim(address indexed sender, uint256 indexed epoch, uint256 amount)'),
];

export class DreamDEXAdapter implements PlatformAdapter {
  name = 'DreamDEX Event Contracts';
  config: PlatformConfig;
  private client;

  constructor(config?: Partial<PlatformConfig>) {
    this.config = {
      name: 'DreamDEX Event Contracts',
      chain: 'somnia',
      rpcUrl: config?.rpcUrl || 'https://somnia-dataseed1.somnia.org',
      contractAddress: DREAMDEX_PREDICTION_ADDRESS,
      enabled: config?.enabled ?? true,
      batchSize: config?.batchSize || 2000n,
      delayMs: config?.delayMs || 100,
    };

    this.client = createPublicClient({
      chain: somnia,
      transport: http(this.config.rpcUrl),
    });
  }

  async isAvailable(): Promise<boolean> {
    try {
      const blockNumber = await this.client.getBlockNumber();
      return blockNumber > 0n;
    } catch {
      return false;
    }
  }

  async indexUsers(fromBlock: bigint, toBlock: bigint): Promise<IndexerResult> {
    console.log(`\n📊 [DreamDEX] Indexing from block ${fromBlock} to ${toBlock}...`);

    const userMap = new Map<Address, PlatformUserStats>();
    const bets: PlatformBet[] = [];
    const claims: PlatformClaim[] = [];
    const errors: string[] = [];

    try {
      // Fetch events in batches
      for (let start = fromBlock; start <= toBlock; start += this.config.batchSize) {
        const end = start + this.config.batchSize - 1n > toBlock ? toBlock : start + this.config.batchSize - 1n;

        try {
          // Fetch BetBull events
          const bullBets = await this.client.getLogs({
            address: this.config.contractAddress,
            event: PREDICTION_ABI[0],
            fromBlock: start,
            toBlock: end,
          });

          // Fetch BetBear events
          const bearBets = await this.client.getLogs({
            address: this.config.contractAddress,
            event: PREDICTION_ABI[1],
            fromBlock: start,
            toBlock: end,
          });

          // Fetch Claim events
          const claimEvents = await this.client.getLogs({
            address: this.config.contractAddress,
            event: PREDICTION_ABI[2],
            fromBlock: start,
            toBlock: end,
          });

          // Process bull bets
          for (const log of bullBets) {
            const { sender, epoch, amount } = log.args;
            if (!sender || epoch === undefined || !amount) continue;

            bets.push({
              user: sender,
              marketId: epoch.toString(),
              amount,
              position: 'bull',
              timestamp: 0n, // Would need to fetch block timestamp
              blockNumber: log.blockNumber || 0n,
              txHash: log.transactionHash || '',
            });

            this.updateUserStats(userMap, sender, amount, false);
          }

          // Process bear bets
          for (const log of bearBets) {
            const { sender, epoch, amount } = log.args;
            if (!sender || epoch === undefined || !amount) continue;

            bets.push({
              user: sender,
              marketId: epoch.toString(),
              amount,
              position: 'bear',
              timestamp: 0n,
              blockNumber: log.blockNumber || 0n,
              txHash: log.transactionHash || '',
            });

            this.updateUserStats(userMap, sender, amount, false);
          }

          // Process claims (indicates wins)
          for (const log of claimEvents) {
            const { sender, epoch, amount } = log.args;
            if (!sender || epoch === undefined || !amount) continue;

            claims.push({
              user: sender,
              marketId: epoch.toString(),
              amount,
              timestamp: 0n,
              blockNumber: log.blockNumber || 0n,
              txHash: log.transactionHash || '',
            });

            // Find the corresponding bet and mark as win
            const user = userMap.get(sender);
            if (user) {
              user.wins++;
            }
          }

          console.log(`  ✓ Batch ${start}-${end}: Bulls ${bullBets.length}, Bears ${bearBets.length}, Claims ${claimEvents.length}`);

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, this.config.delayMs));

        } catch (error) {
          const errMsg = `Error fetching batch ${start}-${end}: ${error}`;
          console.error(`  ✗ ${errMsg}`);
          errors.push(errMsg);
        }
      }

      // Calculate final stats
      for (const [address, stats] of userMap) {
        stats.losses = stats.totalBets - stats.wins;
        stats.winRate = stats.totalBets > 0 ? (stats.wins / stats.totalBets) * 100 : 0;
        stats.platformScore = this.calculatePlatformScore(stats);
      }

      console.log(`✅ [DreamDEX] Indexed ${userMap.size} users, ${bets.length} bets, ${claims.length} claims`);

      return {
        platform: this.name,
        chain: this.config.chain,
        userStats: userMap,
        totalBetsIndexed: bets.length,
        totalClaimsIndexed: claims.length,
        blockRange: { from: fromBlock, to: toBlock },
        indexedAt: Date.now(),
        errors,
      };

    } catch (error) {
      console.error(`❌ [DreamDEX] Fatal error:`, error);
      return {
        platform: this.name,
        chain: this.config.chain,
        userStats: userMap,
        totalBetsIndexed: bets.length,
        totalClaimsIndexed: claims.length,
        blockRange: { from: fromBlock, to: toBlock },
        indexedAt: Date.now(),
        errors: [...errors, `Fatal error: ${error}`],
      };
    }
  }

  async getUserStats(address: Address): Promise<PlatformUserStats | null> {
    // This would require indexing for a specific user
    // Not implemented in this version
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
    const volumeInSTT = Number(stats.totalVolume) / 1e18;

    const score = Math.floor(
      (winRate * 1000) +
      (stats.totalBets * 2) +
      (volumeInSTT / 10)
    );

    return Math.max(0, Math.min(10000, score));
  }
}
