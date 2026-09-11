const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function findActive() {
  // Get recent bets (last 6 hours)
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

  const { data: recentBets } = await supabase
    .from('bets')
    .select('user_id, users!inner(wallet_address)')
    .gte('timestamp', sixHoursAgo)
    .order('timestamp', { ascending: false });

  // Count bets per user
  const betCounts = {};
  for (const bet of recentBets || []) {
    const addr = bet.users?.wallet_address?.toLowerCase();
    if (addr) {
      betCounts[addr] = (betCounts[addr] || 0) + 1;
    }
  }

  // Sort by activity
  const sorted = Object.entries(betCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  console.log('=== MOST ACTIVE TRADERS (Last 6 hours) ===');
  console.log('');

  if (sorted.length === 0) {
    console.log('No activity in last 6 hours');

    // Check last 24 hours
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: dayBets } = await supabase
      .from('bets')
      .select('user_id, users!inner(wallet_address)')
      .gte('timestamp', dayAgo)
      .order('timestamp', { ascending: false });

    const dayCounts = {};
    for (const bet of dayBets || []) {
      const addr = bet.users?.wallet_address?.toLowerCase();
      if (addr) {
        dayCounts[addr] = (dayCounts[addr] || 0) + 1;
      }
    }

    const daySorted = Object.entries(dayCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    console.log('');
    console.log('=== MOST ACTIVE (Last 24 hours) ===');
    for (const [addr, count] of daySorted) {
      console.log(`${addr} - ${count} bets`);
    }
  } else {
    for (const [addr, count] of sorted) {
      console.log(`${addr} - ${count} bets in last 6h`);
    }
  }

  // Find most recent bet overall
  const { data: lastBet } = await supabase
    .from('bets')
    .select('timestamp, epoch, users!inner(wallet_address)')
    .order('timestamp', { ascending: false })
    .limit(1)
    .single();

  console.log('');
  console.log('=== MOST RECENT BET IN DATABASE ===');
  if (lastBet) {
    const ago = Math.round((Date.now() - new Date(lastBet.timestamp).getTime()) / (1000 * 60 * 60));
    console.log(`${lastBet.users?.wallet_address}`);
    console.log(`Epoch: ${lastBet.epoch}`);
    console.log(`Time: ${ago} hours ago`);
  }
}

findActive().catch(console.error);
