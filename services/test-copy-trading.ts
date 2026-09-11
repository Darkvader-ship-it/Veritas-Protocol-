/**
 * Test Copy Trading - Manually trigger bet watcher
 *
 * This script:
 * 1. Creates a test trader user
 * 2. Creates a test follower user
 * 3. Sets up a copy follow relationship
 * 4. Inserts a test bet from the trader
 * 5. The bet watcher (if running) should automatically create a copy bet
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function testCopyTrading() {
  console.log('🧪 Testing Copy Trading System...\n');

  try {
    // Step 1: Get DreamDEX platform ID
    const { data: platform } = await supabase
      .from('platforms')
      .select('id')
      .eq('name', 'DreamDEX Event Contracts')
      .single();

    if (!platform) {
      console.error('❌ Platform not found');
      return;
    }

    console.log(`✅ Platform ID: ${platform.id}`);

    // Step 2: Create test trader
    const traderAddress = '0xtest' + Date.now().toString().slice(-8);
    const { data: trader } = await supabase
      .from('users')
      .upsert({
        wallet_address: traderAddress,
        username: 'Test Trader'
      }, { onConflict: 'wallet_address' })
      .select()
      .single();

    console.log(`✅ Created test trader: ${traderAddress}`);

    // Step 3: Create test follower
    const followerAddress = '0xfollower' + Date.now().toString().slice(-8);
    const { data: follower } = await supabase
      .from('users')
      .upsert({
        wallet_address: followerAddress,
        username: 'Test Follower'
      }, { onConflict: 'wallet_address' })
      .select()
      .single();

    console.log(`✅ Created test follower: ${followerAddress}`);

    // Step 4: Create copy follow relationship
    const { data: copyFollow } = await supabase
      .from('copy_follows')
      .insert({
        follower_id: follower!.id,
        trader_id: trader!.id,
        platform_id: platform.id,
        allocation_percentage: 50, // Copy 50% of trader's bet
        max_bet_amount: '100000000000000000', // 0.1 STT in wei
        is_active: true,
      })
      .select()
      .single();

    console.log(`✅ Created copy follow: ${copyFollow?.id}`);
    console.log(`   Allocation: 50%, Max: 0.1 STT\n`);

    // Step 5: Insert a test bet from the trader
    console.log('📊 Inserting test bet from trader...');

    const testBet = {
      user_id: trader!.id,
      platform_id: platform.id,
      market_id: 'test_epoch_' + Date.now(),
      position: 'Bull',
      amount: '1000000000000000000', // 1 STT
      won: null,
      tx_hash: '0xtest_' + Date.now(),
      block_number: 99999999,
      timestamp: new Date().toISOString(),
    };

    const { data: bet, error: betError } = await supabase
      .from('bets')
      .insert(testBet)
      .select()
      .single();

    if (betError) {
      console.error('❌ Failed to insert bet:', betError);
      return;
    }

    console.log(`✅ Inserted test bet: ${bet.id}`);
    console.log(`   Amount: 1 STT (${testBet.amount} wei)`);
    console.log(`   Position: ${testBet.position}`);
    console.log(`   Market: ${testBet.market_id}\n`);

    // Step 6: Wait for bet watcher to process
    console.log('⏳ Waiting 3 seconds for bet watcher to process...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 7: Check if copy bet was created
    const { data: copyTrades } = await supabase
      .from('copy_trades')
      .select(`
        *,
        copied_bet:copied_bet_id(amount, position)
      `)
      .eq('original_bet_id', bet.id);

    if (copyTrades && copyTrades.length > 0) {
      console.log('✅ SUCCESS! Copy bet was created by bet watcher:');
      copyTrades.forEach((trade: any) => {
        console.log(`   Copy Trade ID: ${trade.id}`);
        console.log(`   Copied Amount: ${(Number(trade.copied_bet.amount) / 1e18).toFixed(4)} STT`);
        console.log(`   Original: 1 STT → Copy: ${(Number(trade.copied_bet.amount) / 1e18).toFixed(4)} STT (50%)`);
      });
    } else {
      console.log('⚠️  No copy bet found yet. Possible reasons:');
      console.log('   1. Bet watcher is not running (run: npm run start:all)');
      console.log('   2. Bet watcher took longer than 3 seconds');
      console.log('   3. Check bet watcher terminal for errors');
    }

    console.log('\n📋 To verify manually:');
    console.log('   1. Go to http://localhost:3000/copy-trading');
    console.log(`   2. Connect wallet: ${followerAddress}`);
    console.log('   3. Check "Active Follows" and "Trade History" tabs');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run test
testCopyTrading()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
