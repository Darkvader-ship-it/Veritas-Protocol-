import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export const dynamic = 'force-dynamic';

/**
 * POST /api/drift/simulate
 * Place a simulated bet on a Drift BET prediction market
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      walletAddress,
      marketId,
      marketIndex,
      symbol,
      title,
      category,
      position, // 'Yes' or 'No'
      amount, // Amount in USDC
      priceAtEntry, // Probability/price (0-1)
      oraclePrice, // Current oracle price if applicable
      isReal,
      outcomeLabel,
      question,
      price,
    } = body;
    
    // Handle real tUSDC vault flow for Drift (no simulate fallback)
    if (isReal) {
      // For real Drift on Somnia, we use the same tUSDC vault as DreamDEX
      // The frontend already handles the vault approve/deposit via the modal's real flow
      // Here we just record the real trade as a vault-backed trade, not simulated
      const realAmount = parseFloat(amount || price);
      const realPrice = parseFloat(priceAtEntry || price || outcomeLabel === 'Yes' ? '0.5' : '0.5');
      // For real, we don't insert into simulated_trades, we just acknowledge
      return NextResponse.json({
        success: true,
        isReal: true,
        trade: {
          marketId,
          position: position || outcomeLabel,
          amount: realAmount,
          price: realPrice,
          status: 'real',
        },
        message: `Real ${realAmount} tUSDC on ${position || outcomeLabel} via Somnia vault`,
      });
    }

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
      return NextResponse.json({ error: 'Minimum bet is $1 USDC' }, { status: 400 });
    }

    if (amountNum > 1000) {
      return NextResponse.json({ error: 'Maximum simulated bet is $1000 USDC' }, { status: 400 });
    }

    // Check if user already has a bet on this market
    const { data: existing } = await supabase
      .from('drift_simulated_trades')
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

    // Calculate potential payout (1 / price for binary markets)
    const potentialPayout = amountNum / parseFloat(priceAtEntry);

    // Insert simulated trade
    const { data: trade, error } = await supabase
      .from('drift_simulated_trades')
      .insert({
        follower: walletAddress.toLowerCase(),
        market_id: marketId,
        market_index: marketIndex,
        symbol: symbol,
        title: title || 'Unknown Market',
        category: category || 'Crypto',
        position: position,
        amount_usdc: amountNum,
        price_at_entry: parseFloat(priceAtEntry),
        oracle_price: oraclePrice || null,
        potential_payout: potentialPayout,
        outcome: 'pending',
        simulated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting Drift trade:', error);
      if (error.code === '42P01' || error.code === 'PGRST205' || error.message?.includes('does not exist')) {
        return NextResponse.json(
          { error: 'Drift simulation not yet configured. Please create the drift_simulated_trades table.' },
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
        symbol: trade.symbol,
        title: trade.title,
        position: trade.position,
        amount: trade.amount_usdc,
        priceAtEntry: trade.price_at_entry,
        potentialPayout: trade.potential_payout,
        status: 'pending',
        simulatedAt: trade.simulated_at,
      },
      message: `Simulated $${amountNum} USDC on ${position} at ${(parseFloat(priceAtEntry) * 100).toFixed(0)}%`,
    });
  } catch (error: any) {
    console.error('Drift simulate error:', error);
    return NextResponse.json({ error: error.message || 'Failed to place simulated bet' }, { status: 500 });
  }
}

/**
 * GET /api/drift/simulate
 * Get simulated Drift trades for a user
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
        .from('drift_simulated_trades')
        .select('outcome, pnl_usdc, amount_usdc')
        .eq('follower', follower);

      if (error) throw error;

      const wins = trades?.filter(t => t.outcome === 'win').length || 0;
      const losses = trades?.filter(t => t.outcome === 'loss').length || 0;
      const pending = trades?.filter(t => t.outcome === 'pending').length || 0;
      const totalTrades = trades?.length || 0;

      let totalPnl = 0;
      let totalVolume = 0;

      for (const t of trades || []) {
        if (t.pnl_usdc) totalPnl += t.pnl_usdc;
        if (t.amount_usdc) totalVolume += t.amount_usdc;
      }

      return NextResponse.json({
        follower,
        totalTrades,
        wins,
        losses,
        pending,
        winRate: wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : '0',
        totalPnlUsdc: totalPnl.toFixed(2),
        totalVolumeUsdc: totalVolume.toFixed(2),
      });
    }

    let query = supabase
      .from('drift_simulated_trades')
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
      marketIndex: t.market_index,
      symbol: t.symbol,
      title: t.title,
      category: t.category,
      position: t.position,
      amountUsdc: t.amount_usdc,
      priceAtEntry: t.price_at_entry,
      oraclePrice: t.oracle_price,
      potentialPayout: t.potential_payout,
      outcome: t.outcome,
      pnlUsdc: t.pnl_usdc,
      simulatedAt: t.simulated_at,
      resolvedAt: t.resolved_at,
    }));

    return NextResponse.json({ trades: formatted, count: formatted.length });
  } catch (error: any) {
    console.error('Drift simulate GET error:', error);
    if (error.code === '42P01' || error.code === 'PGRST205' || error.message?.includes('does not exist')) {
      return NextResponse.json({ trades: [], count: 0, warning: 'Drift simulation table not configured' });
    }
    return NextResponse.json({ error: error.message || 'Failed to fetch trades' }, { status: 500 });
  }
}
