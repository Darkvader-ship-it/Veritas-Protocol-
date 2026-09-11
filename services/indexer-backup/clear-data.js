import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function clearData() {
  console.log('🗑️  Clearing ALL data...');

  // Delete in order due to foreign keys
  // Use gt('id', '') to match all UUIDs
  const { error: e1 } = await supabase.from('copy_trades').delete().gte('id', '00000000-0000-0000-0000-000000000000');
  console.log('  copy_trades:', e1 ? e1.message : 'cleared');

  const { error: e2 } = await supabase.from('copy_follows').delete().gte('id', '00000000-0000-0000-0000-000000000000');
  console.log('  copy_follows:', e2 ? e2.message : 'cleared');

  const { error: e3 } = await supabase.from('bets').delete().gte('id', '00000000-0000-0000-0000-000000000000');
  console.log('  bets:', e3 ? e3.message : 'cleared');

  const { error: e4 } = await supabase.from('user_platform_stats').delete().gte('id', '00000000-0000-0000-0000-000000000000');
  console.log('  user_platform_stats:', e4 ? e4.message : 'cleared');

  const { error: e5 } = await supabase.from('users').delete().gte('id', '00000000-0000-0000-0000-000000000000');
  console.log('  users:', e5 ? e5.message : 'cleared');

  // Verify
  const { count } = await supabase.from('users').select('*', { count: 'exact', head: true });
  console.log(`\n✅ Users remaining: ${count}`);
}

clearData();
