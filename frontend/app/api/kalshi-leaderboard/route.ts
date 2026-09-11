import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Kalshi Leaderboard API
 *
 * Kalshi is a CFTC-regulated exchange - no public leaderboard API.
 * This returns empty data as Kalshi doesn't expose user data publicly.
 */

interface LeaderboardEntry {
  rank: number;
  address: string;
  veritasScore: number;
  winRate: number;
  totalBets: number;
  wins: number;
  losses: number;
  totalVolume: string;
  pnl: number;
  platforms: string[];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(100, parseInt(searchParams.get('limit') || '50'));

  // Kalshi is a regulated exchange and doesn't expose user leaderboards publicly
  // Users would need to authenticate to see their own stats

  return NextResponse.json({
    success: true,
    data: [] as LeaderboardEntry[],
    count: 0,
    isMock: false,
    platform: 'Kalshi',
    chain: 'Hybrid',
    note: 'Kalshi is a regulated exchange. Public leaderboard not available.',
    timestamp: Date.now(),
  });
}
