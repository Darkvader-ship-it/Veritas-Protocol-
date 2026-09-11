import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calculateVeritasScore, VERITASSCORE_CONFIG } from '@/lib/veritasScore';

export const dynamic = 'force-dynamic';

/**
 * SX Bet Leaderboard API
 *
 * SX Bet is a decentralized sports betting platform on SX Network.
 * API: https://api.sx.bet/ (Documentation: https://api.docs.sx.bet/)
 *
 * Uses unified VeritasScore v2.0 system (odds-based market scoring with ROI).
 */

const SX_API = 'https://api.sx.bet';

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface TraderStats {
  address: string;
  totalBets: number;
  wins: number;
  losses: number;
  volume: number;
  pnl: number;
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
}

/**
 * Calculate VeritasScore using unified system
 */
function calculateScore(stats: TraderStats): number {
  // Use unified VeritasScore system (odds-based market)
  const scoreResult = calculateVeritasScore({
    pnl: stats.pnl,
    volume: stats.volume,
    trades: stats.totalBets,
    platform: 'SX Bet',
    lastTradeAt: new Date(),
  });
  return scoreResult.totalScore;
}

/**
 * Fetch unique bettors from general trades endpoint
 * Note: This endpoint only returns winning trades, but we use it to discover bettors
 */
