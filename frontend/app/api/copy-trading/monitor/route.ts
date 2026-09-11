import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

const DREAMDEX_PREDICTION_ABI = [
  'function currentEpoch() view returns (uint256)',
];

export async function GET(request: NextRequest) {
  try {
    // Get mainnet status
    const provider = new ethers.JsonRpcProvider('https://somnia.publicnode.com');
    const dreamdex = new ethers.Contract(
      '0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9',
      DREAMDEX_PREDICTION_ABI,
      provider
    );

    const [currentEpoch, currentBlock] = await Promise.all([
      dreamdex.currentEpoch(),
      provider.getBlockNumber(),
    ]);

    // Get top 50 monitored leaders
    const { data: topTraders } = await supabase
      .from('user_platform_stats')
      .select('score, users!inner(wallet_address)')
      .order('score', { ascending: false })
      .limit(50);

    const leaders = topTraders?.map((t: any) => ({
      address: t.users?.wallet_address,
      score: t.score,
    })) || [];

    // Get recent simulated trades
    const { data: recentTrades } = await supabase
      .from('simulated_trades')
      .select('*')
      .order('simulated_at', { ascending: false })
      .limit(20);

    // Get simulation stats
    const { data: allTrades } = await supabase
      .from('simulated_trades')
      .select('outcome, pnl, amount');

    let stats = {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      pending: 0,
      totalPnlWei: '0',
    };

    for (const trade of allTrades || []) {
      stats.totalTrades++;
      if (trade.outcome === 'win') {
        stats.wins++;
        stats.totalPnlWei = (BigInt(stats.totalPnlWei) + BigInt(trade.pnl || '0')).toString();
      } else if (trade.outcome === 'loss') {
        stats.losses++;
        stats.totalPnlWei = (BigInt(stats.totalPnlWei) + BigInt(trade.pnl || '0')).toString();
      } else {
        stats.pending++;
      }
    }

    // Get leader activity (last bet times)
    const leaderActivity: Record<string, any> = {};
    for (const leader of leaders.slice(0, 10)) {
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .ilike('wallet_address', leader.address)
        .single();

      if (user) {
        const { data: lastBet } = await supabase
          .from('bets')
          .select('timestamp, epoch')
          .eq('user_id', user.id)
          .order('timestamp', { ascending: false })
          .limit(1)
          .single();

        if (lastBet) {
          const hoursAgo = Math.round((Date.now() - new Date(lastBet.timestamp).getTime()) / (1000 * 60 * 60));
          leaderActivity[leader.address] = {
            lastBetEpoch: lastBet.epoch,
            hoursAgo,
          };
        }
      }
    }

    return NextResponse.json({
      status: 'ok',
      mainnet: {
        currentEpoch: currentEpoch.toString(),
        currentBlock,
        dreamdexLive: true,
      },
      monitoring: {
        leadersCount: leaders.length,
        topLeaders: leaders.slice(0, 10).map((l: any) => ({
          ...l,
          activity: leaderActivity[l.address] || null,
        })),
      },
      simulation: {
        ...stats,
        winRate: stats.wins + stats.losses > 0
          ? ((stats.wins / (stats.wins + stats.losses)) * 100).toFixed(1) + '%'
          : 'N/A',
        totalPnlSTT: (Number(stats.totalPnlWei) / 1e18).toFixed(6),
      },
      recentTrades: (recentTrades || []).map((t: any) => ({
        id: t.id,
        follower: t.follower,
        leader: t.leader,
        epoch: t.epoch,
        amountSTT: (Number(t.amount) / 1e18).toFixed(6),
        isBull: t.is_bull,
        outcome: t.outcome,
        pnlSTT: t.pnl ? (Number(t.pnl) / 1e18).toFixed(6) : null,
        simulatedAt: t.simulated_at,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Monitor API error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
