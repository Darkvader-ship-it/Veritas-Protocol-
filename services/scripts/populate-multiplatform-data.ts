/**
 * Populate Multi-Platform Sample Data
 *
 * Generates realistic sample data across multiple prediction markets:
 * - DreamDEX Event Contracts (Somnia)
 * - Polymarket (Polygon)
 * - Kalshi (Ethereum)
 * - Myriad (Polygon)
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Sample wallet addresses
const SAMPLE_WALLETS = [
  '0xa1b2c3d4e5f6789012345678901234567890abcd',
  '0xfedcba9876543210fedcba9876543210fedcba98',
  '0x1122334455667788991122334455667788991122',
  '0x9988776655443322119988776655443322119988',
  '0xaabbccddeeff00112233445566778899aabbccdd',
  '0x5544332211009988776655443322110099887766',
  '0x123abc456def789012345abc678def901234abc5',
  '0xdef789012345abc6789012345def67890abc1234',
  '0x456789abcdef012345678abcdef9012345678abc',
  '0xbcdef0123456789abcdef0123456789abcdef012',
  '0x789abcdef0123456789abcdef0123456789abcde',
  '0xcdef0123456789abcdef0123456789abcdef0123',
  '0x0123456789abcdef0123456789abcdef01234567',
  '0x6789abcdef0123456789abcdef0123456789abcd',
  '0xef0123456789abcdef0123456789abcdef012345',
];

const PLATFORMS = [
  'DreamDEX Event Contracts',
  'Polymarket',
  'Kalshi',
  'Myriad',
];

async function main() {
  console.log('🚀 Starting multi-platform sample data population...\n');

  // Get all platform IDs
  const { data: platforms, error: platformsError } = await supabase
    .from('platforms')
    .select('id, name')
    .in('name', PLATFORMS);

  if (platformsError || !platforms || platforms.length === 0) {
    console.error('❌ Failed to get platforms:', platformsError);
    process.exit(1);
  }

  console.log(`✅ Found ${platforms.length} platforms:`);
  platforms.forEach(p => console.log(`   - ${p.name} (ID: ${p.id})`));

  // Create users
  console.log('\n📝 Creating users...');
  for (const wallet of SAMPLE_WALLETS) {
    const { error } = await supabase
      .from('users')
      .upsert({
        wallet_address: wallet.toLowerCase(),
        username: `Trader_${wallet.slice(2, 8)}`,
      }, { onConflict: 'wallet_address' });

    if (error && !error.message.includes('duplicate')) {
      console.log(`⚠️  Error for ${wallet}:`, error.message);
    }
  }

  // Fetch all users
  const { data: allUsers } = await supabase
    .from('users')
    .select('*')
    .in('wallet_address', SAMPLE_WALLETS.map(w => w.toLowerCase()));

  if (!allUsers || allUsers.length === 0) {
    console.error('❌ No users found');
    process.exit(1);
  }

  console.log(`✅ Total users: ${allUsers.length}`);

  // Generate bets across all platforms
  console.log('\n📊 Creating multi-platform bets...');
  let totalBetsCreated = 0;

  for (const user of allUsers) {
    const userIndex = allUsers.indexOf(user);

    // Each user is active on 1-3 platforms
    const numPlatforms = Math.min(1 + Math.floor(Math.random() * 3), platforms.length);
    const userPlatforms = platforms
      .sort(() => Math.random() - 0.5)
      .slice(0, numPlatforms);

    for (const platform of userPlatforms) {
      // 10-50 bets per platform
      const numBets = Math.floor(Math.random() * 41) + 10;

      // Skill level varies per user
      const skillLevel = userIndex < 5 ? 0.65 : // Top 5: 65% win rate
                         userIndex < 10 ? 0.55 : // Next 5: 55%
                         0.45; // Rest: 45%

      const bets = [];
      for (let i = 0; i < numBets; i++) {
        const position = Math.random() > 0.5 ? 'Yes' : 'No';
        const amount = (Math.random() * 100 + 10).toFixed(18); // 10-110 USD equivalent
        const amountWei = (parseFloat(amount) * 1e18).toFixed(0);

        const won = Math.random() < skillLevel;
        const claimedAmount = won ? (parseFloat(amountWei) * 1.92).toFixed(0) : null;

        const marketId = `market_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        const txHash = `0x${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`;
        const blockNumber = 67000000 + Math.floor(Math.random() * 500000);

        // Timestamps from last 48 hours
        const hoursAgo = Math.random() * 48;
        const timestamp = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

        bets.push({
          user_id: user.id,
          platform_id: platform.id,
          market_id: marketId,
          position,
          amount: amountWei,
          claimed_amount: claimedAmount,
          won,
          tx_hash: txHash,
          block_number: blockNumber,
          timestamp: timestamp.toISOString(),
        });
      }

      // Insert bets for this user-platform combo
      const { error } = await supabase
        .from('bets')
        .upsert(bets, { onConflict: 'tx_hash' });

      if (error) {
        console.error(`❌ Error for ${user.wallet_address.slice(0, 10)} on ${platform.name}:`, error.message);
      } else {
        totalBetsCreated += bets.length;
        console.log(`✅ ${user.wallet_address.slice(0, 10)}... → ${platform.name}: ${bets.length} bets`);
      }
    }
  }

  console.log(`\n✅ Total bets created: ${totalBetsCreated}`);

  // Show top users across all platforms
  console.log('\n📈 Top 10 Multi-Platform Users:');
  const { data: topUsers } = await supabase
    .from('user_platform_stats')
    .select(`
      *,
      user:user_id(wallet_address),
      platform:platform_id(name)
    `)
    .order('score', { ascending: false })
    .limit(20);

  if (topUsers) {
    // Group by user
    const userScores = new Map();
    topUsers.forEach(stat => {
      const addr = stat.user.wallet_address;
      if (!userScores.has(addr)) {
        userScores.set(addr, { total_score: 0, total_bets: 0, platforms: [] });
      }
      const userData = userScores.get(addr);
      userData.total_score += stat.score;
      userData.total_bets += stat.total_bets;
      userData.platforms.push(stat.platform.name);
    });

    console.log('─'.repeat(100));
    Array.from(userScores.entries())
      .sort((a, b) => b[1].total_score - a[1].total_score)
      .slice(0, 10)
      .forEach(([addr, data], index) => {
        console.log(
          `${index + 1}. ${addr.slice(0, 12)}... | ` +
          `Score: ${data.total_score} | Bets: ${data.total_bets} | ` +
          `Platforms: ${data.platforms.join(', ')}`
        );
      });
    console.log('─'.repeat(100));
  }

  console.log('\n🎉 Multi-platform data population complete!');
  console.log('\n📋 Next steps:');
  console.log('1. Visit http://localhost:3000/leaderboard');
  console.log('2. See users with activity across multiple platforms!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
