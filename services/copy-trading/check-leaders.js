const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
  // Get top 50 leaders from leaderboard
  const { data: topTraders } = await supabase
    .from('user_platform_stats')
    .select('user_id, score, users!inner(wallet_address)')
    .order('score', { ascending: false })
    .limit(50);

  const leaders = topTraders?.map(t => t.users?.wallet_address?.toLowerCase()) || [];

  console.log('=== TOP 50 MONITORED LEADERS ===');
  console.log('Count:', leaders.length);
  console.log('');

  // Check specific leader
  const targetLeader = '0x3b0d77abe5ff32cfaf72d92a1aafbf4d60097626'.toLowerCase();
  const isMonitored = leaders.includes(targetLeader);

  console.log('=== TARGET LEADER CHECK ===');
  console.log('Leader:', targetLeader);
  console.log('Is in top 50:', isMonitored);

  // Find their rank
  const { data: allTraders } = await supabase
    .from('user_platform_stats')
    .select('user_id, score, users!inner(wallet_address)')
    .order('score', { ascending: false });

  const rank = allTraders?.findIndex(t => t.users?.wallet_address?.toLowerCase() === targetLeader);
  console.log('Actual rank:', rank !== -1 ? rank + 1 : 'Not in leaderboard');

  if (rank !== -1 && allTraders) {
    console.log('Score:', allTraders[rank].score);
  }

  // Show top 10 for reference
  console.log('');
  console.log('=== TOP 10 LEADERS (for reference) ===');
  for (let i = 0; i < Math.min(10, topTraders?.length || 0); i++) {
    console.log(`${i+1}. ${topTraders[i].users?.wallet_address} (score: ${topTraders[i].score})`);
  }
}

check().catch(console.error);
