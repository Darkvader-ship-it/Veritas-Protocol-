import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function check() {
  const betId = 'aa991287-4169-4882-ade4-7580c11f54d4';

  const { data: copyTrades } = await supabase
    .from('copy_trades')
    .select('*')
    .eq('original_bet_id', betId);

  console.log(`Copy trades for bet ${betId}: ${copyTrades?.length || 0}`);
  if (copyTrades && copyTrades.length > 0) {
    console.log('✅ SUCCESS! Copy bet created');
    console.log(JSON.stringify(copyTrades, null, 2));
  } else {
    console.log('⚠️  No copy bet yet');
  }
}

check().then(() => process.exit(0));
