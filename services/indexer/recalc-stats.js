import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { calculateDreamDEXScore, SCORING_CONFIG } from './scoring.js';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function recalculateAllStats() {
  console.log('📊 Recalculating user stats from existing data...\n');

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
  console.log(`✅ Platform ID: ${platformId}`);

  // Get all users with bets
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, wallet_address');

  if (usersError) {
    console.error('❌ Error fetching users:', usersError);
    return;
  }

  console.log(`👥 Found ${users?.length || 0} users\n`);

  let updated = 0;
  let skipped = 0;

  for (const user of users || []) {
    // Get full bet data for this user (including timestamp for maturity)
    const { data: bets, error: betsError } = await supabase
      .from('bets')
      .select('amount, won, timestamp')
      .eq('user_id', user.id)
      .eq('platform_id', platformId)
      .order('timestamp', { ascending: true });

    if (betsError || !bets || bets.length === 0) {
      skipped++;
      continue;
    }

    const totalBets = bets.length;
    const wins = bets.filter(b => b.won === true).length;
    const losses = totalBets - wins;
    const volume = bets.reduce((sum, b) => sum + BigInt(b.amount || '0'), 0n).toString();
    const winRate = totalBets > 0 ? (wins / totalBets) * 100 : 0;

    // Get first bet timestamp for maturity calculation
    const firstBetAt = bets[0]?.timestamp ? new Date(bets[0].timestamp) : null;

    // Calculate score using Wilson Score with all adjustments
    const scoreResult = calculateDreamDEXScore({
      wins,
      totalBets,
      volume,
      bets,
      firstBetAt,
    });

    const score = scoreResult.score;

    // Upsert stats
    const { error: upsertError } = await supabase
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

    if (upsertError) {
      console.error(`❌ Error updating ${user.wallet_address}:`, upsertError.message);
    } else {
      updated++;
      if (scoreResult.eligible) {
        console.log(
          `✅ ${user.wallet_address.slice(0, 10)}... | ` +
          `Bets: ${totalBets} | Wins: ${wins} | ` +
          `Raw: ${scoreResult.rawWinRate.toFixed(1)}% | Wilson: ${scoreResult.adjustedWinRate.toFixed(1)}% | ` +
          `Score: ${score} (skill:${scoreResult.skillScore} act:${scoreResult.activityScore} vol:${scoreResult.volumeBonus} cons:${scoreResult.consistencyBonus})`
        );
      } else {
        console.log(`⏭️  ${user.wallet_address.slice(0, 10)}... | Bets: ${totalBets} | ${scoreResult.reason}`);
      }
    }
  }

  console.log(`\n📊 Stats Recalculation Complete!`);
  console.log(`   Updated: ${updated} users`);
  console.log(`   Skipped: ${skipped} users (no bets)`);
}

recalculateAllStats().catch(console.error);
