import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

/**
 * GET /api/copy-trading/simulation
 *
 * Query params:
 * - follower: (optional) Filter by follower address
 * - leader: (optional) Filter by leader address
 * - limit: (optional) Number of trades to return (default 50)
 * - stats: (optional) If 'true', return aggregated stats instead of trades
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const follower = searchParams.get('follower')?.toLowerCase();
    const leader = searchParams.get('leader')?.toLowerCase();
    const limit = parseInt(searchParams.get('limit') || '50');
    const wantStats = searchParams.get('stats') === 'true';

    // Return aggregated stats
    if (wantStats) {
      let query = supabase
        .from('simulated_trades')
        .select('follower, outcome, pnl, amount');

      if (follower) {
        query = query.eq('follower', follower);
      }

      const { data: trades, error } = await query;

      if (error) {
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
        totalPnlWei: string;
        totalVolumeWei: string;
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
            totalPnlWei: '0',
            totalVolumeWei: '0',
          };
        }

        const s = stats[trade.follower];
        s.totalTrades++;
        s.totalVolumeWei = (BigInt(s.totalVolumeWei) + BigInt(trade.amount)).toString();

        if (trade.outcome === 'win') {
          s.wins++;
          s.totalPnlWei = (BigInt(s.totalPnlWei) + BigInt(trade.pnl || '0')).toString();
        } else if (trade.outcome === 'loss') {
          s.losses++;
          s.totalPnlWei = (BigInt(s.totalPnlWei) + BigInt(trade.pnl || '0')).toString();
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

      // Format for response
      const formatted = Object.values(stats).map((s) => ({
        ...s,
        totalPnlSTT: formatEther(s.totalPnlWei),
        totalVolumeSTT: formatEther(s.totalVolumeWei),
        winRate: s.winRate.toFixed(1) + '%',
      }));

      // Overall stats
      const overall = {
        totalFollowers: formatted.length,
        totalTrades: formatted.reduce((sum, s) => sum + s.totalTrades, 0),
        totalWins: formatted.reduce((sum, s) => sum + s.wins, 0),
        totalLosses: formatted.reduce((sum, s) => sum + s.losses, 0),
        totalPending: formatted.reduce((sum, s) => sum + s.pending, 0),
        overallWinRate: 'N/A' as string,
        totalPnlSTT: '0',
        totalVolumeSTT: '0',
      };

      if (overall.totalWins + overall.totalLosses > 0) {
        overall.overallWinRate = ((overall.totalWins / (overall.totalWins + overall.totalLosses)) * 100).toFixed(1) + '%';
      }

      let totalPnl = BigInt(0);
      let totalVolume = BigInt(0);
      for (const s of formatted) {
        totalPnl += BigInt(s.totalPnlWei);
        totalVolume += BigInt(s.totalVolumeWei);
      }
      overall.totalPnlSTT = formatEther(totalPnl.toString());
      overall.totalVolumeSTT = formatEther(totalVolume.toString());

      return NextResponse.json({
        mode: 'simulation',
        overall,
        followers: formatted,
      });
    }

    // Return individual trades
    let query = supabase
      .from('simulated_trades')
      .select('*')
      .order('simulated_at', { ascending: false })
      .limit(limit);

    if (follower) {
      query = query.eq('follower', follower);
    }
    if (leader) {
      query = query.eq('leader', leader);
    }

    const { data: trades, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Format trades
    const formatted = (trades || []).map((t) => ({
      id: t.id,
      follower: t.follower,
      leader: t.leader,
      epoch: t.epoch,
      amountSTT: formatEther(t.amount),
      isBull: t.is_bull,
      outcome: t.outcome,
      pnlSTT: t.pnl ? formatEther(t.pnl) : null,
      simulatedAt: t.simulated_at,
      resolvedAt: t.resolved_at,
    }));

    return NextResponse.json({
      mode: 'simulation',
      trades: formatted,
      count: formatted.length,
    });
  } catch (error: any) {
    console.error('Error in simulation API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch simulation data' },
      { status: 500 }
    );
  }
}

function formatEther(wei: string): string {
  try {
    const value = BigInt(wei);
    const ether = Number(value) / 1e18;
    return ether.toFixed(6);
  } catch {
    return '0';
  }
}
