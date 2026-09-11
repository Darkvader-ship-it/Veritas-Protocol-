import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function GET() {
  const results: { table: string; status: string; error?: string }[] = [];

  const tables = [
    {
      name: 'unified_markets',
      sql: `CREATE TABLE IF NOT EXISTS unified_markets (
        id TEXT PRIMARY KEY,
        platform TEXT NOT NULL,
        external_id TEXT NOT NULL,
        title TEXT NOT NULL,
        question TEXT,
        description TEXT,
        category TEXT DEFAULT 'General',
        outcomes JSONB DEFAULT '[]'::jsonb,
        status TEXT DEFAULT 'open',
        yes_price DECIMAL(10,6),
        no_price DECIMAL(10,6),
        volume DECIMAL(20,2) DEFAULT 0,
        volume_24h DECIMAL(20,2) DEFAULT 0,
        liquidity DECIMAL(20,2) DEFAULT 0,
        expires_at TIMESTAMPTZ,
        closes_at TIMESTAMPTZ,
        resolved_at TIMESTAMPTZ,
        winning_outcome TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        chain TEXT,
        currency TEXT,
        fetched_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(platform, external_id)
      )`
    },
    {
      name: 'market_sync_status',
      sql: `CREATE TABLE IF NOT EXISTS market_sync_status (
        platform TEXT PRIMARY KEY,
        last_sync_at TIMESTAMPTZ,
        markets_count INTEGER DEFAULT 0,
        total_volume DECIMAL(20,2) DEFAULT 0,
        status TEXT DEFAULT 'idle',
        error TEXT,
        duration_ms INTEGER,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`
    },
    {
      name: 'limitless_simulated_trades',
      sql: `CREATE TABLE IF NOT EXISTS limitless_simulated_trades (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        follower TEXT NOT NULL,
        market_id TEXT NOT NULL,
        market_slug TEXT,
        market_question TEXT,
        category TEXT DEFAULT 'General',
        position TEXT NOT NULL,
        amount_usd DECIMAL(10,2) NOT NULL,
        price_at_entry DECIMAL(10,6),
        potential_payout DECIMAL(10,2),
        outcome TEXT DEFAULT 'pending',
        pnl_usd DECIMAL(10,2),
        expires_at TIMESTAMPTZ,
        simulated_at TIMESTAMPTZ DEFAULT NOW(),
        resolved_at TIMESTAMPTZ,
        UNIQUE(follower, market_id)
      )`
    },
    {
      name: 'azuro_simulated_trades',
      sql: `CREATE TABLE IF NOT EXISTS azuro_simulated_trades (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        follower TEXT NOT NULL,
        market_id TEXT NOT NULL,
        condition_id TEXT,
        game_id TEXT,
        sport TEXT,
        league TEXT,
        title TEXT,
        position TEXT NOT NULL,
        amount_usd DECIMAL(10,2) NOT NULL,
        odds DECIMAL(10,4),
        potential_payout DECIMAL(10,2),
        outcome TEXT DEFAULT 'pending',
        pnl_usd DECIMAL(10,2),
        starts_at TIMESTAMPTZ,
        simulated_at TIMESTAMPTZ DEFAULT NOW(),
        resolved_at TIMESTAMPTZ,
        UNIQUE(follower, market_id)
      )`
    },
    {
      name: 'sxbet_simulated_trades',
      sql: `CREATE TABLE IF NOT EXISTS sxbet_simulated_trades (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        follower TEXT NOT NULL,
        market_hash TEXT NOT NULL,
        sport TEXT,
        league TEXT,
        team_one TEXT,
        team_two TEXT,
        market_type TEXT,
        position TEXT NOT NULL,
        amount_usd DECIMAL(10,2) NOT NULL,
        odds DECIMAL(10,4),
        potential_payout DECIMAL(10,2),
        outcome TEXT DEFAULT 'pending',
        pnl_usd DECIMAL(10,2),
        game_time TIMESTAMPTZ,
        simulated_at TIMESTAMPTZ DEFAULT NOW(),
        resolved_at TIMESTAMPTZ,
        UNIQUE(follower, market_hash)
      )`
    },
    {
      name: 'gnosis_simulated_trades',
      sql: `CREATE TABLE IF NOT EXISTS gnosis_simulated_trades (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        follower TEXT NOT NULL,
        market_id TEXT NOT NULL,
        condition_id TEXT,
        question_id TEXT,
        title TEXT,
        category TEXT DEFAULT 'General',
        position TEXT NOT NULL,
        outcome_label TEXT,
        amount DECIMAL(18,6) NOT NULL,
        odds_at_entry DECIMAL(10,4),
        potential_payout DECIMAL(18,6),
        resolves_at TIMESTAMPTZ,
        collateral_token TEXT DEFAULT 'xDAI',
        outcome TEXT DEFAULT 'pending',
        pnl DECIMAL(18,6),
        simulated_at TIMESTAMPTZ DEFAULT NOW(),
        resolved_at TIMESTAMPTZ,
        UNIQUE(follower, market_id)
      )`
    },
    {
      name: 'drift_simulated_trades',
      sql: `CREATE TABLE IF NOT EXISTS drift_simulated_trades (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        follower TEXT NOT NULL,
        market_id TEXT NOT NULL,
        market_index INTEGER,
        symbol TEXT,
        title TEXT,
        category TEXT DEFAULT 'Crypto',
        position TEXT NOT NULL,
        amount_usdc DECIMAL(18,6) NOT NULL,
        price_at_entry DECIMAL(10,6),
        oracle_price DECIMAL(18,6),
        potential_payout DECIMAL(18,6),
        outcome TEXT DEFAULT 'pending',
        pnl_usdc DECIMAL(18,6),
        simulated_at TIMESTAMPTZ DEFAULT NOW(),
        resolved_at TIMESTAMPTZ,
        UNIQUE(follower, market_id)
      )`
    },
    {
      name: 'kalshi_simulated_trades',
      sql: `CREATE TABLE IF NOT EXISTS kalshi_simulated_trades (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        follower TEXT NOT NULL,
        market_id TEXT NOT NULL,
        ticker TEXT,
        event_ticker TEXT,
        title TEXT,
        subtitle TEXT,
        category TEXT DEFAULT 'Events',
        position TEXT NOT NULL,
        amount_usd DECIMAL(18,6) NOT NULL,
        price_at_entry DECIMAL(10,6),
        yes_price DECIMAL(10,6),
        potential_payout DECIMAL(18,6),
        close_time TIMESTAMPTZ,
        outcome TEXT DEFAULT 'pending',
        pnl_usd DECIMAL(18,6),
        simulated_at TIMESTAMPTZ DEFAULT NOW(),
        resolved_at TIMESTAMPTZ,
        UNIQUE(follower, market_id)
      )`
    },
    {
      name: 'manifold_simulated_trades',
      sql: `CREATE TABLE IF NOT EXISTS manifold_simulated_trades (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        follower TEXT NOT NULL,
        market_id TEXT NOT NULL,
        slug TEXT,
        question TEXT,
        category TEXT DEFAULT 'General',
        position TEXT NOT NULL,
        outcome_label TEXT,
        amount_mana DECIMAL(18,2) NOT NULL,
        probability_at_entry DECIMAL(10,6),
        potential_payout DECIMAL(18,2),
        close_time TIMESTAMPTZ,
        creator_username TEXT,
        outcome TEXT DEFAULT 'pending',
        pnl_mana DECIMAL(18,2),
        simulated_at TIMESTAMPTZ DEFAULT NOW(),
        resolved_at TIMESTAMPTZ,
        UNIQUE(follower, market_id)
      )`
    },
    {
      name: 'metaculus_simulated_trades',
      sql: `CREATE TABLE IF NOT EXISTS metaculus_simulated_trades (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        follower TEXT NOT NULL,
        question_id TEXT NOT NULL,
        title TEXT,
        description TEXT,
        category TEXT DEFAULT 'General',
        position TEXT NOT NULL,
        prediction DECIMAL(10,6) NOT NULL,
        community_prediction DECIMAL(10,6),
        amount_points DECIMAL(18,2) NOT NULL,
        potential_score DECIMAL(18,2),
        resolves_at TIMESTAMPTZ,
        outcome TEXT DEFAULT 'pending',
        score DECIMAL(18,2),
        actual_outcome DECIMAL(10,6),
        simulated_at TIMESTAMPTZ DEFAULT NOW(),
        resolved_at TIMESTAMPTZ,
        UNIQUE(follower, question_id)
      )`
    }
  ];

  for (const table of tables) {
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: table.sql });

      if (error) {
        // Try direct query if RPC fails
        const { error: directError } = await supabase.from(table.name).select('id').limit(1);

        if (directError?.message?.includes('does not exist')) {
          results.push({ table: table.name, status: 'NEEDS_MANUAL_CREATION', error: 'Run SQL manually in Supabase dashboard' });
        } else {
          results.push({ table: table.name, status: 'EXISTS' });
        }
      } else {
        results.push({ table: table.name, status: 'CREATED' });
      }
    } catch (e: any) {
      results.push({ table: table.name, status: 'ERROR', error: e.message });
    }
  }

  return NextResponse.json({
    message: 'Table setup check complete',
    results,
    instructions: 'If tables need manual creation, paste create-tables.sql into Supabase SQL Editor'
  });
}
