import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export const dynamic = 'force-dynamic';

/**
 * POST /api/gnosis/simulate
 * Place a simulated bet on a Gnosis/Omen prediction market
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      walletAddress,
      marketId,
      conditionId,
      questionId,
      title,
      category,
      position, // 'Yes' or 'No' or outcome index
      outcomeLabel,
      amount, // Amount in xDAI/USDC
      odds, // Decimal odds at time of bet
      resolvesAt,
      collateralToken,
    } = body;

    if (!walletAddress || !marketId || position === undefined || !amount || !odds) {
      return NextResponse.json(
        { error: 'Missing required fields: walletAddress, marketId, position, amount, odds' },
        { status: 400 }
      );
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    if (amountNum < 1) {
      return NextResponse.json({ error: 'Minimum bet is 1 xDAI' }, { status: 400 });
    }

    if (amountNum > 1000) {
      return NextResponse.json({ error: 'Maximum simulated bet is 1000 xDAI' }, { status: 400 });
    }

    // Check if user already has a bet on this market
    const { data: existing } = await supabase
      .from('gnosis_simulated_trades')
      .select('id')
      .eq('follower', walletAddress.toLowerCase())
      .eq('market_id', marketId)
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
      .from('gnosis_simulated_trades')
      .insert({
        follower: walletAddress.toLowerCase(),
        market_id: marketId,
        condition_id: conditionId,
        question_id: questionId,
        title: title || 'Unknown Market',
        category: category || 'General',
        position: position,
        outcome_label: outcomeLabel || `${position}`,
        amount: amountNum,
        odds_at_entry: parseFloat(odds),
        potential_payout: potentialPayout,
        resolves_at: resolvesAt ? new Date(resolvesAt).toISOString() : null,
        collateral_token: collateralToken || 'xDAI',
        outcome: 'pending',
        simulated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting Gnosis trade:', error);
      if (error.code === '42P01' || error.code === 'PGRST205' || error.message?.includes('does not exist')) {
        return NextResponse.json(
          { error: 'Gnosis simulation not yet configured. Please create the gnosis_simulated_trades table.' },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: 'Failed to place simulated bet' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      trade: {
        id: trade.id,
        marketId: trade.market_id,
        title: trade.title,
        position: trade.position,
        outcomeLabel: trade.outcome_label,
        amount: trade.amount,
        odds: trade.odds_at_entry,
        potentialPayout: trade.potential_payout,
        collateralToken: trade.collateral_token,
        status: 'pending',
        simulatedAt: trade.simulated_at,
      },
      message: `Simulated ${amountNum} ${collateralToken || 'xDAI'} on ${outcomeLabel || position} at ${odds}x odds`,
    });
  } catch (error: any) {
    console.error('Gnosis simulate error:', error);
    return NextResponse.json({ error: error.message || 'Failed to place simulated bet' }, { status: 500 });
  }
}

/**
 * GET /api/gnosis/simulate
 * Get simulated Gnosis trades for a user
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const follower = searchParams.get('follower')?.toLowerCase();
  const marketId = searchParams.get('marketId');
  const limit = parseInt(searchParams.get('limit') || '50');
  const stats = searchParams.get('stats') === 'true';

  try {
    if (stats && follower) {
      const { data: trades, error } = await supabase
        .from('gnosis_simulated_trades')
        .select('outcome, pnl, amount')
        .eq('follower', follower);

      if (error) throw error;

      const wins = trades?.filter(t => t.outcome === 'win').length || 0;
      const losses = trades?.filter(t => t.outcome === 'loss').length || 0;
      const pending = trades?.filter(t => t.outcome === 'pending').length || 0;
      const totalTrades = trades?.length || 0;

      let totalPnl = 0;
      let totalVolume = 0;

      for (const t of trades || []) {
        if (t.pnl) totalPnl += t.pnl;
        if (t.amount) totalVolume += t.amount;
      }

      return NextResponse.json({
        follower,
        totalTrades,
        wins,
        losses,
        pending,
        winRate: wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : '0',
        totalPnl: totalPnl.toFixed(2),
        totalVolume: totalVolume.toFixed(2),
      });
    }

    let query = supabase
      .from('gnosis_simulated_trades')
      .select('*')
      .order('simulated_at', { ascending: false })
      .limit(limit);

    if (follower) query = query.eq('follower', follower);
    if (marketId) query = query.eq('market_id', marketId);

    const { data: trades, error } = await query;

    if (error) throw error;

    const formatted = (trades || []).map(t => ({
      id: t.id,
      follower: t.follower,
      marketId: t.market_id,
      conditionId: t.condition_id,
      title: t.title,
      category: t.category,
      position: t.position,
      outcomeLabel: t.outcome_label,
      amount: t.amount,
      oddsAtEntry: t.odds_at_entry,
      potentialPayout: t.potential_payout,
      collateralToken: t.collateral_token,
      outcome: t.outcome,
      pnl: t.pnl,
      simulatedAt: t.simulated_at,
      resolvedAt: t.resolved_at,
      resolvesAt: t.resolves_at,
    }));

    return NextResponse.json({ trades: formatted, count: formatted.length });
  } catch (error: any) {
    console.error('Gnosis simulate GET error:', error);
    if (error.code === '42P01' || error.code === 'PGRST205' || error.message?.includes('does not exist')) {
      return NextResponse.json({ trades: [], count: 0, warning: 'Gnosis simulation table not configured' });
    }
    return NextResponse.json({ error: error.message || 'Failed to fetch trades' }, { status: 500 });
  }
}
