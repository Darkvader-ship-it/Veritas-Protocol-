import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export const dynamic = 'force-dynamic';

/**
 * POST /api/overtime/simulate
 * Place a simulated bet on an Overtime sports market
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      walletAddress,
      gameId,
      sportId,
      sportName,
      leagueName,
      homeTeam,
      awayTeam,
      position, // 0 = home, 1 = draw (if applicable), 2 = away
      outcomeLabel,
      amount, // Amount in USD
      odds, // Decimal odds at time of bet
      maturity,
    } = body;

    if (!walletAddress || !gameId || position === undefined || !amount || !odds) {
      return NextResponse.json(
        { error: 'Missing required fields: walletAddress, gameId, position, amount, odds' },
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

    // Check if user already has a bet on this game
    const { data: existing } = await supabase
      .from('overtime_simulated_trades')
      .select('id')
      .eq('follower', walletAddress.toLowerCase())
      .eq('game_id', gameId)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'You already have a simulated bet on this game' },
        { status: 400 }
      );
    }

    // Calculate potential payout
    const potentialPayout = amountNum * parseFloat(odds);

    // Insert simulated trade
    const { data: trade, error } = await supabase
      .from('overtime_simulated_trades')
      .insert({
        follower: walletAddress.toLowerCase(),
        game_id: gameId,
        sport_id: sportId,
        sport_name: sportName || 'Unknown',
        league_name: leagueName || 'Unknown',
        home_team: homeTeam,
        away_team: awayTeam,
        position: position,
        outcome_label: outcomeLabel,
        amount_usd: amountNum,
        odds_at_entry: parseFloat(odds),
        potential_payout: potentialPayout,
        maturity: maturity ? new Date(maturity * 1000).toISOString() : null,
        outcome: 'pending',
        simulated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting Overtime simulated trade:', error);

      // Check if table doesn't exist
      if (error.code === '42P01' || error.code === 'PGRST205' || error.message?.includes('does not exist')) {
        return NextResponse.json(
          { error: 'Overtime simulation not yet configured. Please create the overtime_simulated_trades table.' },
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
        gameId: trade.game_id,
        homeTeam: trade.home_team,
        awayTeam: trade.away_team,
        position: trade.position,
        outcomeLabel: trade.outcome_label,
        amount: trade.amount_usd,
        odds: trade.odds_at_entry,
        potentialPayout: trade.potential_payout,
        status: 'pending',
        simulatedAt: trade.simulated_at,
      },
      message: `Simulated $${amountNum} bet on ${outcomeLabel} at ${odds}x odds`,
    });
  } catch (error: any) {
    console.error('Overtime simulate error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to place simulated bet' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/overtime/simulate
 * Get simulated Overtime trades for a user
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const follower = searchParams.get('follower')?.toLowerCase();
  const gameId = searchParams.get('gameId');
  const limit = parseInt(searchParams.get('limit') || '50');
  const stats = searchParams.get('stats') === 'true';

  try {
    if (stats && follower) {
      // Return aggregated stats for a user
      const { data: trades, error } = await supabase
        .from('overtime_simulated_trades')
        .select('outcome, pnl_usd, amount_usd')
        .eq('follower', follower);

      if (error) throw error;

      const wins = trades?.filter(t => t.outcome === 'win').length || 0;
      const losses = trades?.filter(t => t.outcome === 'loss').length || 0;
      const pending = trades?.filter(t => t.outcome === 'pending').length || 0;
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
      .from('overtime_simulated_trades')
      .select('*')
      .order('simulated_at', { ascending: false })
      .limit(limit);

    if (follower) {
      query = query.eq('follower', follower);
    }
    if (gameId) {
      query = query.eq('game_id', gameId);
    }

    const { data: trades, error } = await query;

    if (error) throw error;

    const formatted = (trades || []).map(t => ({
      id: t.id,
      follower: t.follower,
      gameId: t.game_id,
      sportName: t.sport_name,
      leagueName: t.league_name,
      homeTeam: t.home_team,
      awayTeam: t.away_team,
      position: t.position,
      outcomeLabel: t.outcome_label,
      amountUsd: t.amount_usd,
      oddsAtEntry: t.odds_at_entry,
      potentialPayout: t.potential_payout,
      outcome: t.outcome,
      pnlUsd: t.pnl_usd,
      simulatedAt: t.simulated_at,
      resolvedAt: t.resolved_at,
      maturity: t.maturity,
    }));

    return NextResponse.json({
      trades: formatted,
      count: formatted.length,
    });
  } catch (error: any) {
    console.error('Overtime simulate GET error:', error);

    // Handle missing table gracefully
    if (error.code === '42P01' || error.code === 'PGRST205' || error.message?.includes('does not exist')) {
      return NextResponse.json({
        trades: [],
        count: 0,
        warning: 'Overtime simulation table not configured',
      });
    }

    return NextResponse.json(
      { error: error.message || 'Failed to fetch trades' },
      { status: 500 }
    );
  }
}
