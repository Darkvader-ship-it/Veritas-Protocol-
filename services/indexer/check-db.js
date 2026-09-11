import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkDatabase() {
  console.log('📊 Checking database state...\n');

  // Count total bets
  const { count: totalBets } = await supabase
    .from('bets')
    .select('*', { count: 'exact', head: true });

  // Count bets with won = true
  const { count: wonBets } = await supabase
    .from('bets')
    .select('*', { count: 'exact', head: true })
    .eq('won', true);

  // Count bets with claimed_amount > 0
  const { data: claimedBets } = await supabase
    .from('bets')
    .select('*')
    .not('claimed_amount', 'is', null)
    .limit(10);

  // Count users
  const { count: userCount } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true });

  // Get recent bets
  const { data: recentBets } = await supabase
    .from('bets')
    .select('*')
    .order('block_number', { ascending: false })
    .limit(5);

  console.log('📈 Database Statistics:');
  console.log(`   Total bets: ${totalBets}`);
  console.log(`   Won bets (won=true): ${wonBets}`);
  console.log(`   Claimed bets (claimed_amount set): ${claimedBets?.length || 0}`);
  console.log(`   Total users: ${userCount}`);

  console.log('\n📋 Recent bets:');
  recentBets?.forEach(bet => {
    console.log(`   Epoch: ${bet.epoch} | Block: ${bet.block_number} | Position: ${bet.position} | Won: ${bet.won} | Claimed: ${bet.claimed_amount || 'null'}`);
  });

  // Check user_platform_stats - top by win count
  const { data: statsData } = await supabase
    .from('user_platform_stats')
    .select(`
      *,
      user:user_id(wallet_address)
    `)
    .order('wins', { ascending: false })
    .limit(10);

  console.log('\n📊 Top users by wins:');
  statsData?.forEach(stat => {
    const addr = stat.user?.wallet_address || 'unknown';
    console.log(`   ${addr.slice(0, 10)}... | Bets: ${stat.total_bets} | Wins: ${stat.wins} | WinRate: ${stat.win_rate}% | Score: ${stat.score}`);
  });

  // Show epoch range
  const { data: epochRange } = await supabase
    .from('bets')
    .select('epoch')
    .order('epoch', { ascending: false })
    .limit(1);

  const { data: epochMin } = await supabase
    .from('bets')
    .select('epoch')
    .order('epoch', { ascending: true })
    .limit(1);

  console.log(`\n📅 Epoch range: ${epochMin?.[0]?.epoch} to ${epochRange?.[0]?.epoch}`);
}

checkDatabase().catch(console.error);
