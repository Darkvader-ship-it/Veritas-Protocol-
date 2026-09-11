/**
 * Database Setup Script
 *
 * Creates required tables for VeritasBOT
 * Run with: npm run db:setup
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

const migrations = [
  {
    name: 'trending_topics',
    sql: `
      CREATE TABLE IF NOT EXISTS trending_topics (
        id SERIAL PRIMARY KEY,
        topic TEXT NOT NULL,
        normalized_topic TEXT NOT NULL UNIQUE,
        score DECIMAL(10,2) DEFAULT 0,
        velocity DECIMAL(10,2) DEFAULT 0,
        total_volume DECIMAL(20,2) DEFAULT 0,
        total_markets INTEGER DEFAULT 0,
        category TEXT,
        platforms TEXT[],
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_tt_normalized ON trending_topics(normalized_topic);
      CREATE INDEX IF NOT EXISTS idx_tt_score ON trending_topics(score DESC);
      CREATE INDEX IF NOT EXISTS idx_tt_updated ON trending_topics(updated_at);
    `,
  },
  {
    name: 'cross_platform_signals',
    sql: `
      CREATE TABLE IF NOT EXISTS cross_platform_signals (
        id SERIAL PRIMARY KEY,
        topic TEXT NOT NULL,
        normalized_topic TEXT NOT NULL,
        consensus TEXT NOT NULL,
        confidence DECIMAL(5,2),
        volume_weighted_probability DECIMAL(5,4),
        smart_money_agreement DECIMAL(5,4),
        platforms TEXT[],
        total_volume DECIMAL(20,2) DEFAULT 0,
        market_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ
      );

      CREATE INDEX IF NOT EXISTS idx_cps_topic ON cross_platform_signals(normalized_topic);
      CREATE INDEX IF NOT EXISTS idx_cps_consensus ON cross_platform_signals(consensus);
      CREATE INDEX IF NOT EXISTS idx_cps_created ON cross_platform_signals(created_at);
    `,
  },
  {
    name: 'smart_money_signals',
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

      CREATE INDEX IF NOT EXISTS idx_sms_platform ON smart_money_signals(platform);
      CREATE INDEX IF NOT EXISTS idx_sms_created_at ON smart_money_signals(created_at);
    `,
  },
  {
    name: 'gaming_alerts',
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

      CREATE INDEX IF NOT EXISTS idx_ga_status ON gaming_alerts(status);
      CREATE INDEX IF NOT EXISTS idx_ga_type ON gaming_alerts(alert_type);
      CREATE INDEX IF NOT EXISTS idx_ga_created_at ON gaming_alerts(created_at);
    `,
  },
  {
    name: 'backtest_cache',
    sql: `
      CREATE TABLE IF NOT EXISTS backtest_cache (
        id SERIAL PRIMARY KEY,
        leader TEXT NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        settings JSONB NOT NULL,
        result JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(leader, start_date, end_date, settings)
      );

      CREATE INDEX IF NOT EXISTS idx_bc_leader ON backtest_cache(leader);
      CREATE INDEX IF NOT EXISTS idx_bc_created_at ON backtest_cache(created_at);
    `,
  },
];

async function runMigrations(): Promise<void> {
  console.log('Running database migrations...\n');

  for (const migration of migrations) {
    console.log(`Running migration: ${migration.name}`);

    try {
      // Note: Direct SQL execution requires using the SQL editor in Supabase dashboard
      // or using a PostgreSQL client. This script outputs the SQL for manual execution.
      console.log(`\nSQL for ${migration.name}:`);
      console.log('─'.repeat(50));
      console.log(migration.sql);
      console.log('─'.repeat(50));
      console.log('');
    } catch (error) {
      console.error(`Migration ${migration.name} failed:`, error);
    }
  }

  console.log('\n===========================================');
  console.log('To apply these migrations:');
  console.log('1. Go to your Supabase project dashboard');
  console.log('2. Navigate to SQL Editor');
  console.log('3. Copy and paste each SQL block above');
  console.log('4. Click "Run" for each migration');
  console.log('===========================================\n');

  // Verify tables exist
  console.log('Verifying existing tables...\n');

  const tables = ['smart_money_signals', 'gaming_alerts', 'backtest_cache'];

  for (const table of tables) {
    const { error } = await supabase.from(table).select('id').limit(1);

    if (error?.message.includes('does not exist')) {
      console.log(`❌ ${table} - NOT FOUND (run migration)`);
    } else if (error) {
      console.log(`⚠️  ${table} - Error: ${error.message}`);
    } else {
      console.log(`✅ ${table} - EXISTS`);
    }
  }

  console.log('\nDone!');
}

runMigrations().catch(console.error);
