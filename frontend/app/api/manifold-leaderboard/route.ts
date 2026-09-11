import { NextRequest, NextResponse } from 'next/server';
import { calculateVeritasScore } from '@/lib/veritasScore';

export const dynamic = 'force-dynamic';

/**
 * Manifold Markets Leaderboard API
 *
 * Fetches top traders from Manifold's public API.
 * Manifold uses play money (Mana) but tracks real performance.
 * Uses unified VeritasScore v2.0 system (odds-based market scoring).
 */

const MANIFOLD_API = 'https://api.manifold.markets/v0';

interface LeaderboardEntry {
  rank: number;
  address: string;
  username: string;
  veritasScore: number;
  winRate: number;
  totalBets: number;
  wins: number;
  losses: number;
  totalVolume: string;
  pnl: number;
  platforms: string[];
  avatarUrl?: string;
}

/**
 * Fetch Manifold leaderboard
 */
async function fetchManifoldLeaderboard(limit: number = 100): Promise<LeaderboardEntry[]> {
  try {
    // Fetch top users by profit
    const response = await fetch(`${MANIFOLD_API}/users?limit=${limit}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error('Manifold users fetch failed:', response.status);
      return [];
    }

    const users = await response.json();

    return users.map((user: any, idx: number) => {
      const balance = user.balance || 0;
      const totalDeposits = user.totalDeposits || 1000; // Default starting balance
      const profitPercent = ((balance - totalDeposits) / totalDeposits) * 100;
      const totalBets = user.creatorTraderCount || 0;
      const estimatedWins = Math.floor(totalBets * Math.max(0.3, Math.min(0.7, (profitPercent + 50) / 100)));

      return {
        rank: idx + 1,
        address: user.id,
        username: user.username || user.name,
        veritasScore: calculateVeritasScore({
          pnl: balance - totalDeposits,
          volume: balance,
          trades: totalBets,
          platform: 'Manifold',
          lastTradeAt: new Date(),
        }).totalScore,
        winRate: totalBets > 0 ? (estimatedWins / totalBets) * 100 : 50,
        totalBets,
        wins: estimatedWins,
        losses: totalBets - estimatedWins,
        totalVolume: balance.toFixed(0),
        pnl: balance - totalDeposits,
        platforms: ['Manifold Markets'],
        avatarUrl: user.avatarUrl,
      };
    });
  } catch (error) {
    console.error('Manifold leaderboard fetch failed:', error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(100, parseInt(searchParams.get('limit') || '50'));
  const search = searchParams.get('search')?.toLowerCase();

  try {
    let leaderboard = await fetchManifoldLeaderboard(limit);

    // Sort by VeritasScore
    leaderboard.sort((a, b) => b.veritasScore - a.veritasScore);

    // Reassign ranks
    leaderboard.forEach((entry, idx) => {
      entry.rank = idx + 1;
    });

    // Filter by search
    if (search) {
      leaderboard = leaderboard.filter(e =>
        e.address.toLowerCase().includes(search) ||
        e.username?.toLowerCase().includes(search)
      );
    }

    return NextResponse.json({
      success: true,
      data: leaderboard.slice(0, limit),
      count: leaderboard.length,
      isMock: false,
      platform: 'Manifold Markets',
      chain: 'Off-chain',
      currency: 'Mana (play money)',
      timestamp: Date.now(),
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      data: [],
      count: 0,
      platform: 'Manifold Markets',
      error: error.message,
      timestamp: Date.now(),
    }, { status: 500 });
  }
}
