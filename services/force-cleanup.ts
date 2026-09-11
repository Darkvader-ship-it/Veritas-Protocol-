import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function forceCleanup() {
  console.log('🧹 Force cleanup of sample data...\n');

  // Simply delete all users with usernames
  const { data: deletedUsers, error } = await supabase
    .from('users')
    .delete()
    .not('username', 'is', null)
    .select();

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`✅ Deleted ${deletedUsers?.length || 0} sample users\n`);

  // Verify
  const { data: remaining } = await supabase
    .from('users')
    .select('id, wallet_address, username');

  const stillHaveUsernames = remaining?.filter(u => u.username) || [];

  console.log('📊 Final count:');
  console.log(`  - Total users: ${remaining?.length || 0}`);
  console.log(`  - With usernames: ${stillHaveUsernames.length}`);
  console.log(`  - Real users: ${remaining?.length || 0}\n`);

  if (stillHaveUsernames.length === 0) {
    console.log('✅ Success! All sample data removed.');
  }
}

forceCleanup()
  .then(() => process.exit(0))
  .catch(console.error);
