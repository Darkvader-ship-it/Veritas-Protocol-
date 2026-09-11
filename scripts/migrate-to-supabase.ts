/**
 * Migration script to populate Supabase database with existing indexed data
 *
 * This script reads from your existing JSON data files and populates the Supabase database.
 * Run this once after setting up Supabase to migrate your existing data.
 *
 * Usage:
 *   npm install -D tsx
 *   tsx scripts/migrate-to-supabase.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface UserData {
  address: string;
  platforms: {
    [platformName: string]: {
      bets: any[];
      stats: {
        totalBets: number;
        wins: number;
        losses: number;
        volume: string;
        winRate: number;
      };
    };
  };
}

async function migrate() {
  console.log('🚀 Starting migration to Supabase...\n');

  try {
    // Step 1: Verify platforms exist
    console.log('1️⃣ Verifying platforms...');
    const { data: platforms, error: platformsError } = await supabase
      .from('platforms')
      .select('*');

    if (platformsError) {
      throw new Error(`Failed to fetch platforms: ${platformsError.message}`);
    }

    if (!platforms || platforms.length === 0) {
      throw new Error('No platforms found! Did you run the schema.sql?');
    }

    console.log(`   ✅ Found ${platforms.length} platforms:`);
    platforms.forEach((p: any) => {
      console.log(`      - ${p.name} (${p.chain})`);
    });

    // Step 2: Read indexed data
    console.log('\n2️⃣ Reading indexed data...');

    // Check for different possible data file locations
    const possibleDataFiles = [
      path.join(process.cwd(), 'frontend', 'public', 'data', 'real-users.json'),
      path.join(process.cwd(), 'frontend', 'public', 'data', 'real-users-sample.json'),
      path.join(process.cwd(), 'public', 'data', 'real-users.json'),
      path.join(process.cwd(), 'data', 'indexed-users.json'),
    ];

    let userData: UserData[] = [];
    let dataFile: string | null = null;

    for (const file of possibleDataFiles) {
      if (fs.existsSync(file)) {
        dataFile = file;
        const rawData = fs.readFileSync(file, 'utf-8');
        userData = JSON.parse(rawData);
        break;
      }
    }

    if (!dataFile || userData.length === 0) {
      console.log('   ⚠️  No indexed data found. Using sample data instead.');
      userData = generateSampleData();
    } else {
      console.log(`   ✅ Loaded ${userData.length} users from ${dataFile}`);
    }

    // Step 3: Migrate users
    console.log('\n3️⃣ Migrating users...');
    let usersCreated = 0;

    for (const user of userData) {
      const { data: dbUser, error: userError } = await supabase
        .from('users')
        .upsert(
          { wallet_address: user.address.toLowerCase() },
          { onConflict: 'wallet_address' }
        )
        .select()
        .single();

      if (userError) {
        console.error(`   ❌ Failed to create user ${user.address}: ${userError.message}`);
        continue;
      }

      usersCreated++;

      // Step 4: Migrate bets and stats for each platform
      for (const [platformName, platformData] of Object.entries(user.platforms)) {
        const platform = platforms.find((p: any) => p.name === platformName);
        if (!platform) {
          console.warn(`   ⚠️  Platform "${platformName}" not found, skipping`);
          continue;
        }

        // Insert bets
        if (platformData.bets && platformData.bets.length > 0) {
          const betsToInsert = platformData.bets.map((bet: any) => ({
            user_id: dbUser.id,
            platform_id: platform.id,
            market_id: bet.marketId || bet.epoch || 'unknown',
            position: bet.position || bet.outcome || 'Unknown',
            amount: bet.amount || '0',
            claimed_amount: bet.claimedAmount || null,
            won: bet.won || null,
            tx_hash: bet.txHash || null,
            block_number: bet.blockNumber || null,
            timestamp: bet.timestamp ? new Date(bet.timestamp * 1000) : new Date(),
          }));

          const { error: betsError } = await supabase
            .from('bets')
            .upsert(betsToInsert, { onConflict: 'tx_hash', ignoreDuplicates: true });

          if (betsError) {
            console.error(`   ❌ Failed to insert bets for ${user.address}: ${betsError.message}`);
          }
        }

        // Insert/update platform stats
        const { error: statsError } = await supabase
          .from('user_platform_stats')
          .upsert({
            user_id: dbUser.id,
            platform_id: platform.id,
            total_bets: platformData.stats.totalBets,
            wins: platformData.stats.wins,
            losses: platformData.stats.losses,
            win_rate: platformData.stats.winRate,
            volume: platformData.stats.volume,
            score: Math.max(0, platformData.stats.wins * 10 - platformData.stats.losses * 3),
            last_updated: new Date(),
          }, {
            onConflict: 'user_id,platform_id'
          });

        if (statsError) {
          console.error(`   ❌ Failed to insert stats for ${user.address}: ${statsError.message}`);
        }
      }

      if (usersCreated % 10 === 0) {
        console.log(`   📊 Progress: ${usersCreated}/${userData.length} users migrated`);
      }
    }

    console.log(`\n   ✅ Migrated ${usersCreated} users`);

    // Step 5: Refresh materialized view
    console.log('\n4️⃣ Refreshing leaderboard view...');
    const { error: refreshError } = await supabase.rpc('refresh_leaderboard');

    if (refreshError) {
      console.warn(`   ⚠️  Failed to refresh leaderboard: ${refreshError.message}`);
      console.log('   💡 You may need to grant EXECUTE permission on refresh_leaderboard()');
    } else {
      console.log('   ✅ Leaderboard view refreshed');
    }

    // Step 6: Verify data
    console.log('\n5️⃣ Verifying migration...');
    const { count: userCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    const { count: betCount } = await supabase
      .from('bets')
      .select('*', { count: 'exact', head: true });

    const { count: statsCount } = await supabase
      .from('user_platform_stats')
      .select('*', { count: 'exact', head: true });

    console.log('   📊 Database Summary:');
    console.log(`      - Users: ${userCount}`);
    console.log(`      - Bets: ${betCount}`);
    console.log(`      - Platform Stats: ${statsCount}`);

    console.log('\n✅ Migration complete!\n');
    console.log('📝 Next steps:');
    console.log('   1. Visit http://localhost:3000/api/leaderboard-db to test the new endpoint');
    console.log('   2. Update your frontend to use /api/leaderboard-db instead of /api/leaderboard');
    console.log('   3. Configure your indexers to write directly to Supabase');

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

function generateSampleData(): UserData[] {
  const sampleAddresses = [
    '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1',
    '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199',
    '0xdD2FD4581271e230360230F9337D5c0430Bf44C0',
  ];

  return sampleAddresses.map((address, idx) => ({
    address,
    platforms: {
      'DreamDEX Event Contracts': {
        bets: [
          {
            marketId: `${12345 + idx}`,
            position: 'Bull',
            amount: (0.1 * Math.pow(10, 18)).toString(),
            won: true,
            claimedAmount: (0.19 * Math.pow(10, 18)).toString(),
            timestamp: Math.floor(Date.now() / 1000) - 86400,
            txHash: `0x${idx}abc123`,
          },
        ],
        stats: {
          totalBets: 10 + idx * 5,
          wins: 6 + idx * 2,
          losses: 4 + idx,
          volume: ((10 + idx * 5) * 0.1 * Math.pow(10, 18)).toString(),
          winRate: ((6 + idx * 2) / (10 + idx * 5)) * 100,
        },
      },
    },
  }));
}

// Run migration
migrate();
