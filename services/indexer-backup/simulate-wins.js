import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Simulate realistic win rates for demo purposes
 * This assigns ~50% win rate (with variance) to existing bets
 */
async function simulateWins() {
  console.log('🎲 Simulating realistic win data for demo...\n');

  // Get platform ID
  const { data: platform } = await supabase
    .from('platforms')
    .select('id')
    .eq('name', 'DreamDEX Event Contracts')
    .single();

  if (!platform) {
    console.error('❌ Platform not found');
    return;
  }

  const platformId = platform.id;

  // Get all bets grouped by epoch
  const { data: bets, error } = await supabase
    .from('bets')
    .select('id, epoch, position, amount')
    .order('epoch', { ascending: true });

  if (error) {
    console.error('❌ Error fetching bets:', error);
    return;
  }

  console.log(`📊 Found ${bets.length} bets to process`);

  // Group bets by epoch
  const epochMap = new Map();
  bets.forEach(bet => {
    if (!epochMap.has(bet.epoch)) {
      epochMap.set(bet.epoch, []);
    }
    epochMap.get(bet.epoch).push(bet);
  });

  console.log(`📅 ${epochMap.size} unique epochs\n`);

  // For each epoch, randomly decide winner (bull or bear)
  // Then mark bets accordingly
  let totalWins = 0;
  let totalBets = 0;
  const updates = [];

  for (const [epoch, epochBets] of epochMap) {
    // Random winner: ~50% bull, ~50% bear
    const winner = Math.random() < 0.5 ? 'bull' : 'bear';

    for (const bet of epochBets) {
      totalBets++;
      const won = bet.position === winner;
      if (won) {
        totalWins++;
        // Calculate claim amount (approximately 1.8-2x for winners)
        const multiplier = 1.8 + Math.random() * 0.4; // 1.8x to 2.2x
        const claimedAmount = Math.floor(Number(bet.amount) * multiplier).toString();

        updates.push({
          id: bet.id,
          won: true,
          claimed_amount: claimedAmount,
        });
      }
    }
  }

  console.log(`📈 Simulation results:`);
  console.log(`   Total bets: ${totalBets}`);
  console.log(`   Winners: ${totalWins}`);
  console.log(`   Win rate: ${((totalWins / totalBets) * 100).toFixed(1)}%\n`);

  // Update bets in batches
  console.log(`📝 Updating ${updates.length} winning bets...`);

  const batchSize = 100;
  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);

    for (const update of batch) {
      await supabase
        .from('bets')
        .update({ won: update.won, claimed_amount: update.claimed_amount })
        .eq('id', update.id);
    }

    process.stdout.write(`\r   Progress: ${Math.min(i + batchSize, updates.length)}/${updates.length}`);
  }

  console.log('\n\n✅ Wins simulated! Now recalculating stats...\n');

  // Now recalculate all user stats
  const { data: users } = await supabase
    .from('users')
    .select('id, wallet_address');

  let updated = 0;

  for (const user of users || []) {
    const { data: userBets } = await supabase
      .from('bets')
      .select('amount, won')
      .eq('user_id', user.id)
      .eq('platform_id', platformId);

    if (!userBets || userBets.length === 0) continue;

    const totalBets = userBets.length;
    const wins = userBets.filter(b => b.won === true).length;
    const losses = totalBets - wins;
    const volume = userBets.reduce((sum, b) => sum + BigInt(b.amount || '0'), 0n).toString();
    const winRate = totalBets > 0 ? (wins / totalBets) * 100 : 0;

    // Calculate score
    const winPoints = wins * 100;
    const winRateBonus = winRate > 55 ? (winRate - 55) * 10 : 0;
    const volumeSTT = Number(volume) / 1e18;
    const volumeBonus = Math.min(500, Math.floor(volumeSTT * 10));
    const score = Math.floor(winPoints + winRateBonus + volumeBonus);

    await supabase
      .from('user_platform_stats')
      .upsert({
        user_id: user.id,
        platform_id: platformId,
        total_bets: totalBets,
        wins,
        losses,
        win_rate: Math.round(winRate * 100) / 100,
        volume,
        score,
        last_updated: new Date().toISOString(),
      }, { onConflict: 'user_id,platform_id' });

    if (score > 100) {
      console.log(`✅ ${user.wallet_address.slice(0, 10)}... | Bets: ${totalBets} | Wins: ${wins} | WinRate: ${winRate.toFixed(1)}% | Score: ${score}`);
    }
    updated++;
  }

  console.log(`\n📊 Stats recalculated for ${updated} users!`);
  console.log('🎉 Leaderboard should now display properly!');
}

simulateWins().catch(console.error);
