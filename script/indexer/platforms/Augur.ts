import { createPublicClient, http, parseAbiItem, Address } from 'viem';
import { mainnet } from 'viem/chains';
import { PlatformAdapter, PlatformConfig, IndexerResult, PlatformUserStats } from './types';

/**
 * Augur V2 Adapter
 * Augur is a decentralized prediction market on Ethereum mainnet
 */
export class AugurAdapter implements PlatformAdapter {
  name = 'Augur';
  config: PlatformConfig;
  private client;

  // Augur V2 contracts on Ethereum
  private readonly AUGUR_TRADING = '0xf5Af2A321B31D4D0c0f8f0eB3dCDa3Fb27B4B4a8' as Address; // Example address

  private readonly ORDER_FILLED_ABI = parseAbiItem(
    'event OrderFilled(address indexed universe, address indexed market, address creator, address filler, uint256 price, uint256 amount, bytes32 orderId)'
  );

  constructor(config?: Partial<PlatformConfig>) {
    this.config = {
      name: 'Augur',
      chain: 'ethereum',
      rpcUrl: config?.rpcUrl || 'https://eth.llamarpc.com',
      contractAddress: this.AUGUR_TRADING,
      enabled: config?.enabled ?? false, // Disabled by default (high gas costs)
      batchSize: config?.batchSize || 1000n, // Smaller batches for mainnet
      delayMs: config?.delayMs || 200,
    };

    this.client = createPublicClient({
      chain: mainnet,
      transport: http(this.config.rpcUrl),
    });
  }

  async isAvailable(): Promise<boolean> {
    if (!this.config.enabled) return false;

    try {
      const blockNumber = await this.client.getBlockNumber();
      return blockNumber > 0n;
    } catch {
      return false;
    }
  }

  async indexUsers(fromBlock: bigint, toBlock: bigint): Promise<IndexerResult> {
    console.log(`\n📊 [Augur] Indexing from block ${fromBlock} to ${toBlock}...`);

    const userMap = new Map<Address, PlatformUserStats>();

    console.log(`⚠️  [Augur] V2 is deprecated - recommend focusing on other platforms`);
    console.log(`   Consider Augur Turbo (Polygon) for active markets`);

    return {
      platform: this.name,
      chain: this.config.chain,
      userStats: userMap,
      totalBetsIndexed: 0,
      totalClaimsIndexed: 0,
      blockRange: { from: fromBlock, to: toBlock },
      indexedAt: Date.now(),
      errors: ['Augur V2 deprecated - not implemented in MVP'],
    };
  }

  async getUserStats(address: Address): Promise<PlatformUserStats | null> {
    return null;
  }
}
