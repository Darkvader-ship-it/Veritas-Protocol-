import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: { address: string } }
) {
  const address = params.address;

  if (!address) {
    return NextResponse.json({ error: 'Address required' }, { status: 400 });
  }

  try {
    // Get user by wallet address
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, wallet_address, username')
      .eq('wallet_address', address.toLowerCase())
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Trader not found' },
        { status: 404 }
      );
    }

    // Get overall stats from leaderboard view
    const { data: leaderboardEntry, error: leaderboardError } = await supabase
      .from('leaderboard_view')
      .select('*')
      .eq('id', user.id)
      .single();

    if (leaderboardError) {
      console.error('Leaderboard error:', leaderboardError);
    }

    // Get platform breakdown
    const { data: platformStats, error: platformError } = await supabase
      .from('user_platform_stats')
      .select(`
        total_bets,
        wins,
        losses,
        win_rate,
        volume,
        score,
        platform:platforms(name)
      `)
      .eq('user_id', user.id)
      .order('total_bets', { ascending: false });

    if (platformError) {
      console.error('Platform stats error:', platformError);
    }

    // Get recent bets
    const { data: recentBets, error: betsError } = await supabase
      .from('bets')
      .select(`
        id,
        market_id,
        position,
        amount,
        won,
        claimed_amount,
        timestamp,
        tx_hash,
        platform:platforms(name)
      `)
      .eq('user_id', user.id)
      .order('timestamp', { ascending: false })
      .limit(20);

    if (betsError) {
      console.error('Bets error:', betsError);
    }

    // Get follower count
    const { data: followers, error: followersError } = await supabase
      .from('copy_follows')
      .select('id')
      .eq('trader_id', user.id)
      .eq('is_active', true);

    const followerCount = followers?.length || 0;

    // Get rank from leaderboard
    const { data: allUsers, error: rankError } = await supabase
      .from('leaderboard_view')
      .select('id, total_score')
      .order('total_score', { ascending: false });

    let rank = null;
    if (allUsers) {
      rank = allUsers.findIndex((u: any) => u.id === user.id) + 1;
    }

    // Format the response
    const profile = {
      wallet_address: user.wallet_address,
      username: user.username,
      total_bets: leaderboardEntry?.total_bets || 0,
      wins: leaderboardEntry?.wins || 0,
      losses: leaderboardEntry?.losses || 0,
      win_rate: leaderboardEntry?.win_rate || 0,
      total_score: leaderboardEntry?.total_score || 0,
      total_volume: leaderboardEntry?.total_volume || '0',
      platforms: (platformStats || []).map((stat: any) => ({
        name: stat.platform.name,
        total_bets: stat.total_bets,
        wins: stat.wins,
        losses: stat.losses,
        win_rate: stat.win_rate,
        volume: stat.volume,
        score: stat.score,
      })),
      recent_bets: (recentBets || []).map((bet: any) => ({
        id: bet.id,
        platform: bet.platform.name,
        market_id: bet.market_id,
        position: bet.position,
        amount: bet.amount,
        won: bet.won,
        claimed_amount: bet.claimed_amount,
        timestamp: bet.timestamp,
        tx_hash: bet.tx_hash,
      })),
      follower_count: followerCount,
      rank,
    };

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('Error fetching trader profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
