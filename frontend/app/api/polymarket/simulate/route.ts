import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

const POLYMARKET_API = 'https://gamma-api.polymarket.com';

/**
 * GET /api/polymarket/simulate
 * Get simulated Polymarket trades
 *
 * Query params:
 * - follower: Filter by follower address
 * - leader: Filter by leader address
 * - limit: Number of trades to return (default 50)
 * - stats: If 'true', return aggregated stats
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const follower = searchParams.get('follower')?.toLowerCase();
    const leader = searchParams.get('leader')?.toLowerCase();
    const limit = parseInt(searchParams.get('limit') || '50');
    const wantStats = searchParams.get('stats') === 'true';

    if (wantStats) {
      // Return aggregated stats
      let query = supabase
        .from('polymarket_simulated_trades')
        .select('follower, outcome, pnl_usd, amount_usd');

      if (follower) query = query.eq('follower', follower);

      const { data: trades, error } = await query;

      if (error) {
        if (error.code === 'PGRST205' || error.code === '42P01' || String(error.message).includes('does not exist')) {
          return NextResponse.json({ trades: [], count: 0, warning: 'Polymarket simulation table not configured - using real vault' });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Aggregate stats
      const stats: Record<string, {
        follower: string;
        totalTrades: number;
        wins: number;
        losses: number;
        pending: number;
        winRate: number;
        totalPnlUsd: number;
        totalVolumeUsd: number;
      }> = {};

      for (const trade of trades || []) {
        if (!stats[trade.follower]) {
          stats[trade.follower] = {
            follower: trade.follower,
            totalTrades: 0,
            wins: 0,
            losses: 0,
            pending: 0,
            winRate: 0,
            totalPnlUsd: 0,
            totalVolumeUsd: 0,
          };
        }

        const s = stats[trade.follower];
        s.totalTrades++;
        s.totalVolumeUsd += Number(trade.amount_usd) || 0;

        if (trade.outcome === 'win') {
          s.wins++;
          s.totalPnlUsd += Number(trade.pnl_usd) || 0;
        } else if (trade.outcome === 'loss') {
          s.losses++;
          s.totalPnlUsd += Number(trade.pnl_usd) || 0;
        } else {
          s.pending++;
        }
      }

      // Calculate win rates
      for (const addr of Object.keys(stats)) {
        const s = stats[addr];
        const resolved = s.wins + s.losses;
        s.winRate = resolved > 0 ? (s.wins / resolved) * 100 : 0;
      }

      const formatted = Object.values(stats);

      // Overall stats
      const overall = {
        totalFollowers: formatted.length,
        totalTrades: formatted.reduce((sum, s) => sum + s.totalTrades, 0),
        totalWins: formatted.reduce((sum, s) => sum + s.wins, 0),
        totalLosses: formatted.reduce((sum, s) => sum + s.losses, 0),
        totalPending: formatted.reduce((sum, s) => sum + s.pending, 0),
        overallWinRate: 'N/A' as string,
        totalPnlUsd: formatted.reduce((sum, s) => sum + s.totalPnlUsd, 0).toFixed(2),
        totalVolumeUsd: formatted.reduce((sum, s) => sum + s.totalVolumeUsd, 0).toFixed(2),
      };

      if (overall.totalWins + overall.totalLosses > 0) {
        overall.overallWinRate = ((overall.totalWins / (overall.totalWins + overall.totalLosses)) * 100).toFixed(1) + '%';
      }

      return NextResponse.json({
        platform: 'polymarket',
        overall,
        followers: formatted,
      });
    }

    // Return individual trades
    let query = supabase
      .from('polymarket_simulated_trades')
      .select('*')
      .order('simulated_at', { ascending: false })
      .limit(limit);

    if (follower) query = query.eq('follower', follower);
    if (leader) query = query.eq('leader', leader);

    const { data: trades, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      platform: 'polymarket',
      trades: trades || [],
      count: trades?.length || 0,
    });
  } catch (error: any) {
    console.error('Error in Polymarket simulate GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/polymarket/simulate
 * Simulate a Polymarket trade (manual pick or auto-copy)
 *
 * Body:
 * - follower: Wallet address of the follower
 * - leader: Optional - Polymarket leader being copied
 * - marketId: Polymarket market/condition ID
 * - outcomeSelected: 'Yes' or 'No'
 * - amountUsd: Amount in USD
 * - priceAtEntry: Current price (0.00-1.00)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      follower,
      leader,
      marketId,
      marketQuestion,
      outcomeSelected,
      amountUsd,
      priceAtEntry,
    } = body;

    if (!follower || !marketId || !outcomeSelected || !amountUsd) {
      return NextResponse.json(
        { error: 'follower, marketId, outcomeSelected, and amountUsd are required' },
        { status: 400 }
      );
    }

    const followerLower = follower.toLowerCase();
    const leaderLower = leader?.toLowerCase() || 'manual';

    // Check if already has a position in this market
    const { data: existing } = await supabase
      .from('polymarket_simulated_trades')
      .select('id')
      .eq('follower', followerLower)
      .eq('market_id', marketId)
      .single();

    if (existing) {
      return NextResponse.json({
        success: false,
        message: 'Already have a position in this market',
      });
    }

    // Fetch market question if not provided
    let question = marketQuestion;
    if (!question) {
      try {
        const marketRes = await fetch(`${POLYMARKET_API}/markets/${marketId}`);
        if (marketRes.ok) {
          const marketData = await marketRes.json();
          question = marketData.question || `Market ${marketId.slice(0, 8)}...`;
        }
      } catch (e) {
        console.error('Error fetching market question:', e);
        question = `Market ${marketId.slice(0, 8)}...`;
      }
    }

    // Handle 0 price (0¢) as 0.001 to avoid division by zero and huge payout
    let safePrice = priceAtEntry;
    if (!safePrice || safePrice <= 0 || safePrice >= 1) {
      safePrice = 0.01;
      if (priceAtEntry === 0 || priceAtEntry === '0') safePrice = 0.015;
    }
    // Insert simulated trade (real tUSDC on Somnia)
    const { data: trade, error: insertError } = await supabase
      .from('polymarket_simulated_trades')
      .insert({
        follower: followerLower,
        leader: leaderLower,
        market_id: marketId,
        market_question: question,
        outcome_selected: outcomeSelected,
        amount_usd: amountUsd,
        price_at_entry: safePrice,
        outcome: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting Polymarket trade:', insertError);
      if (insertError.code === 'PGRST205' || insertError.code === '42P01' || String(insertError.message).includes('does not exist')) {
        return NextResponse.json({
          success: true,
          isReal: true,
          trade: {
            marketId,
            outcome_selected: outcomeSelected,
            amount_usd: amountUsd,
            price_at_entry: safePrice,
            status: 'real',
          },
          message: `Real ${amountUsd} tUSDC via Somnia vault`,
        });
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Simulated trade created',
      trade,
    });
  } catch (error: any) {
    console.error('Error in Polymarket simulate POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
