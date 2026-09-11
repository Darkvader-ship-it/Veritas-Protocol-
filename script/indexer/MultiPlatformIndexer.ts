import { Address } from 'viem';
import fs from 'fs';
import path from 'path';
import { getAllAdapters, getEnabledAdapters } from './platforms/adapters';
import { AggregatedUserStats, IndexerResult, PlatformUserStats } from './platforms/types';

interface MultiPlatformIndexerConfig {
  topN: number; // Number of top users to export (e.g., 500)
  minBets: number; // Minimum bets required
  minPlatforms: number; // Minimum platforms user must be active on
  blocksToIndex: bigint; // Number of blocks to index per chain
  outputPath: string; // Where to save the JSON
}

interface ExportedUserData {
  address: Address;
  totalBets: number;
  totalVolume: string; // String for JSON compatibility
  wins: number;
  losses: number;
  winRate: number;
  veritasScore: number;
  rank: number;
  platforms: string[];
  platformBreakdown: {
    platform: string;
    bets: number;
    winRate: number;
    score: number;
  }[];
}

interface ExportedData {
  lastIndexed: number;
  totalUsers: number;
  platforms: string[];
  indexingSummary: {
    platform: string;
    chain: string;
    users: number;
    bets: number;
    blockRange: string;
  }[];
  users: ExportedUserData[];
}

export class MultiPlatformIndexer {
  private config: MultiPlatformIndexerConfig;

  constructor(config?: Partial<MultiPlatformIndexerConfig>) {
    this.config = {
      topN: config?.topN || 500,
      minBets: config?.minBets || 5,
      minPlatforms: config?.minPlatforms || 1,
      blocksToIndex: config?.blocksToIndex || 100000n,
      outputPath: config?.outputPath || path.join(__dirname, '..', '..', 'frontend', 'public', 'data', 'real-users.json'),
    };
  }

  /**
   * Main indexing function
   */
  async indexAllPlatforms(): Promise<void> {
    console.log('\n🚀 Veritas Multi-Platform Indexer\n');
    console.log('═══════════════════════════════════════════════════');
    console.log(`📊 Configuration:`);
    console.log(`   Top users: ${this.config.topN}`);
    console.log(`   Min bets: ${this.config.minBets}`);
    console.log(`   Min platforms: ${this.config.minPlatforms}`);
    console.log(`   Blocks per chain: ${this.config.blocksToIndex}`);
    console.log('═══════════════════════════════════════════════════\n');

    // Get all enabled adapters
    const adapters = await getEnabledAdapters();

    if (adapters.length === 0) {
      console.error('❌ No platform adapters available!');
      process.exit(1);
    }

    console.log(`✅ Found ${adapters.length} enabled platform(s):\n`);
    adapters.forEach((adapter, i) => {
      console.log(`   ${i + 1}. ${adapter.name} (${adapter.config.chain})`);
    });
    console.log('');

    // Index each platform
    const results: IndexerResult[] = [];

    for (const adapter of adapters) {
      try {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`🔍 Indexing ${adapter.name}...`);
        console.log('='.repeat(60));

        const currentBlock = await this.getCurrentBlock(adapter);
        const fromBlock = currentBlock - this.config.blocksToIndex;
        const toBlock = currentBlock;

        console.log(`📍 Block range: ${fromBlock} → ${toBlock}`);

        const result = await adapter.indexUsers(fromBlock, toBlock);
        results.push(result);

        if (result.errors.length > 0) {
          console.warn(`⚠️  ${result.errors.length} error(s) occurred`);
          result.errors.forEach(err => console.warn(`   - ${err}`));
        }

      } catch (error) {
        console.error(`❌ Failed to index ${adapter.name}:`, error);
      }
    }

    // Aggregate user data across platforms
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 Aggregating cross-platform data...');
    console.log('='.repeat(60));

    const aggregatedUsers = this.aggregateUserData(results);

    console.log(`\n✅ Total unique users: ${aggregatedUsers.size}`);

    // Filter and rank users
    const topUsers = this.filterAndRankUsers(aggregatedUsers);

    console.log(`🏆 Top ${this.config.topN} users selected\n`);

    // Export to JSON
    const exportData = this.prepareExportData(topUsers, results);
    this.saveToJson(exportData);

    // Print summary
    this.printSummary(exportData);

