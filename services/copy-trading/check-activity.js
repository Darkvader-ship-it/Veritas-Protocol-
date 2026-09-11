const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkActivity() {
  const targetLeader = '0x3b0d77abe5ff32cfaf72d92a1aafbf4d60097626'.toLowerCase();

  // Get user ID
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .ilike('wallet_address', targetLeader)
    .single();

  if (!user) {
    console.log('Leader not found in database');
    return;
  }

  // Get their recent bets
  const { data: bets } = await supabase
    .from('bets')
    .select('*')
    .eq('user_id', user.id)
    .order('timestamp', { ascending: false })
    .limit(10);

  console.log('=== LEADER ACTIVITY ===');
  console.log('Address:', targetLeader);
  console.log('Recent bets:', bets?.length || 0);
  console.log('');

  if (bets && bets.length > 0) {
    console.log('Last 5 bets:');
    for (const bet of bets.slice(0, 5)) {
      const time = new Date(bet.timestamp);
      const ago = Math.round((Date.now() - time.getTime()) / (1000 * 60 * 60));
      console.log(`  Epoch ${bet.epoch} | ${bet.position.toUpperCase()} | ${ago} hours ago | Won: ${bet.won || 'pending'}`);
    }

    const lastBet = new Date(bets[0].timestamp);
    const hoursAgo = Math.round((Date.now() - lastBet.getTime()) / (1000 * 60 * 60));
    console.log('');
    console.log(`Last bet was ${hoursAgo} hours ago`);
  }
}

checkActivity().catch(console.error);
