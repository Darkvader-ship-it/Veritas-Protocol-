/**
 * Seed Test Data Script
 *
 * Populates the database with test data for VeritasBOT dashboard.
 * Run with: npx tsx scripts/seed-data.ts
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ===========================================
// Helpers
// ===========================================

function randomAddress(): string {
  const chars = '0123456789abcdef';
  let addr = '0x';
  for (let i = 0; i < 40; i++) {
    addr += chars[Math.floor(Math.random() * chars.length)];
  }
  return addr;
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

// ===========================================
// Table Creation (for missing tables)
// ===========================================

async function createMissingTables() {
  console.log('📋 Creating missing tables...');

  // smart_money_signals
  const { error: e1 } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS smart_money_signals (
        id SERIAL PRIMARY KEY,
        epoch INTEGER NOT NULL,
        platform TEXT NOT NULL,
        consensus TEXT NOT NULL,
        confidence DECIMAL(5,2),
        weighted_bull_percent DECIMAL(5,2),
        participating_traders INTEGER,
        signal_strength TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(epoch, platform)
      );
    `
  });

  // gaming_alerts
  const { error: e2 } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS gaming_alerts (
        id SERIAL PRIMARY KEY,
        alert_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        wallets TEXT[] NOT NULL,
        evidence JSONB,
        recommended_action TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        reviewed_at TIMESTAMPTZ,
        reviewed_by TEXT,
        notes TEXT
      );
    `
  });

  // If RPC doesn't work, tables may need manual creation
  if (e1 || e2) {
    console.log('   ⚠️ Could not auto-create tables (need manual creation or RPC not available)');
    console.log('   Run this SQL in Supabase SQL Editor:');
    console.log(`
-- Smart Money Signals Table
CREATE TABLE IF NOT EXISTS smart_money_signals (
  id SERIAL PRIMARY KEY,
  epoch INTEGER NOT NULL,
  platform TEXT NOT NULL,
  consensus TEXT NOT NULL,
  confidence DECIMAL(5,2),
  weighted_bull_percent DECIMAL(5,2),
  participating_traders INTEGER,
  signal_strength TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(epoch, platform)
);

-- Gaming Alerts Table
CREATE TABLE IF NOT EXISTS gaming_alerts (
  id SERIAL PRIMARY KEY,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  wallets TEXT[] NOT NULL,
  evidence JSONB,
  recommended_action TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  notes TEXT
);
    `);
  } else {
    console.log('   ✅ Tables created');
  }
}

// ===========================================
// Data Generators
// ===========================================

function generateTraders(count: number) {
  const traders = [];
  const tiers = [
    { tier: 'DIAMOND', scoreMin: 5000, scoreMax: 10000, count: Math.ceil(count * 0.05) },
    { tier: 'PLATINUM', scoreMin: 2000, scoreMax: 4999, count: Math.ceil(count * 0.1) },
    { tier: 'GOLD', scoreMin: 1000, scoreMax: 1999, count: Math.ceil(count * 0.2) },
    { tier: 'SILVER', scoreMin: 500, scoreMax: 999, count: Math.ceil(count * 0.25) },
    { tier: 'BRONZE', scoreMin: 100, scoreMax: 499, count: Math.ceil(count * 0.4) },
  ];

  for (const tierConfig of tiers) {
    for (let i = 0; i < tierConfig.count; i++) {
      const totalBets = randomBetween(50, 500);
      const baseWinRate = tierConfig.tier === 'DIAMOND' ? 0.65 :
                         tierConfig.tier === 'PLATINUM' ? 0.58 :
                         tierConfig.tier === 'GOLD' ? 0.54 :
                         tierConfig.tier === 'SILVER' ? 0.51 : 0.48;
      const winRate = baseWinRate + randomFloat(-0.05, 0.05);
      const wins = Math.floor(totalBets * winRate);

      traders.push({
        address: randomAddress(),
        score: randomBetween(tierConfig.scoreMin, tierConfig.scoreMax),
        totalBets,
        wins,
        losses: totalBets - wins,
        winRate: (wins / totalBets) * 100,
        volume: BigInt(randomBetween(1, 100)) * BigInt(1e18),
        tier: tierConfig.tier,
      });
    }
  }

  return traders;
}

function generateSignals(count: number) {
  const signals = [];
  const baseEpoch = 442000; // Recent epochs

  for (let i = 0; i < count; i++) {
    const epoch = baseEpoch + i;
    const bullPercent = randomFloat(20, 80);
    const consensus = bullPercent > 60 ? 'BULL' : bullPercent < 40 ? 'BEAR' : 'NEUTRAL';
    const confidence = Math.abs(bullPercent - 50) * 2;
    const traders = randomBetween(3, 15);
    const strength = confidence >= 70 && traders >= 5 ? 'STRONG' :
                    confidence >= 50 && traders >= 3 ? 'MODERATE' : 'WEAK';

    signals.push({
      epoch,
      platform: 'dreamdex',
      consensus,
      confidence,
      weighted_bull_percent: bullPercent,
      participating_traders: traders,
      signal_strength: strength,
      created_at: new Date(Date.now() - (count - i) * 5 * 60 * 1000),
    });
  }

  return signals;
}

function generateAlerts() {
  return [
    {
      alert_type: 'WASH_TRADING',
      severity: 'CRITICAL',
      wallets: [randomAddress(), randomAddress()],
      evidence: {
        description: 'Detected 5 epochs with bets on both sides',
        dataPoints: { washEpochCount: 5 },
        epochs: [442100, 442105, 442110, 442115, 442120],
      },
      recommended_action: 'FLAG',
      status: 'pending',
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000),
    },
    {
      alert_type: 'SYBIL_CLUSTER',
      severity: 'WARNING',
      wallets: [randomAddress(), randomAddress(), randomAddress(), randomAddress()],
      evidence: {
        description: '4 wallets placed similar bets within 5 seconds',
        dataPoints: { clusterSize: 4, epoch: 442200, direction: 'BULL' },
        epochs: [442200],
      },
      recommended_action: 'INVESTIGATE',
      status: 'pending',
      created_at: new Date(Date.now() - 6 * 60 * 60 * 1000),
    },
    {
      alert_type: 'STATISTICAL_ANOMALY',
      severity: 'INFO',
      wallets: [randomAddress()],
      evidence: {
        description: 'Win rate of 78.5% is statistically improbable',
        dataPoints: { winRate: 0.785, totalBets: 200, zScore: 4.2, probabilityOfRandom: 0.00003 },
      },
      recommended_action: 'INVESTIGATE',
      status: 'pending',
      created_at: new Date(Date.now() - 12 * 60 * 60 * 1000),
    },
    {
      alert_type: 'COLLUSION',
      severity: 'WARNING',
      wallets: [randomAddress(), randomAddress()],
      evidence: {
        description: 'Wallets bet together in 85% of epochs',
        dataPoints: { coOccurrenceRate: 0.85, sharedEpochs: 42, totalEpochs: 50 },
      },
      recommended_action: 'INVESTIGATE',
      status: 'pending',
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000),
    },
  ];
}

// ===========================================
// Main Seed Function
// ===========================================

async function seed() {
  console.log('🌱 Seeding VeritasBOT test data...\n');

  // 1. Try to create missing tables
  await createMissingTables();

  // 2. Generate test traders
  console.log('\n📊 Generating test traders...');
  const traders = generateTraders(50);
  console.log(`   Generated ${traders.length} traders`);

  // 3. Insert users
  console.log('\n👤 Inserting users...');
  const users = traders.map(t => ({
    wallet_address: t.address.toLowerCase(),
    created_at: new Date(Date.now() - randomBetween(30, 180) * 24 * 60 * 60 * 1000),
  }));

  const { error: usersError } = await supabase
    .from('users')
    .upsert(users, { onConflict: 'wallet_address' });

  if (usersError) {
    console.error('   ❌ Error:', usersError.message);
  } else {
    console.log(`   ✅ Inserted ${users.length} users`);
  }

  // 4. Get user IDs
  console.log('\n🔗 Fetching user IDs...');
  const { data: userRows } = await supabase
    .from('users')
    .select('id, wallet_address')
    .in('wallet_address', users.map(u => u.wallet_address));

  const userIdMap = new Map((userRows || []).map(u => [u.wallet_address, u.id]));
  console.log(`   ✅ Found ${userIdMap.size} users`);

  // 5. Insert platform stats (matching actual schema: volume, win_rate, losses)
  console.log('\n📈 Inserting platform stats...');
  const stats = traders.map(t => ({
    user_id: userIdMap.get(t.address.toLowerCase()),
    platform_id: 1,
    score: t.score,
    total_bets: t.totalBets,
    wins: t.wins,
    losses: t.losses,
    win_rate: t.winRate,
    volume: t.volume.toString(),
  })).filter(s => s.user_id);

  const { error: statsError } = await supabase
    .from('user_platform_stats')
    .upsert(stats, { onConflict: 'user_id,platform_id' });

  if (statsError) {
    console.error('   ❌ Error:', statsError.message);
  } else {
    console.log(`   ✅ Inserted ${stats.length} platform stats`);
  }

  // 6. Insert signals
  console.log('\n📡 Inserting smart money signals...');
  const signals = generateSignals(30);

  const { error: signalsError } = await supabase
    .from('smart_money_signals')
    .upsert(signals, { onConflict: 'epoch,platform' });

  if (signalsError) {
    if (signalsError.message.includes('does not exist')) {
      console.log('   ⚠️ Table does not exist - create it manually (see SQL above)');
    } else {
      console.error('   ❌ Error:', signalsError.message);
    }
  } else {
    console.log(`   ✅ Inserted ${signals.length} signals`);
  }

  // 7. Insert alerts
  console.log('\n🚨 Inserting gaming alerts...');
  const alerts = generateAlerts();

  const { error: alertsError } = await supabase
    .from('gaming_alerts')
    .insert(alerts);

  if (alertsError) {
    if (alertsError.message.includes('does not exist')) {
      console.log('   ⚠️ Table does not exist - create it manually (see SQL above)');
    } else {
      console.error('   ❌ Error:', alertsError.message);
    }
  } else {
    console.log(`   ✅ Inserted ${alerts.length} alerts`);
  }

  // 8. Summary
  console.log('\n' + '═'.repeat(50));
  console.log('🎉 Seed complete!');
  console.log('═'.repeat(50));

  const tierCounts = {
    DIAMOND: traders.filter(t => t.tier === 'DIAMOND').length,
    PLATINUM: traders.filter(t => t.tier === 'PLATINUM').length,
    GOLD: traders.filter(t => t.tier === 'GOLD').length,
    SILVER: traders.filter(t => t.tier === 'SILVER').length,
    BRONZE: traders.filter(t => t.tier === 'BRONZE').length,
  };

  console.log(`
   Traders by tier:
   💎 Diamond:  ${tierCounts.DIAMOND}
   🔷 Platinum: ${tierCounts.PLATINUM}
   🥇 Gold:     ${tierCounts.GOLD}
   🥈 Silver:   ${tierCounts.SILVER}
   🥉 Bronze:   ${tierCounts.BRONZE}

   📡 Signals: ${signals.length}
   🚨 Alerts: ${alerts.length}

   Now refresh the dashboard at http://localhost:5173
`);
  console.log('═'.repeat(50) + '\n');
}

seed().catch(console.error);
