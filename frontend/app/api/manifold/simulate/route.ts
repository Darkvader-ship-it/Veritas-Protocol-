import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export const dynamic = 'force-dynamic';

/**
 * POST /api/manifold/simulate
 * Place a simulated bet on a Manifold Markets prediction
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      walletAddress,
      marketId,
      slug,
      question,
      category,
      position, // 'Yes' or 'No' or outcome ID for multi-choice
      outcomeLabel,
      amount, // Amount in Mana (play money)
      probability, // Current probability (0-1)
      closeTime,
      creatorUsername,
    } = body;

    if (!walletAddress || !marketId || !position || !amount || probability === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: walletAddress, marketId, position, amount, probability' },
        { status: 400 }
      );
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    if (amountNum < 10) {
      return NextResponse.json({ error: 'Minimum bet is M$10' }, { status: 400 });
    }

    if (amountNum > 10000) {
      return NextResponse.json({ error: 'Maximum simulated bet is M$10000' }, { status: 400 });
    }

    // Check if user already has a bet on this market
    const { data: existing } = await supabase
      .from('manifold_simulated_trades')
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
    const prob = parseFloat(probability);
    const entryPrice = position === 'Yes' || position === 'YES' ? prob : (1 - prob);
    const potentialPayout = amountNum / Math.max(entryPrice, 0.01);

    // Insert simulated trade
    const { data: trade, error } = await supabase
      .from('manifold_simulated_trades')
      .insert({
        follower: walletAddress.toLowerCase(),
        market_id: marketId,
        slug: slug,
        question: question || 'Unknown Market',
        category: category || 'General',
        position: position,
        outcome_label: outcomeLabel || position,
        amount_mana: amountNum,
        probability_at_entry: prob,
        potential_payout: potentialPayout,
        close_time: closeTime ? new Date(closeTime).toISOString() : null,
        creator_username: creatorUsername,
        outcome: 'pending',
        simulated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting Manifold trade:', error);
      if (error.code === '42P01' || error.code === 'PGRST205' || error.message?.includes('does not exist')) {
        return NextResponse.json(
          { error: 'Manifold simulation not yet configured. Please create the manifold_simulated_trades table.' },
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
        question: trade.question,
        position: trade.position,
        amount: trade.amount_mana,
        probabilityAtEntry: trade.probability_at_entry,
        potentialPayout: trade.potential_payout,
        status: 'pending',
        simulatedAt: trade.simulated_at,
      },
      message: `Simulated M$${amountNum} on ${outcomeLabel || position} at ${(prob * 100).toFixed(0)}%`,
    });
  } catch (error: any) {
    console.error('Manifold simulate error:', error);
    return NextResponse.json({ error: error.message || 'Failed to place simulated bet' }, { status: 500 });
  }
}

/**
 * GET /api/manifold/simulate
 * Get simulated Manifold trades for a user
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
        .from('manifold_simulated_trades')
        .select('outcome, pnl_mana, amount_mana')
        .eq('follower', follower);

      if (error) throw error;

      const wins = trades?.filter(t => t.outcome === 'win').length || 0;
      const losses = trades?.filter(t => t.outcome === 'loss').length || 0;
      const pending = trades?.filter(t => t.outcome === 'pending').length || 0;
      const totalTrades = trades?.length || 0;

      let totalPnl = 0;
      let totalVolume = 0;

      for (const t of trades || []) {
        if (t.pnl_mana) totalPnl += t.pnl_mana;
        if (t.amount_mana) totalVolume += t.amount_mana;
      }

      return NextResponse.json({
        follower,
        totalTrades,
        wins,
        losses,
        pending,
        winRate: wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : '0',
        totalPnlMana: totalPnl.toFixed(0),
        totalVolumeMana: totalVolume.toFixed(0),
      });
    }

    let query = supabase
      .from('manifold_simulated_trades')
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
      slug: t.slug,
      question: t.question,
      category: t.category,
      position: t.position,
      outcomeLabel: t.outcome_label,
      amountMana: t.amount_mana,
      probabilityAtEntry: t.probability_at_entry,
      potentialPayout: t.potential_payout,
      closeTime: t.close_time,
      creatorUsername: t.creator_username,
      outcome: t.outcome,
      pnlMana: t.pnl_mana,
      simulatedAt: t.simulated_at,
      resolvedAt: t.resolved_at,
    }));

    return NextResponse.json({ trades: formatted, count: formatted.length });
  } catch (error: any) {
    console.error('Manifold simulate GET error:', error);
    if (error.code === '42P01' || error.code === 'PGRST205' || error.message?.includes('does not exist')) {
      return NextResponse.json({ trades: [], count: 0, warning: 'Manifold simulation table not configured' });
    }
    return NextResponse.json({ error: error.message || 'Failed to fetch trades' }, { status: 500 });
  }
}