    console.log('\n✅ Multi-platform indexing complete!\n');
  }

  /**
   * Get current block number for a platform
   */
  private async getCurrentBlock(adapter: any): Promise<bigint> {
    try {
      // Use the adapter's client to get the current block
      if (adapter.client && typeof adapter.client.getBlockNumber === 'function') {
        return await adapter.client.getBlockNumber();
      }

      // Fallback: use a reasonable default based on chain
      const chainDefaults: Record<string, bigint> = {
        'somnia': 35000000n,
        'polygon': 52000000n,
        'optimism': 115000000n,
        'ethereum': 19000000n,
      };

      return chainDefaults[adapter.config.chain] || 1000000n;
    } catch (error) {
      console.warn(`[${adapter.name}] Could not get current block, using fallback`);
      return 1000000n;
    }
  }

  /**
   * Aggregate user data from multiple platforms
   */
  private aggregateUserData(results: IndexerResult[]): Map<Address, AggregatedUserStats> {
    const aggregated = new Map<Address, AggregatedUserStats>();

    for (const result of results) {
      for (const [address, platformStats] of result.userStats) {
        let userStats = aggregated.get(address);

        if (!userStats) {
          userStats = {
            address,
            totalBets: 0,
            totalVolume: 0n,
            wins: 0,
            losses: 0,
            winRate: 0,
            veritasScore: 0,
            platforms: [],
            platformStats: {},
            bets: [],
          };
          aggregated.set(address, userStats);
        }

        // Aggregate stats
        userStats.totalBets += platformStats.totalBets;
        userStats.totalVolume += platformStats.totalVolume;
        userStats.wins += platformStats.wins;
        userStats.losses += platformStats.losses;

        // Track platforms
        if (!userStats.platforms.includes(result.platform)) {
          userStats.platforms.push(result.platform);
        }

        // Store platform-specific stats
        userStats.platformStats[result.platform] = platformStats;
      }
    }

    // Calculate derived stats
    for (const [address, stats] of aggregated) {
      stats.winRate = stats.totalBets > 0 ? (stats.wins / stats.totalBets) * 100 : 0;
      stats.veritasScore = this.calculateVeritasScore(stats);
    }

    return aggregated;
  }

  /**
   * Calculate unified VeritasScore
   */
  private calculateVeritasScore(stats: AggregatedUserStats): number {
    const winRate = stats.totalBets > 0 ? (stats.wins / stats.totalBets) : 0;
    const volumeNormalized = Number(stats.totalVolume) / 1e18;

    // Base score components
    const winRateComponent = winRate * 1000; // 0-1000
    const activityComponent = stats.totalBets * 2; // Activity bonus
    const volumeComponent = volumeNormalized / 10; // Volume bonus
    const platformBonus = stats.platforms.length * 50; // Multi-platform bonus

    const score = Math.floor(
      winRateComponent +
      activityComponent +
      volumeComponent +
      platformBonus
    );

    return Math.max(0, Math.min(10000, score));
  }

  /**
   * Filter users by criteria and rank them
   */
  private filterAndRankUsers(users: Map<Address, AggregatedUserStats>): AggregatedUserStats[] {
    // Convert to array and filter
    const qualifiedUsers = Array.from(users.values()).filter(user =>
      user.totalBets >= this.config.minBets &&
      user.platforms.length >= this.config.minPlatforms
    );

    console.log(`🎯 Qualified users (${this.config.minBets}+ bets, ${this.config.minPlatforms}+ platforms): ${qualifiedUsers.length}`);

    // Sort by VeritasScore
    qualifiedUsers.sort((a, b) => b.veritasScore - a.veritasScore);

    // Assign ranks
    qualifiedUsers.forEach((user, index) => {
      user.rank = index + 1;
    });

    // Return top N
    return qualifiedUsers.slice(0, this.config.topN);
  }

  /**
   * Prepare data for export
   */
  private prepareExportData(users: AggregatedUserStats[], results: IndexerResult[]): ExportedData {
    return {
      lastIndexed: Date.now(),
      totalUsers: users.length,
      platforms: [...new Set(results.map(r => r.platform))],
      indexingSummary: results.map(r => ({
        platform: r.platform,
        chain: r.chain,
        users: r.userStats.size,
        bets: r.totalBetsIndexed,
        blockRange: `${r.blockRange.from}-${r.blockRange.to}`,
      })),
      users: users.map(user => ({
        address: user.address,
        totalBets: user.totalBets,
        totalVolume: user.totalVolume.toString(),
        wins: user.wins,
        losses: user.losses,
        winRate: Number(user.winRate.toFixed(1)),
        veritasScore: user.veritasScore,
        rank: user.rank || 0,
        platforms: user.platforms,
        platformBreakdown: user.platforms.map(platform => {
          const platformStat = user.platformStats[platform];
          return {
            platform,
            bets: platformStat.totalBets,
            winRate: Number(platformStat.winRate.toFixed(1)),
            score: platformStat.platformScore,
          };
        }),
      })),
    };
  }

  /**
   * Save data to JSON file
   */
  private saveToJson(data: ExportedData): void {
    const outputDir = path.dirname(this.config.outputPath);

    // Create directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const jsonData = JSON.stringify(data, null, 2);
    fs.writeFileSync(this.config.outputPath, jsonData);

    console.log(`\n💾 Data saved to: ${this.config.outputPath}`);
    console.log(`   File size: ${(jsonData.length / 1024).toFixed(2)} KB`);
  }

  /**
   * Print summary
   */
  private printSummary(data: ExportedData): void {
    console.log('\n═══════════════════════════════════════════════════');
    console.log('                  FINAL SUMMARY                     ');
    console.log('═══════════════════════════════════════════════════');
    console.log(`📅 Last Indexed: ${new Date(data.lastIndexed).toLocaleString()}`);
    console.log(`👥 Total Users: ${data.totalUsers}`);
    console.log(`🌐 Platforms: ${data.platforms.join(', ')}`);
    console.log('\n📊 Platform Breakdown:');
    data.indexingSummary.forEach(summary => {
      console.log(`   ${summary.platform} (${summary.chain}):`);
      console.log(`     Users: ${summary.users} | Bets: ${summary.bets}`);
      console.log(`     Blocks: ${summary.blockRange}`);
    });

    console.log('\n🏆 Top 10 Users:');
    console.log('───────────────────────────────────────────────────');

    data.users.slice(0, 10).forEach((user, index) => {
      console.log(`${index + 1}. ${user.address.slice(0, 6)}...${user.address.slice(-4)}`);
      console.log(`   Score: ${user.veritasScore} | Bets: ${user.totalBets} | Win Rate: ${user.winRate}%`);
      console.log(`   Platforms: ${user.platforms.join(', ')}`);
      console.log(`   Volume: ${(Number(user.totalVolume) / 1e18).toFixed(4)} (normalized)\n`);
    });

    console.log('═══════════════════════════════════════════════════');
  }
}

/**
 * Main execution
 */
async function main() {
  const indexer = new MultiPlatformIndexer({
    topN: 500, // Index top 500 users
    minBets: 5,
    minPlatforms: 1,
    blocksToIndex: 100000n,
  });

  await indexer.indexAllPlatforms();
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export default main;
