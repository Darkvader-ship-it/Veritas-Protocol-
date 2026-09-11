// Test live blockchain connection
import { createDreamDEXAdapter } from './dist/index.js';

const RPC = 'https://somnia-mainnet.nodereal.io/v1/74c87044c35544ae868ec81ea592a19d';

async function test() {
  console.log('Testing live blockchain connection...\n');

  const adapter = createDreamDEXAdapter(RPC);

  try {
    await adapter.initialize();
    console.log('✅ Connected to Somnia');

    const block = await adapter.getCurrentBlock();
    console.log(`✅ Current block: ${block}`);

    // Test fetching bets for a known active trader (from your database)
    const testWallet = '0x2170ed0880ac9a755fd29b2688956bd959f933f8'; // Random active wallet
    console.log(`\nFetching bets for ${testWallet.slice(0, 10)}...`);

    const stats = await adapter.getUserStats(testWallet);
    console.log(`✅ Stats retrieved:`);
    console.log(`   - Total bets: ${stats.totalBets}`);
    console.log(`   - Wins: ${stats.wins}`);
    console.log(`   - Win rate: ${stats.winRate.toFixed(1)}%`);
    console.log(`   - Score: ${stats.score}`);

    await adapter.destroy();
    console.log('\n✅ SDK blockchain integration working!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

test();
