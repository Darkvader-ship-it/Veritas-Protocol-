import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export const dynamic = 'force-dynamic';

/**
 * POST /api/azuro/simulate
 * Place a simulated bet on an Azuro sports market
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      walletAddress,
      gameId,
      conditionId,
      outcomeId,
      sport,
      league,
      title,
      participants,
      outcomeLabel,
      amount, // Amount in USD
      odds, // Decimal odds at time of bet
      startsAt, // Game start timestamp
      network, // polygon, gnosis, arbitrum
    } = body;

    if (!walletAddress || !conditionId || !outcomeId || !amount || !odds) {
      return NextResponse.json(
        { error: 'Missing required fields: walletAddress, conditionId, outcomeId, amount, odds' },
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

    // Check if user already has a bet on this condition
    const { data: existing } = await supabase
      .from('azuro_simulated_trades')
      .select('id')
      .eq('follower', walletAddress.toLowerCase())
      .eq('condition_id', conditionId)
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
      .from('azuro_simulated_trades')
      .insert({
        follower: walletAddress.toLowerCase(),
        game_id: gameId,
        condition_id: conditionId,
        outcome_id: outcomeId,
        sport: sport || 'Unknown',
        league: league || 'Unknown',
        title: title || 'Unknown Match',
        participants: participants || [],
        outcome_label: outcomeLabel || `Outcome ${outcomeId}`,
        amount_usd: amountNum,
        odds_at_entry: parseFloat(odds),
        potential_payout: potentialPayout,
        starts_at: startsAt ? new Date(startsAt).toISOString() : null,
        network: network || 'polygon',
        outcome: 'pending',
        simulated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting Azuro simulated trade:', error);

      // Check if table doesn't exist
      if (error.code === '42P01' || error.code === 'PGRST205' || error.message?.includes('does not exist')) {
        return NextResponse.json(
          { error: 'Azuro simulation not yet configured. Please create the azuro_simulated_trades table.' },
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
        conditionId: trade.condition_id,
        outcomeId: trade.outcome_id,
        title: trade.title,
        outcomeLabel: trade.outcome_label,
        amount: trade.amount_usd,
        odds: trade.odds_at_entry,
        potentialPayout: trade.potential_payout,
        network: trade.network,
        status: 'pending',
        simulatedAt: trade.simulated_at,
      },
      message: `Simulated $${amountNum} bet on ${outcomeLabel} at ${odds}x odds`,
    });
  } catch (error: any) {
    console.error('Azuro simulate error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to place simulated bet' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/azuro/simulate
 * Get simulated Azuro trades for a user
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const follower = searchParams.get('follower')?.toLowerCase();
  const conditionId = searchParams.get('conditionId');
  const network = searchParams.get('network');
  const limit = parseInt(searchParams.get('limit') || '50');
  const stats = searchParams.get('stats') === 'true';

  try {
    if (stats && follower) {
      // Return aggregated stats for a user
      const { data: trades, error } = await supabase
        .from('azuro_simulated_trades')
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
      .from('azuro_simulated_trades')
      .select('*')
      .order('simulated_at', { ascending: false })
      .limit(limit);

    if (follower) {
      query = query.eq('follower', follower);
    }
    if (conditionId) {
      query = query.eq('condition_id', conditionId);
    }
    if (network) {
      query = query.eq('network', network);
    }

    const { data: trades, error } = await query;

    if (error) throw error;

    const formatted = (trades || []).map(t => ({
      id: t.id,
      follower: t.follower,
      gameId: t.game_id,
      conditionId: t.condition_id,
      outcomeId: t.outcome_id,
      sport: t.sport,
      league: t.league,
      title: t.title,
      participants: t.participants,
      outcomeLabel: t.outcome_label,
      amountUsd: t.amount_usd,
      oddsAtEntry: t.odds_at_entry,
      potentialPayout: t.potential_payout,
      network: t.network,
      outcome: t.outcome,
      pnlUsd: t.pnl_usd,
      simulatedAt: t.simulated_at,
      resolvedAt: t.resolved_at,
      startsAt: t.starts_at,
    }));

    return NextResponse.json({
      trades: formatted,
      count: formatted.length,
    });
  } catch (error: any) {
    console.error('Azuro simulate GET error:', error);

    // Handle missing table gracefully
    if (error.code === '42P01' || error.code === 'PGRST205' || error.message?.includes('does not exist')) {
      return NextResponse.json({
        trades: [],
        count: 0,
        warning: 'Azuro simulation table not configured',
      });
    }

    return NextResponse.json(
      { error: error.message || 'Failed to fetch trades' },
      { status: 500 }
    );
  }
}
