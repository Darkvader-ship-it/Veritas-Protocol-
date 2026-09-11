import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    // Get global stats
    const { data: betsCount, error: betsError } = await supabase
      .from('bets')
      .select('id', { count: 'exact', head: true });

    const { data: usersCount, error: usersError } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true });

    const { data: platformsCount, error: platformsError } = await supabase
      .from('platforms')
      .select('id', { count: 'exact', head: true });

    // Get aggregated volume and win rate
    const { data: aggregatedStats, error: aggregatedError } = await supabase
      .rpc('get_global_stats')
      .single();

    // If RPC doesn't exist, calculate manually
    let totalVolume = '0';
    let avgWinRate = 0;

    if (aggregatedError) {
      // Calculate from user_platform_stats
      const { data: stats } = await supabase
        .from('user_platform_stats')
        .select('volume, total_bets, wins');

      if (stats && stats.length > 0) {
        let volumeSum = 0n;
        let totalBets = 0;
        let totalWins = 0;

        stats.forEach((stat: any) => {
          volumeSum += BigInt(stat.volume || 0);
          totalBets += stat.total_bets || 0;
          totalWins += stat.wins || 0;
        });

        totalVolume = volumeSum.toString();
        avgWinRate = totalBets > 0 ? (totalWins / totalBets) * 100 : 0;
      }
    } else {
      totalVolume = aggregatedStats.total_volume || '0';
      avgWinRate = aggregatedStats.avg_win_rate || 0;
    }

    // Get top performer
    const { data: topPerformer, error: topError } = await supabase
      .from('leaderboard_view')
      .select('wallet_address, username, total_score')
      .order('total_score', { ascending: false })
      .limit(1)
      .single();

    // Get platform-specific analytics
    const { data: platforms, error: platformError } = await supabase
      .from('platforms')
      .select('id, name');

    const platformAnalytics = [];

    if (platforms) {
      for (const platform of platforms) {
        const { data: platformStats } = await supabase
          .from('user_platform_stats')
          .select('total_bets, volume, wins')
          .eq('platform_id', platform.id);

        const { data: platformUsers, error: usersErr } = await supabase
          .from('user_platform_stats')
          .select('user_id', { count: 'exact', head: true })
          .eq('platform_id', platform.id);

        if (platformStats && platformStats.length > 0) {
          let totalBets = 0;
          let totalVolume = 0n;
          let totalWins = 0;

          platformStats.forEach((stat: any) => {
            totalBets += stat.total_bets || 0;
            totalVolume += BigInt(stat.volume || 0);
            totalWins += stat.wins || 0;
          });

          const winRate = totalBets > 0 ? (totalWins / totalBets) * 100 : 0;

          platformAnalytics.push({
            name: platform.name,
            total_bets: totalBets,
            total_users: platformUsers?.length || 0,
            total_volume: totalVolume.toString(),
            avg_win_rate: winRate,
            trend: winRate >= 50 ? 'up' : winRate >= 45 ? 'stable' : 'down',
          });
        }
      }
    }

    const response = {
      global: {
        total_bets: betsCount?.count || 0,
        total_users: usersCount?.count || 0,
        total_volume: totalVolume,
        total_platforms: platformsCount?.count || 0,
        avg_win_rate: avgWinRate,
        top_performer: topPerformer
          ? {
              address: topPerformer.wallet_address,
              username: topPerformer.username,
              score: topPerformer.total_score,
            }
          : null,
      },
      platforms: platformAnalytics,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
