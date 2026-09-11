/**
 * Basic Usage Example
 *
 * This example demonstrates how to use the Veritas Reputation SDK
 * to get unified reputation scores across multiple prediction markets.
 */

import {
  ReputationSDK,
  createDreamDEXAdapter,
  createPolymarketAdapter,
} from '../dist/index.js';

// Configuration
const Somnia_RPC = 'https://somnia-dataseed.somnia.org';
const POLYGON_RPC = 'https://polygon-rpc.com';

// Example wallet to check (replace with actual address)
const WALLET_ADDRESS = '0x1234567890123456789012345678901234567890';

async function main() {
  console.log('Veritas Reputation SDK - Basic Example\n');
  console.log('='.repeat(50));

  // 1. Create adapters for each platform
  const dreamdexAdapter = createDreamDEXAdapter(Somnia_RPC);
  const polymarketAdapter = createPolymarketAdapter(POLYGON_RPC);

  // 2. Initialize the SDK with adapters
  const sdk = new ReputationSDK({
    adapters: [dreamdexAdapter, polymarketAdapter],
  });

  // 3. Initialize (connects to RPCs)
  console.log('\nInitializing SDK...');
  await sdk.initialize();

  // 4. Get supported platforms
  console.log('\nSupported Platforms:');
  const platforms = sdk.getPlatforms();
  platforms.forEach((p) => {
    console.log(`  - ${p.name} (${p.token} on chain ${p.chainId})`);
  });

  // 5. Get VeritasScore for a wallet
  console.log(`\nFetching VeritasScore for ${WALLET_ADDRESS.slice(0, 10)}...`);
  const veritasScore = await sdk.getVeritasScore(WALLET_ADDRESS);

  console.log('\nVeritasScore Results:');
  console.log(`  Total Score: ${veritasScore.totalScore}`);
  console.log(`  Tier: ${veritasScore.tier.toUpperCase()}`);
  console.log('\n  Platform Breakdown:');
  veritasScore.breakdown.forEach((b) => {
    console.log(`    - ${b.platformName}: ${b.score} points (weight: ${b.weight})`);
  });

  // 6. Get all bets
  console.log('\nFetching all bets...');
  const bets = await sdk.getAllBets(WALLET_ADDRESS);
  console.log(`  Total bets found: ${bets.length}`);

  if (bets.length > 0) {
    console.log('\n  Recent bets:');
    bets.slice(0, 5).forEach((bet) => {
      const date = new Date(bet.timestamp * 1000).toLocaleDateString();
      const result = bet.won === true ? '✅ Won' : bet.won === false ? '❌ Lost' : '⏳ Pending';
      console.log(`    - ${date}: ${bet.position.toUpperCase()} | ${result}`);
    });
  }

  // 7. Clean up
  await sdk.destroy();
  console.log('\nDone!');
}

// Run
main().catch(console.error);
