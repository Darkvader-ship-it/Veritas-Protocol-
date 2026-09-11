/**
 * Custom Adapter Example
 *
 * This example shows how to create your own adapter for a new prediction market protocol.
 * Extend the BaseAdapter class and implement the required methods.
 */

import { BaseAdapter } from '../dist/core/BaseAdapter.js';
import { ReputationSDK } from '../dist/index.js';

/**
 * Example: Custom adapter for a hypothetical prediction market
 */
class MyProtocolAdapter extends BaseAdapter {
  // Required properties
  platformId = 'my-protocol';
  platformName = 'My Protocol';
  chainId = 1; // Ethereum Mainnet
  nativeToken = 'ETH';

  constructor(rpcUrl) {
    super({ rpcUrl, chainId: 1 });
  }

  /**
   * Get historical bets for a user
   */
  async getBetsForUser(walletAddress, fromBlock) {
    // Implement your protocol-specific logic here
    // This could involve:
    // - Fetching events from your smart contract
    // - Querying your protocol's API
    // - Reading from a subgraph

    console.log(`[${this.platformName}] Fetching bets for ${walletAddress}`);

    // Example: Return mock data for demonstration
    return [
      {
        id: 'bet-1',
        userId: walletAddress.toLowerCase(),
        marketId: 'market-123',
        position: 'yes',
        amount: '1000000000000000000', // 1 ETH
        timestamp: Date.now() / 1000 - 86400, // 1 day ago
        won: true,
        claimedAmount: '1500000000000000000', // 1.5 ETH
      },
      {
        id: 'bet-2',
        userId: walletAddress.toLowerCase(),
        marketId: 'market-456',
        position: 'no',
        amount: '500000000000000000', // 0.5 ETH
        timestamp: Date.now() / 1000 - 172800, // 2 days ago
        won: false,
      },
    ];
  }

  /**
   * Backfill historical data
   */
  async backfill(fromBlock, toBlock, onBet) {
    console.log(`[${this.platformName}] Backfilling ${fromBlock} to ${toBlock}`);

    // Implement your backfill logic here
    // For each bet found, call: await onBet(bet)

    // Example: Use the helper method for chunked processing
    await this.processInChunks(
      fromBlock,
      toBlock,
      1000, // chunk size
      100, // delay between chunks (ms)
      async (start, end) => {
        // Fetch events from blockchain
        // const logs = await this.provider.getLogs({...});
        // Process and return bets

        return []; // Return processed items for logging
      }
    );
  }

  /**
   * Optional: Override score calculation for protocol-specific logic
   */
  calculateScore(stats) {
    // Custom scoring formula for your protocol
    const { wins, totalBets, winRate, volume } = stats;

    // Example: Weight accuracy more heavily
    const baseScore = wins * 150; // 150 points per win (vs default 100)
    const accuracyBonus = winRate > 60 ? (winRate - 60) * 20 : 0;
    const volumeBonus = Math.min(300, Number(volume) / 1e18 * 5);

    return Math.floor(baseScore + accuracyBonus + volumeBonus);
  }
}

// Usage
async function main() {
  // Create custom adapter
  const myAdapter = new MyProtocolAdapter('https://eth-mainnet.g.alchemy.com/v2/demo');

  // Use with SDK
  const sdk = new ReputationSDK({
    adapters: [myAdapter],
  });

  await sdk.initialize();

  // Get score
  const score = await sdk.getVeritasScore('0x1234567890123456789012345678901234567890');
  console.log('VeritasScore:', score);

  await sdk.destroy();
}

main().catch(console.error);
