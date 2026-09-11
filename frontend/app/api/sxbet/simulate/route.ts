import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export const dynamic = 'force-dynamic';

/**
 * POST /api/sxbet/simulate
 * Place a simulated bet on an SX Bet market
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      walletAddress,
      marketHash,
      sport,
      league,
      teamOne,
      teamTwo,
      outcome, // 1 or 2 (team one or team two)
      outcomeLabel,
      amount, // Amount in USD
      odds, // Decimal odds at time of bet
      gameTime,
      marketType, // Moneyline, Spread, Total
      line, // For spread/total bets
    } = body;

    if (!walletAddress || !marketHash || !outcome || !amount || !odds) {
      return NextResponse.json(
        { error: 'Missing required fields: walletAddress, marketHash, outcome, amount, odds' },
        { status: 400 }
      );
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }

    if (amountNum < 1) {
      return NextResponse.json(
        { error: 'Minimum bet is $1 USD' },
        { status: 400 }
      );
    }

    if (amountNum > 1000) {
      return NextResponse.json(
        { error: 'Maximum simulated bet is $1000 USD' },
        { status: 400 }
      );
    }

    // Check if user already has a bet on this market
    const { data: existing } = await supabase
      .from('sxbet_simulated_trades')
      .select('id')
      .eq('follower', walletAddress.toLowerCase())
      .eq('market_hash', marketHash)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'You already have a simulated bet on this market' },
        { status: 400 }
      );
    }

    // Calculate potential payout
    const potentialPayout = amountNum * parseFloat(odds);

    // Insert simulated trade
    const { data: trade, error } = await supabase
      .from('sxbet_simulated_trades')
      .insert({
        follower: walletAddress.toLowerCase(),
        market_hash: marketHash,
        sport: sport || 'Unknown',
        league: league || 'Unknown',
        team_one: teamOne,
        team_two: teamTwo,
        outcome: outcome, // 1 or 2
        outcome_label: outcomeLabel || `Outcome ${outcome}`,
        amount_usd: amountNum,
        odds_at_entry: parseFloat(odds),
        potential_payout: potentialPayout,
        game_time: gameTime ? new Date(gameTime).toISOString() : null,
        market_type: marketType || 'Moneyline',
        line: line || null,
        result: 'pending',
        simulated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting SX Bet simulated trade:', error);

      // Check if table doesn't exist
      if (error.code === '42P01' || error.code === 'PGRST205' || error.message?.includes('does not exist')) {
        return NextResponse.json(
          { error: 'SX Bet simulation not yet configured. Please create the sxbet_simulated_trades table.' },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to place simulated bet' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      trade: {
        id: trade.id,
        marketHash: trade.market_hash,
        sport: trade.sport,
        teamOne: trade.team_one,
        teamTwo: trade.team_two,
        outcome: trade.outcome,
        outcomeLabel: trade.outcome_label,
        amount: trade.amount_usd,
        odds: trade.odds_at_entry,
        potentialPayout: trade.potential_payout,
        marketType: trade.market_type,
        status: 'pending',
        simulatedAt: trade.simulated_at,
      },
      message: `Simulated $${amountNum} bet on ${outcomeLabel} at ${odds}x odds`,
    });
  } catch (error: any) {
    console.error('SX Bet simulate error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to place simulated bet' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sxbet/simulate
 * Get simulated SX Bet trades for a user
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const follower = searchParams.get('follower')?.toLowerCase();
  const marketHash = searchParams.get('marketHash');
  const limit = parseInt(searchParams.get('limit') || '50');
  const stats = searchParams.get('stats') === 'true';

  try {
    if (stats && follower) {
      // Return aggregated stats for a user
      const { data: trades, error } = await supabase
        .from('sxbet_simulated_trades')
        .select('result, pnl_usd, amount_usd')
        .eq('follower', follower);

      if (error) throw error;

      const wins = trades?.filter(t => t.result === 'win').length || 0;
      const losses = trades?.filter(t => t.result === 'loss').length || 0;
      const pending = trades?.filter(t => t.result === 'pending').length || 0;
      const totalTrades = trades?.length || 0;

      let totalPnl = 0;
      let totalVolume = 0;

      for (const t of trades || []) {
        if (t.pnl_usd) totalPnl += t.pnl_usd;
        if (t.amount_usd) totalVolume += t.amount_usd;
      }

      return NextResponse.json({
        follower,
        totalTrades,
        wins,
        losses,
        pending,
        winRate: wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : '0',
        totalPnlUsd: totalPnl.toFixed(2),
        totalVolumeUsd: totalVolume.toFixed(2),
      });
    }

    // Return individual trades
    let query = supabase
      .from('sxbet_simulated_trades')
      .select('*')
      .order('simulated_at', { ascending: false })
      .limit(limit);

    if (follower) {
      query = query.eq('follower', follower);
    }
    if (marketHash) {
      query = query.eq('market_hash', marketHash);
    }

    const { data: trades, error } = await query;

    if (error) throw error;

    const formatted = (trades || []).map(t => ({
      id: t.id,
      follower: t.follower,
      marketHash: t.market_hash,
      sport: t.sport,
      league: t.league,
      teamOne: t.team_one,
      teamTwo: t.team_two,
      outcome: t.outcome,
      outcomeLabel: t.outcome_label,
      amountUsd: t.amount_usd,
      oddsAtEntry: t.odds_at_entry,
      potentialPayout: t.potential_payout,
      marketType: t.market_type,
      line: t.line,
      result: t.result,
      pnlUsd: t.pnl_usd,
      simulatedAt: t.simulated_at,
      resolvedAt: t.resolved_at,
      gameTime: t.game_time,
    }));

    return NextResponse.json({
      trades: formatted,
      count: formatted.length,
    });
  } catch (error: any) {
    console.error('SX Bet simulate GET error:', error);

    // Handle missing table gracefully
    if (error.code === '42P01' || error.code === 'PGRST205' || error.message?.includes('does not exist')) {
      return NextResponse.json({
        trades: [],
        count: 0,
        warning: 'SX Bet simulation table not configured',
      });
    }

    return NextResponse.json(
      { error: error.message || 'Failed to fetch trades' },
      { status: 500 }
    );
  }
}