async function fetchUniqueBettors(limit: number = 100): Promise<string[]> {
  try {
    const response = await fetch(
      `${SX_API}/trades?limit=${limit}`,
      {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!response.ok) {
      console.error('SX Bet trades API error:', response.status);
      return [];
    }

    const data = await response.json();
    let trades: any[] = [];

    if (data.data?.trades && Array.isArray(data.data.trades)) {
      trades = data.data.trades;
    } else if (data.data && Array.isArray(data.data)) {
      trades = data.data;
    }

    // Extract unique bettor addresses
    const bettors = new Set<string>();
    trades.forEach(t => {
      if (t.bettor) bettors.add(t.bettor);
    });

    console.log(`SX Bet: Found ${bettors.size} unique bettors from ${trades.length} trades`);
    return Array.from(bettors);
  } catch (error) {
    console.error('SX Bet fetchUniqueBettors error:', error);
    return [];
  }
}

/**
 * Fetch a specific bettor's full trade history
 * Using ?bettor= parameter returns ALL trades (wins + losses)
 */
async function fetchBettorTrades(bettor: string, pageSize: number = 100): Promise<any[]> {
  try {
    const response = await fetch(
      `${SX_API}/trades?bettor=${bettor}&pageSize=${pageSize}`,
      {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.data?.trades || [];
  } catch (error) {
    console.error(`SX Bet fetchBettorTrades error for ${bettor.slice(0, 10)}:`, error);
    return [];
  }
}

/**
 * Calculate trader stats from their trades
 * Determines win/loss by comparing bettingOutcomeOne vs outcome
 */
function calculateBettorStats(bettor: string, trades: any[]): TraderStats {
  const stats: TraderStats = {
    address: bettor.toLowerCase(),
    totalBets: 0,
    wins: 0,
    losses: 0,
    volume: 0,
    pnl: 0,
  };

  for (const trade of trades) {
    if (!trade.settled) continue; // Skip unsettled trades

    stats.totalBets++;

    // Use betTimeValue which is the correct USD amount provided by the API
    // (stake field may be in different decimal formats depending on token)
    const stake = parseFloat(trade.betTimeValue || '0');
    stats.volume += stake;

    // Determine if bettor won:
    // - outcome=0: void (no winner)
    // - outcome=1: outcome one won
    // - outcome=2: outcome two won
    // - bettingOutcomeOne: true if bettor bet on outcome one
    const outcome = trade.outcome;
    const bettingOutcomeOne = trade.bettingOutcomeOne;

    if (outcome === 0) {
      // Void - no win or loss
      continue;
    }

    const bettorWon = (bettingOutcomeOne && outcome === 1) || (!bettingOutcomeOne && outcome === 2);

    if (bettorWon) {
      stats.wins++;
      const odds = parseFloat(trade.odds || '1000000000000000000') / 1e18;
      stats.pnl += stake * (odds - 1);
    } else {
      stats.losses++;
      stats.pnl -= stake;
    }
  }

  return stats;
}

/**
 * Fetch leaderboard from simulated trades in database (fallback)
 */
async function fetchFromDatabase(): Promise<LeaderboardEntry[]> {
  try {
    const { data, error } = await supabase
      .from('sxbet_simulated_trades')
      .select('follower, result, amount_usd, pnl_usd')
      .not('result', 'is', null);

    if (error || !data || data.length === 0) {
      console.log('SX Bet: No simulated trades in database');
      return [];
    }

    const traderMap = new Map<string, TraderStats>();

    for (const trade of data) {
      const address = trade.follower?.toLowerCase();
      if (!address) continue;

      let stats = traderMap.get(address);
      if (!stats) {
        stats = { address, totalBets: 0, wins: 0, losses: 0, volume: 0, pnl: 0 };
        traderMap.set(address, stats);
      }

      stats.totalBets++;
      stats.volume += parseFloat(trade.amount_usd || '0');
      stats.pnl += parseFloat(trade.pnl_usd || '0');

      if (trade.result === 'won') {
        stats.wins++;
      } else if (trade.result === 'lost') {
        stats.losses++;
      }
    }

    const entries: LeaderboardEntry[] = [];
    for (const stats of traderMap.values()) {
      if (stats.totalBets < 1) continue;

      const score = calculateScore(stats);
      const winRate = stats.wins + stats.losses > 0
        ? (stats.wins / (stats.wins + stats.losses)) * 100
        : 0;

      entries.push({
        rank: 0,
        address: stats.address,
        veritasScore: score,
        winRate: Math.round(winRate * 10) / 10,
        totalBets: stats.totalBets,
        wins: stats.wins,
        losses: stats.losses,
        totalVolume: stats.volume.toFixed(2),
        pnl: stats.pnl,
        platforms: ['SX Bet'],
      });
    }

    entries.sort((a, b) => b.veritasScore - a.veritasScore);
    entries.forEach((e, i) => e.rank = i + 1);

    console.log(`SX Bet: Found ${entries.length} traders from simulated trades`);
    return entries;
  } catch (error) {
    console.error('SX Bet database fallback error:', error);
    return [];
  }
}

/**
 * GET /api/sxbet-leaderboard
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(100, parseInt(searchParams.get('limit') || '50'));
  const search = searchParams.get('search')?.toLowerCase();

  try {
    // Step 1: Get unique bettors from general trades
    const bettors = await fetchUniqueBettors(200);

    if (bettors.length === 0) {
      console.log('SX Bet: API unavailable, falling back to database');
      const dbLeaderboard = await fetchFromDatabase();

      if (dbLeaderboard.length > 0) {
        let filteredData = dbLeaderboard.slice(0, limit);
        if (search) {
          filteredData = dbLeaderboard.filter(entry =>
            entry.address.toLowerCase().includes(search)
          ).slice(0, limit);
        }

        return NextResponse.json({
          success: true,
          data: filteredData,
          count: filteredData.length,
          totalTraders: dbLeaderboard.length,
          isMock: false,
          source: 'sxbet-simulated',
          platform: 'SX Bet',
          chain: 'SX Network',
          note: 'Showing simulated trading activity (external API unavailable)',
          timestamp: Date.now(),
        });
      }

      return NextResponse.json({
        success: false,
        data: [],
        count: 0,
        isMock: false,
        source: 'none',
        platform: 'SX Bet',
        error: 'SX Bet API temporarily unavailable.',
        timestamp: Date.now(),
      }, { status: 503 });
    }

    // Step 2: Fetch each bettor's full trade history (limit to top 30 to avoid timeout)
    const maxBettorsToFetch = Math.min(bettors.length, 30);
    console.log(`SX Bet: Fetching trade history for ${maxBettorsToFetch} bettors...`);

    const allStats: TraderStats[] = [];

    // Fetch in parallel batches of 5
    for (let i = 0; i < maxBettorsToFetch; i += 5) {
      const batch = bettors.slice(i, i + 5);
      const batchResults = await Promise.all(
        batch.map(async (bettor) => {
          const trades = await fetchBettorTrades(bettor, 100);
          return calculateBettorStats(bettor, trades);
        })
      );
      allStats.push(...batchResults);
    }

    // Step 3: Transform to leaderboard entries
    const leaderboard: LeaderboardEntry[] = allStats
      .filter(stats => stats.totalBets >= VERITASSCORE_CONFIG.MIN_BETS_ODDS)
      .map(stats => {
        const score = calculateScore(stats);
        const winRate = stats.wins + stats.losses > 0
          ? (stats.wins / (stats.wins + stats.losses)) * 100
          : 0;

        return {
          rank: 0,
          address: stats.address,
          veritasScore: score,
          winRate: Math.round(winRate * 10) / 10,
          totalBets: stats.totalBets,
          wins: stats.wins,
          losses: stats.losses,
          totalVolume: stats.volume.toFixed(2),
          pnl: stats.pnl,
          platforms: ['SX Bet'],
        };
      });

    // Sort by VeritasScore and assign ranks
    leaderboard.sort((a, b) => b.veritasScore - a.veritasScore);
    leaderboard.forEach((entry, idx) => {
      entry.rank = idx + 1;
    });

    // Filter by search if provided
    let filteredData = leaderboard.slice(0, limit);
    if (search) {
      filteredData = leaderboard.filter(entry =>
        entry.address.toLowerCase().includes(search)
      ).slice(0, limit);
    }

    console.log(`SX Bet: Returning ${filteredData.length} traders with accurate win/loss data`);

    return NextResponse.json({
      success: true,
      data: filteredData,
      count: filteredData.length,
      totalTraders: allStats.length,
      isMock: false,
      source: 'sxbet-per-bettor',
      platform: 'SX Bet',
      chain: 'SX Network',
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('SX Bet leaderboard error:', error);

    return NextResponse.json({
      success: false,
      data: [],
      count: 0,
      isMock: false,
      source: 'none',
      platform: 'SX Bet',
      error: `SX Bet API error: ${error.message}`,
      timestamp: Date.now(),
    }, { status: 500 });
  }
}
