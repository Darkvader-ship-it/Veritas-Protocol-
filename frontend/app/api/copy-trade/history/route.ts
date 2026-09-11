import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'Address required' }, { status: 400 });
  }

  try {
    // Get user ID from address
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('wallet_address', address.toLowerCase())
      .single();

    if (userError || !user) {
      // User doesn't exist yet, return empty data
      return NextResponse.json({
        trades: [],
        stats: {
          totalFollowing: 0,
          totalCopied: 0,
          totalProfit: '0',
          successRate: 0,
        },
      });
    }

    // Get copy trade history
    const { data: copyTrades, error: tradesError } = await supabase
      .from('copy_trades')
      .select(`
        id,
        executed_at,
        original_bet:bets!copy_trades_original_bet_id_fkey (
          amount,
          position,
          market_id,
          user:users!bets_user_id_fkey (
            wallet_address
          )
        ),
        copied_bet:bets!copy_trades_copied_bet_id_fkey (
          amount,
          won,
          claimed_amount
        ),
        copy_follow:copy_follows (
          follower_id
        )
      `)
      .eq('copy_follow.follower_id', user.id)
      .order('executed_at', { ascending: false })
      .limit(50);

    if (tradesError) {
      console.error('Error fetching copy trades:', tradesError);
      return NextResponse.json({ error: 'Failed to fetch trades' }, { status: 500 });
    }

    // Transform the data
    const trades = (copyTrades || []).map((trade: any) => ({
      id: trade.id,
      original_bet: {
        amount: trade.original_bet.amount,
        position: trade.original_bet.position,
        market_id: trade.original_bet.market_id,
      },
      copied_bet: {
        amount: trade.copied_bet.amount,
        won: trade.copied_bet.won,
        claimed_amount: trade.copied_bet.claimed_amount,
      },
      executed_at: trade.executed_at,
      trader_address: trade.original_bet.user.wallet_address,
    }));

    // Calculate stats
    const totalCopied = trades.length;
    const completedTrades = trades.filter((t) => t.copied_bet.won !== null);
    const wonTrades = completedTrades.filter((t) => t.copied_bet.won);
    const successRate = completedTrades.length > 0
      ? (wonTrades.length / completedTrades.length) * 100
      : 0;

    // Calculate profit/loss
    let totalProfit = 0n;
    for (const trade of completedTrades) {
      if (trade.copied_bet.won && trade.copied_bet.claimed_amount) {
        const claimed = BigInt(trade.copied_bet.claimed_amount);
        const bet = BigInt(trade.copied_bet.amount);
        totalProfit += claimed - bet;
      } else if (!trade.copied_bet.won) {
        totalProfit -= BigInt(trade.copied_bet.amount);
      }
    }

    // Get active follows count
    const { data: follows, error: followsError } = await supabase
      .from('copy_follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('is_active', true);

    const stats = {
      totalFollowing: follows?.length || 0,
      totalCopied,
      totalProfit: totalProfit.toString(),
      successRate,
    };

    return NextResponse.json({ trades, stats });
  } catch (error) {
    console.error('Error in copy trade history:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
