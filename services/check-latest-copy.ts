import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function check() {
  // Get the most recent test bet
  const { data: recentBets } = await supabase
    .from('bets')
    .select('id, user_id, amount, position, market_id, created_at')
    .like('market_id', 'test_epoch_%')
    .order('created_at', { ascending: false })
    .limit(3);

  console.log(`\nRecent test bets (${recentBets?.length || 0}):`);

  if (!recentBets || recentBets.length === 0) {
    console.log('No test bets found');
    return;
  }

  for (const bet of recentBets) {
    console.log(`\n📊 Bet ID: ${bet.id}`);
    console.log(`   Amount: ${(Number(bet.amount) / 1e18).toFixed(4)} STT`);
    console.log(`   Position: ${bet.position}`);
    console.log(`   Market: ${bet.market_id}`);
    console.log(`   Created: ${new Date(bet.created_at).toLocaleTimeString()}`);

    // Check for copy trades
    const { data: copyTrades } = await supabase
      .from('copy_trades')
      .select(`
        *,
        copied_bet:copied_bet_id(id, amount, position)
      `)
      .eq('original_bet_id', bet.id);

    if (copyTrades && copyTrades.length > 0) {
      console.log(`   ✅ Copy bet created! (${copyTrades.length})`);
      copyTrades.forEach((ct: any) => {
        console.log(`      Copy Amount: ${(Number(ct.copied_bet.amount) / 1e18).toFixed(4)} STT`);
      });
    } else {
      console.log(`   ⚠️  No copy bet yet`);
    }
  }
}

check().then(() => process.exit(0)).catch(console.error);
