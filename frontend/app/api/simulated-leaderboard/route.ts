import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calculateVeritasScore, getMarketType } from '@/lib/veritasScore';

export const dynamic = 'force-dynamic';

/**
 * Simulated Trades Leaderboard API
 *
 * Generates per-platform leaderboards from simulated trades stored in Supabase.
 * Aggregates stats by follower (wallet address) and calculates VeritasScore.
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// Platform table configuration
interface PlatformConfig {
  table: string;
  amountCol: string;
  pnlCol: string;
  usdRate: number;
  displayName: string;
}

const PLATFORM_TABLES: Record<string, PlatformConfig> = {
  polymarket: {
    table: 'polymarket_simulated_trades',
    amountCol: 'amount_usd',
    pnlCol: 'pnl_usd',
    usdRate: 1,
    displayName: 'Polymarket',
  },
  azuro: {
    table: 'azuro_simulated_trades',
    amountCol: 'amount_usd',
    pnlCol: 'pnl_usd',
    usdRate: 1,
    displayName: 'Azuro',
  },
  sxbet: {
    table: 'sxbet_simulated_trades',
    amountCol: 'amount_usd',
    pnlCol: 'pnl_usd',
    usdRate: 1,
    displayName: 'SX Bet',
  },
  limitless: {
    table: 'limitless_simulated_trades',
    amountCol: 'amount_usd',
    pnlCol: 'pnl_usd',
    usdRate: 1,
    displayName: 'Limitless',
  },
  overtime: {
    table: 'overtime_simulated_trades',
    amountCol: 'amount_usd',
    pnlCol: 'pnl_usd',
    usdRate: 1,
    displayName: 'Overtime',
  },
  speedmarkets: {
    table: 'speed_simulated_trades',
    amountCol: 'amount_usd',
    pnlCol: 'pnl_usd',
    usdRate: 1,
    displayName: 'Speed Markets',
  },
  dreamdex: {
    table: 'simulated_trades',
    amountCol: 'amount',
    pnlCol: 'pnl',
    usdRate: 600 / 1e18, // STT wei to USD (approximate STT price)
    displayName: 'DreamDEX Event Contracts',
  },
  gnosis: {
    table: 'gnosis_simulated_trades',
    amountCol: 'amount',
    pnlCol: 'pnl',
    usdRate: 1, // xDAI ≈ USD
    displayName: 'Gnosis/Omen',
  },
  drift: {
    table: 'drift_simulated_trades',
    amountCol: 'amount_usdc',
    pnlCol: 'pnl_usdc',
    usdRate: 1, // USDC = USD
    displayName: 'Drift',
  },
  kalshi: {
    table: 'kalshi_simulated_trades',
    amountCol: 'amount_usd',
    pnlCol: 'pnl_usd',
    usdRate: 1,
    displayName: 'Kalshi',
  },
  manifold: {
    table: 'manifold_simulated_trades',
    amountCol: 'amount_mana',
    pnlCol: 'pnl_mana',
    usdRate: 0.01, // 1 MANA ≈ $0.01
    displayName: 'Manifold Markets',
  },
  metaculus: {
    table: 'metaculus_simulated_trades',
    amountCol: 'amount_points',
    pnlCol: 'score',
    usdRate: 0.01, // 1 Point ≈ $0.01
    displayName: 'Metaculus',
  },
};

interface TraderStats {
  follower: string;
  totalBets: number;
  wins: number;
  losses: number;
  pending: number;
  volume: number;
  pnl: number;
}

interface LeaderboardEntry {
  rank: number;
  address: string;
  veritasScore: number;
  winRate: number;
  totalBets: number;
  wins: number;
  losses: number;
  pending: number;
  totalVolume: string;
  pnl: number;
  platforms: string[];
}

/**
 * GET /api/simulated-leaderboard
 *
 * Query params:
 * - platform: Platform name (required) - polymarket, azuro, dreamdex, etc.
 * - limit: Number of results (default 50, max 100)
 * - search: Filter by wallet address
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get('platform')?.toLowerCase();
  const limit = Math.min(100, parseInt(searchParams.get('limit') || '50'));
  const search = searchParams.get('search')?.toLowerCase();

  // Validate platform
  if (!platform) {
    return NextResponse.json({
      success: false,
      error: 'Missing required parameter: platform',
      availablePlatforms: Object.keys(PLATFORM_TABLES),
      timestamp: Date.now(),
    }, { status: 400 });
  }

  const config = PLATFORM_TABLES[platform];
  if (!config) {
    return NextResponse.json({
      success: false,
      error: `Unknown platform: ${platform}`,
      availablePlatforms: Object.keys(PLATFORM_TABLES),
      timestamp: Date.now(),
    }, { status: 400 });
  }

  try {
    // Query all trades for this platform
    const { data: trades, error: fetchError } = await supabase
      .from(config.table)
      .select(`follower, outcome, ${config.amountCol}, ${config.pnlCol}`);

    if (fetchError) {
      // Handle table not existing
      if (fetchError.code === '42P01' || fetchError.message?.includes('does not exist')) {
        return NextResponse.json({
          success: true,
          data: [],
          count: 0,
          platform: config.displayName,
          source: 'simulated-trades',
          note: `No simulated trades table for ${config.displayName}`,
          timestamp: Date.now(),
        });
      }
      throw fetchError;
    }

    if (!trades || trades.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        count: 0,
        platform: config.displayName,
        source: 'simulated-trades',
        note: 'No simulated trades found',
        timestamp: Date.now(),
      });
    }

    // Aggregate stats by follower
    const traderMap = new Map<string, TraderStats>();

    for (const trade of trades) {
      const follower = trade.follower?.toLowerCase();
      if (!follower) continue;

      let stats = traderMap.get(follower);
      if (!stats) {
        stats = {
          follower,
          totalBets: 0,
          wins: 0,
          losses: 0,
          pending: 0,
          volume: 0,
          pnl: 0,
        };
        traderMap.set(follower, stats);
      }

      stats.totalBets++;

      // Get amount and pnl values
      const amount = parseFloat(trade[config.amountCol] || '0');
      const pnl = parseFloat(trade[config.pnlCol] || '0');

      stats.volume += amount;

      // Count outcomes
      const outcome = trade.outcome?.toLowerCase();
      if (outcome === 'win' || outcome === 'won') {
        stats.wins++;
        stats.pnl += pnl;
      } else if (outcome === 'loss' || outcome === 'lost') {
        stats.losses++;
        stats.pnl += pnl;
      } else if (outcome === 'pending') {
        stats.pending++;
      } else if (outcome === 'refund' || outcome === 'canceled') {
        // Refunds don't count toward wins/losses
        stats.totalBets--; // Don't count canceled trades
      }
    }

    // Convert to leaderboard entries with VeritasScore
    const marketType = getMarketType(platform);
    const leaderboard: LeaderboardEntry[] = [];

    for (const stats of traderMap.values()) {
      // Skip traders with no resolved trades
      const resolvedBets = stats.wins + stats.losses;
      if (resolvedBets === 0) continue;

      // Convert to USD
      const volumeUsd = stats.volume * config.usdRate;
      const pnlUsd = stats.pnl * config.usdRate;

      // Calculate VeritasScore
      let scoreResult;
      if (marketType === 'binary') {
        scoreResult = calculateVeritasScore({
          wins: stats.wins,
          losses: stats.losses,
          totalBets: resolvedBets,
          platform: config.displayName,
          lastTradeAt: new Date(),
        });
      } else {
        scoreResult = calculateVeritasScore({
          pnl: pnlUsd,
          volume: volumeUsd,
          trades: resolvedBets,
          platform: config.displayName,
          lastTradeAt: new Date(),
        });
      }

      const winRate = resolvedBets > 0
        ? (stats.wins / resolvedBets) * 100
        : 0;

      leaderboard.push({
        rank: 0, // Will be set after sorting
        address: stats.follower,
        veritasScore: scoreResult.totalScore,
        winRate: Math.round(winRate * 10) / 10,
        totalBets: stats.totalBets,
        wins: stats.wins,
        losses: stats.losses,
        pending: stats.pending,
        totalVolume: volumeUsd.toFixed(2),
        pnl: Math.round(pnlUsd * 100) / 100,
        platforms: [config.displayName],
      });
    }

    // Sort by VeritasScore descending
    leaderboard.sort((a, b) => b.veritasScore - a.veritasScore);

    // Assign ranks
    leaderboard.forEach((entry, idx) => {
      entry.rank = idx + 1;
    });

    // Apply search filter
    let filteredData = leaderboard;
    if (search) {
      filteredData = leaderboard.filter(entry =>
        entry.address.toLowerCase().includes(search)
      );
    }

    return NextResponse.json({
      success: true,
      data: filteredData.slice(0, limit),
      count: filteredData.length,
      totalTraders: leaderboard.length,
      platform: config.displayName,
      source: 'simulated-trades',
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('Simulated leaderboard error:', error);

    return NextResponse.json({
      success: false,
      data: [],
      count: 0,
      platform: config.displayName,
      source: 'simulated-trades',
      error: error.message || 'Failed to fetch leaderboard',
      timestamp: Date.now(),
    }, { status: 500 });
  }
}
