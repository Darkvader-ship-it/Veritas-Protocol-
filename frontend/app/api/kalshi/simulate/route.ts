import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export const dynamic = 'force-dynamic';

/**
 * POST /api/kalshi/simulate
 * Place a simulated bet on a Kalshi prediction market
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      walletAddress,
      marketId,
      ticker,
      eventTicker,
      title,
      subtitle,
      category,
      position, // 'Yes' or 'No'
      amount, // Amount in USD
      priceAtEntry, // Yes price (0.01-0.99)
      closeTime,
    } = body;

    if (!walletAddress || !marketId || !position || !amount || !priceAtEntry) {
      return NextResponse.json(
        { error: 'Missing required fields: walletAddress, marketId, position, amount, priceAtEntry' },
        { status: 400 }
      );
    }

    if (!['Yes', 'No'].includes(position)) {
      return NextResponse.json({ error: 'Position must be Yes or No' }, { status: 400 });
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    if (amountNum < 1) {
      return NextResponse.json({ error: 'Minimum bet is $1 USD' }, { status: 400 });
    }

    if (amountNum > 1000) {
      return NextResponse.json({ error: 'Maximum simulated bet is $1000 USD' }, { status: 400 });
    }

    // Check if user already has a bet on this market
    const { data: existing } = await supabase
      .from('kalshi_simulated_trades')
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
    const price = parseFloat(priceAtEntry);
    const entryPrice = position === 'Yes' ? price : (1 - price);
    const potentialPayout = amountNum / entryPrice;

    // Insert simulated trade
    const { data: trade, error } = await supabase
      .from('kalshi_simulated_trades')
      .insert({
        follower: walletAddress.toLowerCase(),
        market_id: marketId,
        ticker: ticker,
        event_ticker: eventTicker,
        title: title || 'Unknown Market',
        subtitle: subtitle,
        category: category || 'Events',
        position: position,
        amount_usd: amountNum,
        price_at_entry: entryPrice,
        yes_price: price,
        potential_payout: potentialPayout,
        close_time: closeTime ? new Date(closeTime).toISOString() : null,
        outcome: 'pending',
        simulated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting Kalshi trade:', error);
      if (error.code === '42P01' || error.code === 'PGRST205' || error.message?.includes('does not exist')) {
        return NextResponse.json(
          { error: 'Kalshi simulation not yet configured. Please create the kalshi_simulated_trades table.' },
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
        ticker: trade.ticker,
        title: trade.title,
        position: trade.position,
        amount: trade.amount_usd,
        priceAtEntry: trade.price_at_entry,
        potentialPayout: trade.potential_payout,
        status: 'pending',
        simulatedAt: trade.simulated_at,
      },
      message: `Simulated $${amountNum} on ${position} at ${(entryPrice * 100).toFixed(0)}¢`,
    });
  } catch (error: any) {
    console.error('Kalshi simulate error:', error);
    return NextResponse.json({ error: error.message || 'Failed to place simulated bet' }, { status: 500 });
  }
}

/**
 * GET /api/kalshi/simulate
 * Get simulated Kalshi trades for a user
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
        .from('kalshi_simulated_trades')
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

    let query = supabase
      .from('kalshi_simulated_trades')
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
      ticker: t.ticker,
      eventTicker: t.event_ticker,
      title: t.title,
      subtitle: t.subtitle,
      category: t.category,
      position: t.position,
      amountUsd: t.amount_usd,
      priceAtEntry: t.price_at_entry,
      yesPrice: t.yes_price,
      potentialPayout: t.potential_payout,
      closeTime: t.close_time,
      outcome: t.outcome,
      pnlUsd: t.pnl_usd,
      simulatedAt: t.simulated_at,
      resolvedAt: t.resolved_at,
    }));

    return NextResponse.json({ trades: formatted, count: formatted.length });
  } catch (error: any) {
    console.error('Kalshi simulate GET error:', error);
    if (error.code === '42P01' || error.code === 'PGRST205' || error.message?.includes('does not exist')) {
      return NextResponse.json({ trades: [], count: 0, warning: 'Kalshi simulation table not configured' });
    }
    return NextResponse.json({ error: error.message || 'Failed to fetch trades' }, { status: 500 });
  }
}
