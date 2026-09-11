/**
 * Populate Sample Data Script
 *
 * This script populates your Supabase database with realistic sample data
 * so you can see the leaderboard working immediately while you work on
 * getting real blockchain data.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Sample wallet addresses (realistic Somnia addresses)
const SAMPLE_WALLETS = [
  '0x1234567890123456789012345678901234567890',
  '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
  '0x9876543210987654321098765432109876543210',
  '0x1111111111111111111111111111111111111111',
  '0x2222222222222222222222222222222222222222',
  '0x3333333333333333333333333333333333333333',
  '0x4444444444444444444444444444444444444444',
  '0x5555555555555555555555555555555555555555',
  '0x6666666666666666666666666666666666666666',
  '0x7777777777777777777777777777777777777777',
  '0x8888888888888888888888888888888888888888',
  '0x9999999999999999999999999999999999999999',
  '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  '0xcccccccccccccccccccccccccccccccccccccccc',
];

async function main() {
  console.log('🚀 Starting sample data population...\n');

  // Get platform ID
  const { data: platform, error: platformError } = await supabase
    .from('platforms')
    .select('id')
    .eq('name', 'DreamDEX Event Contracts')
    .single();

  if (platformError || !platform) {
    console.error('❌ Failed to get platform. Did you run schema.sql?');
    console.error(platformError);
    process.exit(1);
  }

  const platformId = platform.id;
  console.log(`✅ Platform ID: ${platformId}`);

  // Create users
  console.log('\n📝 Creating users...');
  const users = [];

  for (const wallet of SAMPLE_WALLETS) {
    const { data: user, error } = await supabase
      .from('users')
      .upsert({
        wallet_address: wallet.toLowerCase(),
        username: `Trader_${wallet.slice(2, 8)}`,
      })
      .select()
      .single();

    if (error) {
      console.log(`⚠️  User ${wallet} already exists or error:`, error.message);
    } else if (user) {
      users.push(user);
      console.log(`✅ Created user: ${user.wallet_address}`);
    }
  }

  // Fetch all users (including any that already existed)
  const { data: allUsers } = await supabase
    .from('users')
    .select('*')
    .in('wallet_address', SAMPLE_WALLETS.map(w => w.toLowerCase()));

  if (!allUsers || allUsers.length === 0) {
    console.error('❌ No users found');
    process.exit(1);
  }

  console.log(`\n✅ Total users: ${allUsers.length}`);

  // Generate sample bets
  console.log('\n📊 Creating sample bets...');
  const bets = [];
  let totalBetsCreated = 0;

  for (const user of allUsers) {
    // Random number of bets per user (50-150) to ensure all users qualify for leaderboard
    const numBets = Math.floor(Math.random() * 101) + 50;

    for (let i = 0; i < numBets; i++) {
      const position = Math.random() > 0.5 ? 'Bull' : 'Bear';
      const amount = (Math.random() * 0.5 + 0.01).toFixed(18); // 0.01 - 0.51 STT
      const amountWei = (parseFloat(amount) * 1e18).toFixed(0);

      // Win probability - some users are better than others
      const userId = allUsers.indexOf(user);
      const skillLevel = userId < 5 ? 0.65 : // Top 5 users have 65% win rate
                         userId < 10 ? 0.55 : // Next 5 have 55%
                         0.45; // Rest have 45%

      const won = Math.random() < skillLevel;
      const claimedAmount = won ? (parseFloat(amountWei) * 1.95).toFixed(0) : null;

      const epoch = 10000 + Math.floor(Math.random() * 5000);
      const txHash = `0x${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`;
      const blockNumber = 67000000 + Math.floor(Math.random() * 100000);
      const timestamp = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000); // Last 30 days

      bets.push({
        user_id: user.id,
        platform_id: platformId,
        market_id: epoch.toString(),
        position,
        amount: amountWei,
        claimed_amount: claimedAmount,
        won,
        tx_hash: txHash,
        block_number: blockNumber,
        timestamp: timestamp.toISOString(),
      });
    }
  }

  // Insert bets in batches of 100
  console.log(`📦 Inserting ${bets.length} bets...`);

  for (let i = 0; i < bets.length; i += 100) {
    const batch = bets.slice(i, i + 100);
    const { error } = await supabase
      .from('bets')
      .upsert(batch, { onConflict: 'tx_hash' });

    if (error) {
      console.error(`❌ Error inserting batch ${i / 100 + 1}:`, error.message);
    } else {
      totalBetsCreated += batch.length;
      console.log(`✅ Inserted batch ${i / 100 + 1} (${batch.length} bets)`);
    }
  }

  console.log(`\n✅ Total bets created: ${totalBetsCreated}`);

  // Verify user_platform_stats were auto-created by trigger
  console.log('\n📈 Checking user stats...');
  const { data: stats, error: statsError } = await supabase
    .from('user_platform_stats')
    .select('*')
    .eq('platform_id', platformId)
    .order('score', { ascending: false })
    .limit(10);

  if (statsError) {
    console.error('❌ Error fetching stats:', statsError);
  } else if (stats) {
    console.log('\n🏆 Top 10 Users:');
    console.log('─'.repeat(80));
    stats.forEach((stat, index) => {
      const user = allUsers.find(u => u.id === stat.user_id);
      console.log(
        `${index + 1}. ${user?.wallet_address.slice(0, 10)}... | ` +
        `Bets: ${stat.total_bets} | Win Rate: ${stat.win_rate}% | Score: ${stat.score}`
      );
    });
    console.log('─'.repeat(80));
  }

  console.log('\n🎉 Sample data population complete!');
  console.log('\n📋 Next steps:');
  console.log('1. Visit http://localhost:3000/api/leaderboard-db to see the data');
  console.log('2. Update frontend/app/leaderboard/page.tsx to use /api/leaderboard-db');
  console.log('3. Refresh your leaderboard to see the sample data!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
