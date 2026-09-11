import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function cleanupSampleData() {
  console.log('🧹 Starting database cleanup...\n');

  // First, let's see what we have
  const { data: allUsers } = await supabase
    .from('users')
    .select('id, wallet_address, username');

  console.log(`Total users in database: ${allUsers?.length || 0}`);

  const usersWithUsernames = allUsers?.filter(u => u.username) || [];
  const realUsers = allUsers?.filter(u => !u.username) || [];

  console.log(`  - Real users (no username): ${realUsers.length}`);
  console.log(`  - Sample users (with username): ${usersWithUsernames.length}\n`);

  if (usersWithUsernames.length === 0) {
    console.log('✅ No sample data found. Database is clean!');
    return;
  }

  console.log('Sample users to be removed:');
  usersWithUsernames.forEach(u => {
    console.log(`  - ${u.username} (${u.wallet_address})`);
  });

  console.log('\n⚠️  This will delete:');
  console.log(`  - ${usersWithUsernames.length} sample users`);
  console.log('  - All bets associated with these users');
  console.log('  - All copy trading data for these users\n');

  // Get bet counts
  const sampleUserIds = usersWithUsernames.map(u => u.id);

  const { data: sampleBets } = await supabase
    .from('bets')
    .select('id')
    .in('user_id', sampleUserIds);

  console.log(`  - ${sampleBets?.length || 0} sample bets will be deleted\n`);

  // Step 1: Delete copy trades related to sample users
  console.log('Step 1: Deleting copy trades...');
  const { error: copyTradesError } = await supabase
    .from('copy_trades')
    .delete()
    .in('user_id', sampleUserIds);

  if (copyTradesError) {
    console.error('❌ Error deleting copy trades:', copyTradesError);
  } else {
    console.log('✅ Copy trades deleted');
  }

  // Step 2: Delete copy follows related to sample users
  console.log('\nStep 2: Deleting copy follows...');
  const { error: copyFollowsError1 } = await supabase
    .from('copy_follows')
    .delete()
    .in('user_id', sampleUserIds);

  const { error: copyFollowsError2 } = await supabase
    .from('copy_follows')
    .delete()
    .in('trader_id', sampleUserIds);

  if (copyFollowsError1 || copyFollowsError2) {
    console.error('❌ Error deleting copy follows:', copyFollowsError1 || copyFollowsError2);
  } else {
    console.log('✅ Copy follows deleted');
  }

  // Step 3: Delete bets
  console.log('\nStep 3: Deleting sample bets...');
  const { error: betsError } = await supabase
    .from('bets')
    .delete()
    .in('user_id', sampleUserIds);

  if (betsError) {
    console.error('❌ Error deleting bets:', betsError);
  } else {
    console.log(`✅ Deleted ${sampleBets?.length || 0} sample bets`);
  }

  // Step 4: Delete user_platform_stats (if it exists)
  console.log('\nStep 4: Deleting user platform stats...');
  const { error: statsError } = await supabase
    .from('user_platform_stats')
    .delete()
    .in('user_id', sampleUserIds);

  if (statsError && !statsError.message?.includes('does not exist')) {
    console.error('❌ Error deleting stats:', statsError);
  } else {
    console.log('✅ User platform stats deleted');
  }

  // Step 5: Delete sample users
  console.log('\nStep 5: Deleting sample users...');
  const { error: usersError } = await supabase
    .from('users')
    .delete()
    .in('id', sampleUserIds);

  if (usersError) {
    console.error('❌ Error deleting users:', usersError);
  } else {
    console.log(`✅ Deleted ${usersWithUsernames.length} sample users`);
  }

  // Verify cleanup
  console.log('\n📊 Verification:');
  const { data: remainingUsers } = await supabase
    .from('users')
    .select('id, wallet_address, username');

  const stillHaveUsernames = remainingUsers?.filter(u => u.username) || [];

  console.log(`  - Total users remaining: ${remainingUsers?.length || 0}`);
  console.log(`  - Users with usernames: ${stillHaveUsernames.length}`);
  console.log(`  - Real blockchain users: ${remainingUsers?.length || 0}\n`);

  if (stillHaveUsernames.length === 0) {
    console.log('✅ Cleanup complete! Database now contains only real blockchain data.');
  } else {
    console.log('⚠️  Some sample users still remain. You may need to run this again.');
  }

  // Show some real users
  console.log('\n📋 Sample of remaining real users:');
  remainingUsers?.slice(0, 5).forEach(u => {
    console.log(`  - ${u.wallet_address}`);
  });
}

cleanupSampleData()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
