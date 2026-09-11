import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export const dynamic = 'force-dynamic';

/**
 * POST /api/dreamdex/simulate
 * Place a simulated bet on a DreamDEX binary prediction market
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      walletAddress,
      marketId,
      packagedTokenId,
      question,
      outcomeLabel,
      amount, // Amount in USD
      price, // Price 0-1 (decimal yes/no shares)
      closeTime, // Market close timestamp
    } = body;

    if (!walletAddress || !marketId || !packagedTokenId || !question || !outcomeLabel || !amount || price === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: walletAddress, marketId, packagedTokenId, question, outcomeLabel, amount, price' },
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
        { error: 'Minimum simulated bet is $1 USD' },
        { status: 400 }
      );
    }

    if (amountNum > 1000) {
      return NextResponse.json(
        { error: 'Maximum simulated bet is $1000 USD' },
        { status: 400 }
      );
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0 || priceNum >= 1) {
      return NextResponse.json(
        { error: 'Price must be between 0 and 1' },
        { status: 400 }
      );
    }

    // Check if user already has a pending bet on this market
    const { data: existing } = await supabase
      .from('dreamdex_simulated_trades')
      .select('id')
      .eq('follower', walletAddress.toLowerCase())
      .eq('market_id', marketId)
      .eq('outcome', 'pending')
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'You already have a pending simulated bet on this market' },
        { status: 400 }
      );
    }

    // Potential payout if the selected outcome hits
    const potentialPayout = amountNum / priceNum;

    // Insert simulated trade
    const { data: trade, error } = await supabase
      .from('dreamdex_simulated_trades')
      .insert({
        follower: walletAddress.toLowerCase(),
        market_id: marketId,
        packaged_token_id: packagedTokenId,
        question: question,
        outcome_label: outcomeLabel,
        amount_usd: amountNum,
        price_at_entry: priceNum,
        potential_payout: potentialPayout,
        close_time: closeTime ? new Date(closeTime).toISOString() : null,
        outcome: 'pending',
        simulated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting DreamDEX simulated trade:', error);

      // Check if table doesn't exist
      if (error.code === '42P01' || error.code === 'PGRST205' || error.message?.includes('does not exist')) {
        return NextResponse.json(
          { error: 'DreamDEX simulation not yet configured. Please run the dreamdex_simulated_trades migration.' },
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
        marketId: trade.market_id,
        packagedTokenId: trade.packaged_token_id,
        question: trade.question,
        outcomeLabel: trade.outcome_label,
        amount: trade.amount_usd,
        price: trade.price_at_entry,
        potentialPayout: trade.potential_payout,
        status: 'pending',
        simulatedAt: trade.simulated_at,
      },
      message: `Simulated $${amountNum} bet on "${question}" at ${priceNum}x`,
    });
  } catch (error: any) {
    console.error('DreamDEX simulate error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to place simulated bet' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/dreamdex/simulate
 * Get simulated DreamDEX trades for a user
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const follower = searchParams.get('follower')?.toLowerCase();
  const marketId = searchParams.get('marketId');
  const limit = parseInt(searchParams.get('limit') || '50');
  const stats = searchParams.get('stats') === 'true';

  try {
    if (stats && follower) {
      // Return aggregated stats for a user
      const { data: trades, error } = await supabase
        .from('dreamdex_simulated_trades')
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
      .from('dreamdex_simulated_trades')
      .select('*')
      .order('simulated_at', { ascending: false })
      .limit(limit);

    if (follower) {
      query = query.eq('follower', follower);
    }
    if (marketId) {
      query = query.eq('market_id', parseInt(marketId));
    }

    const { data: trades, error } = await query;

    if (error) throw error;

    const formatted = (trades || []).map(t => ({
      id: t.id,
      follower: t.follower,
      marketId: t.market_id,
      packagedTokenId: t.packaged_token_id,
      question: t.question,
      outcomeLabel: t.outcome_label,
      amountUsd: t.amount_usd,
      priceAtEntry: t.price_at_entry,
      potentialPayout: t.potential_payout,
      outcome: t.outcome,
      pnlUsd: t.pnl_usd,
      simulatedAt: t.simulated_at,
      resolvedAt: t.resolved_at,
      closeTime: t.close_time,
    }));

    return NextResponse.json({
      trades: formatted,
      count: formatted.length,
    });
  } catch (error: any) {
    console.error('DreamDEX simulate GET error:', error);

    // Handle missing table gracefully
    if (error.code === '42P01' || error.code === 'PGRST205' || error.message?.includes('does not exist')) {
      return NextResponse.json({
        trades: [],
        count: 0,
        warning: 'DreamDEX simulation table not configured',
      });
    }

    return NextResponse.json(
      { error: error.message || 'Failed to fetch trades' },
      { status: 500 }
    );
  }
}