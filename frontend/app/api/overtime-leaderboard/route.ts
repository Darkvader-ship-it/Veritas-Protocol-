import { NextRequest, NextResponse } from 'next/server';
import { calculateVeritasScore, VERITASSCORE_CONFIG } from '@/lib/veritasScore';

export const dynamic = 'force-dynamic';

/**
 * Overtime/Thales Sport Markets Leaderboard API
 *
 * Uses Thales subgraph via The Graph's decentralized network.
 * Uses unified VeritasScore v2.0 system (odds-based market scoring with ROI).
 */

// Graph API key for SportsMarkets (from thales-data)
const GRAPH_API_KEY = 'd19a6a80c2d5a004e62041171d5f4c64';

// Subgraph IDs for SportsMarkets
const SUBGRAPH_IDS = {
  optimism: 'GNVg7vqPeoaqDARvssvwCUaLfizACsrmeFFCpZd4VBDq',
  arbitrum: 'DFNKpS95y26V3kuTa9MtD2J3ws65QF6RPP7RFLRjaHFx',
} as const;

const THALES_SUBGRAPHS = {
  optimism: `https://gateway-arbitrum.network.thegraph.com/api/${GRAPH_API_KEY}/subgraphs/id/${SUBGRAPH_IDS.optimism}`,
  arbitrum: `https://gateway-arbitrum.network.thegraph.com/api/${GRAPH_API_KEY}/subgraphs/id/${SUBGRAPH_IDS.arbitrum}`,
} as const;

interface OvertimeUser {
  id: string;
  volume: string;
  pnl: string;
  trades: string;
  // From subgraph
  totalBets?: number;
  wins?: number;
  losses?: number;
}

interface LeaderboardEntry {
  rank: number;
  address: string;
  username?: string;
  veritasScore: number;
  winRate: number;
  totalBets: number;
  wins: number;
  losses: number;
  totalVolume: string;
  pnl: number;
  platforms: string[];
  network: string;
}


/**
 * Query Thales subgraph for top users
 */
async function queryThalesSubgraph(network: 'optimism' | 'arbitrum', limit: number = 100): Promise<OvertimeUser[]> {
  const query = `
    query GetTopUsers($first: Int!) {
      users(
        first: $first
        orderBy: volume
        orderDirection: desc
        where: { volume_gt: "0" }
      ) {
        id
        volume
        pnl
        trades
      }
    }
  `;

  try {
    const response = await fetch(THALES_SUBGRAPHS[network], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: { first: limit },
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`Subgraph error: ${response.status}`);
    }

    const result = await response.json();

    if (result.errors) {
      console.error('Thales subgraph errors:', result.errors);
      return [];
    }

    return result.data?.users || [];
  } catch (error) {
    console.error(`Thales ${network} subgraph query failed:`, error);
    return [];
  }
}

/**
 * Query individual user's detailed stats
 */
async function queryUserStats(network: 'optimism' | 'arbitrum', address: string): Promise<OvertimeUser | null> {
  const query = `
    query GetUser($id: String!) {
      user(id: $id) {
        id
        volume
        pnl
        trades
      }
      positions(
        where: { user: $id }
        first: 1000
      ) {
        id
        side
        amount
        paid
        isOpen
        isCancelled
        isClaimable
      }
    }
  `;

  try {
    const response = await fetch(THALES_SUBGRAPHS[network], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: { id: address.toLowerCase() },
      }),
    });

    if (!response.ok) return null;

    const result = await response.json();
    const user = result.data?.user;
    const positions = result.data?.positions || [];

    if (!user) return null;

    // Calculate wins from positions
    const wins = positions.filter((p: any) => p.isClaimable && !p.isCancelled).length;
    const totalBets = positions.filter((p: any) => !p.isCancelled).length;

    return {
      ...user,
      totalBets,
      wins,
      losses: totalBets - wins,
    };
  } catch (error) {
    console.error('User stats query failed:', error);
    return null;
  }
}


/**
 * GET /api/overtime-leaderboard
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const network = (searchParams.get('network') || 'optimism') as 'optimism' | 'arbitrum';
  const limit = Math.min(100, parseInt(searchParams.get('limit') || '50'));
  const search = searchParams.get('search')?.toLowerCase();

  try {
    // Query subgraph for top users
    const users = await queryThalesSubgraph(network, limit);

    if (users.length === 0) {
      // Subgraph unavailable - return error (no mock data)
      return NextResponse.json({
        success: false,
        data: [],
        count: 0,
        isMock: false,
        source: 'none',
        platform: 'Overtime',
        network,
        error: 'Thales subgraph unavailable. The Graph hosted service was sunset in June 2024. A Graph API key may be required.',
        timestamp: Date.now(),
      }, { status: 503 });
    }

    // Transform to leaderboard entries
    const leaderboard: LeaderboardEntry[] = users.map((user, index) => {
      const volume = parseFloat(user.volume) / 1e18; // Convert from wei
      const pnl = parseFloat(user.pnl || '0') / 1e18;
      const trades = parseInt(user.trades || '0');

      // Use unified VeritasScore system (odds-based market)
      const scoreResult = calculateVeritasScore({
        pnl,
        volume,
        trades,
        platform: 'Overtime',
        lastTradeAt: new Date(),
      });
      const score = scoreResult.totalScore;

      // Estimate win rate from ROI for display
      const estimatedWinRate = pnl > 0 ? Math.min(0.7, 0.5 + (pnl / volume) * 0.5) : Math.max(0.3, 0.5 + (pnl / volume) * 0.5);
      const estimatedWins = Math.floor(trades * estimatedWinRate);
      const winRate = trades > 0 ? estimatedWinRate * 100 : 0;

      return {
        rank: index + 1,
        address: user.id,
        veritasScore: score,
        winRate,
        totalBets: trades,
        wins: estimatedWins,
        losses: trades - estimatedWins,
        totalVolume: volume.toFixed(2),
        pnl,
        platforms: ['Overtime'],
        network,
      };
    });

    // Sort by score
    leaderboard.sort((a, b) => b.veritasScore - a.veritasScore);

    // Re-rank after sorting
    leaderboard.forEach((entry, idx) => {
      entry.rank = idx + 1;
    });

    // Filter by search if provided
    let filteredData = leaderboard;
    if (search) {
      filteredData = leaderboard.filter(entry =>
        entry.address.toLowerCase().includes(search)
      );
    }

    return NextResponse.json({
      success: true,
      data: filteredData,
      count: filteredData.length,
      isMock: false,
      source: 'thales-subgraph',
      platform: 'Overtime',
      network,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('Overtime leaderboard error:', error);

    // Return error (no mock data)
    return NextResponse.json({
      success: false,
      data: [],
      count: 0,
      isMock: false,
      source: 'none',
      platform: 'Overtime',
      network,
      error: `Thales subgraph error: ${error.message}`,
      timestamp: Date.now(),
    }, { status: 500 });
  }
}
