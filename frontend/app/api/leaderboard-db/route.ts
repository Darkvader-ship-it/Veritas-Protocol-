import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { calculateVeritasScore, VERITASSCORE_CONFIG, wilsonScoreLower } from '@/lib/veritasScore';

export const dynamic = 'force-dynamic';

// NO DEMO MODE - Real data only

interface LeaderboardEntry {
  rank: number;
  address: string;
  username?: string;
  veritasScore: number;
  baseScore?: number;  // Lifetime score without recency bonus
  recencyBonus?: number;  // Bonus from recent 90-day activity
  winRate: number;
  totalBets: number;
  wins: number;
  losses: number;
  totalVolume: string;
  platforms?: string[];
  platformBreakdown?: any[];
  bets?: any[];
  followerCount?: number;
  pnl?: number;  // Polymarket PnL (USD)
  roi?: string;  // Polymarket ROI percentage
  profileImage?: string;
  xUsername?: string;
  verifiedBadge?: boolean;
}

// Polymarket Leaderboard API
const POLYMARKET_LEADERBOARD_URL = 'https://data-api.polymarket.com/v1/leaderboard';

interface PolymarketTrader {
  rank: string;
  proxyWallet: string;
  userName?: string;
  vol: number;
  pnl: number;
  profileImage?: string;
  xUsername?: string;
  verifiedBadge?: boolean;
}

/**
 * Calculate Polymarket VeritasScore using unified system
 */
function calculatePolymarketScore(pnl: number, volume: number): {
  score: number;
  roi: number;
} {
  if (volume <= 0) {
    return { score: 0, roi: 0 };
  }

  const roi = pnl / volume;
  const estimatedTrades = Math.floor(volume / 250);

  // Use unified VeritasScore system (odds-based market)
  const result = calculateVeritasScore({
    pnl,
    volume,
    trades: estimatedTrades,
    platform: 'Polymarket',
    lastTradeAt: new Date(),
  });

  return { score: result.totalScore, roi };
}

/**
 * Fetch Polymarket leaderboard data with Wilson-adjusted scoring
 * Includes sample size multiplier to prevent gaming
 */
async function fetchPolymarketLeaderboard(limit: number = 50): Promise<LeaderboardEntry[]> {
  try {
    const params = new URLSearchParams({
      category: 'OVERALL',
      timePeriod: 'ALL',
      orderBy: 'PNL',
      limit: limit.toString(),
    });

    const response = await fetch(`${POLYMARKET_LEADERBOARD_URL}?${params}`, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      console.error('Polymarket API error:', response.status);
      return [];
    }

    const traders: PolymarketTrader[] = await response.json();

    return traders.map((trader, index) => {
      const pnl = trader.pnl || 0;
      const volume = trader.vol || 0;

      // Calculate score with all adjustments
      const scoreResult = calculatePolymarketScore(pnl, volume);

      // Estimate win rate from ROI
      const winRate = scoreResult.roi > 0
        ? Math.min(95, 50 + (scoreResult.roi * 100))
        : Math.max(5, 50 + (scoreResult.roi * 100));
      const roiPercent = (scoreResult.roi * 100).toFixed(2);

      // Estimate trades for display
      const estimatedTrades = Math.floor(volume / 250);

      return {
        rank: parseInt(trader.rank) || index + 1,
        address: trader.proxyWallet,
        username: trader.userName || undefined,
        veritasScore: scoreResult.score,
        winRate,
        totalBets: estimatedTrades,
        wins: 0,
        losses: 0,
        totalVolume: volume.toFixed(2),
        pnl,
        roi: roiPercent,
        platforms: ['Polymarket'],
        platformBreakdown: [{
          platform: 'Polymarket',
          bets: estimatedTrades,
          winRate,
          score: scoreResult.score,
          volume: volume.toFixed(2),
          pnl,
          roi: roiPercent,
        }],
        profileImage: trader.profileImage,
        xUsername: trader.xUsername,
        verifiedBadge: trader.verifiedBadge,
      };
    });
  } catch (error) {
    console.error('Error fetching Polymarket leaderboard:', error);
    return [];
  }
}

// Recency Bonus Configuration (used with VeritasScore v2.0)
const RECENCY_WINDOW_DAYS = 90;  // Look at last 90 days
const RECENCY_BONUS_MAX = 300;   // Max recency bonus (allows 1000 + 300 = 1300 max)

/**
 * Calculate recency bonus based on recent 90-day performance
 * Uses Wilson Score to prevent gaming with small recent sample
 *
 * Final VeritasScore = BaseScore (max 1000) + RecencyBonus (max 300) = max 1300
 */
async function calculateRecencyBonus(userId: string): Promise<{ baseScore: number; recencyBonus: number }> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RECENCY_WINDOW_DAYS);

  try {
    // Get all-time stats (base score = highest platform score, capped at 1000)
    const { data: allTimeStats } = await supabase
      .from('user_platform_stats')
      .select('score')
      .eq('user_id', userId);

    // Use highest platform score as base (not sum) - prevents multi-platform inflation
    const baseScore = Math.min(
      VERITASSCORE_CONFIG.MAX_SCORE,
      Math.max(0, ...(allTimeStats || []).map(stat => stat.score || 0))
    );

    // Get recent bets (last 90 days)
    const { data: recentBets } = await supabase
      .from('bets')
      .select('won, amount, timestamp')
      .eq('user_id', userId)
      .gte('timestamp', cutoffDate.toISOString());

    if (!recentBets || recentBets.length === 0) {
      return { baseScore, recencyBonus: 0 };
    }

    const recentWins = recentBets.filter(bet => bet.won).length;
    const recentTotal = recentBets.length;

    // Require minimum sample for recency bonus
    if (recentTotal < 5) {
      return { baseScore, recencyBonus: 0 };
    }

    // Use Wilson Score for recent win rate
    const recentWilsonRate = wilsonScoreLower(recentWins, recentTotal);

    // Skill from Wilson-adjusted recent win rate (0-150 points)
    // Edge above 50% × 300 = max 150 points for 10%+ proven edge
    const recentEdge = Math.max(0, recentWilsonRate - 0.5);
    const recentSkill = Math.min(150, Math.floor(recentEdge * 3000));

    // Activity from recent bets - logarithmic (0-150 points)
    // log10(10) = 1 → 50pts, log10(100) = 2 → 100pts, log10(1000) = 3 → 150pts
    const recentActivity = Math.min(150, Math.floor(Math.log10(recentTotal) * 50));

    const recencyBonus = Math.min(RECENCY_BONUS_MAX, Math.floor(recentSkill + recentActivity));

    return { baseScore, recencyBonus };
  } catch (error) {
    console.error('Error calculating recency bonus:', error);
    return { baseScore: 0, recencyBonus: 0 };
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sortBy = searchParams.get('sortBy') || 'score';
    const platformFilter = searchParams.get('platform') || 'all';
    const searchAddress = searchParams.get('search')?.toLowerCase() || '';
    const limit = parseInt(searchParams.get('limit') || '100');

    // POLYMARKET - Separate leaderboard (not merged with DreamDEX)
    if (platformFilter === 'Polymarket') {
      try {
        const polymarketData = await getPolymarketLeaderboard(searchAddress, limit);
        return NextResponse.json({
          data: polymarketData,
          cached: false,
          totalUsers: polymarketData.length,
          timestamp: Date.now(),
          source: 'polymarket-api',
          platform: 'Polymarket',
          mode: 'mainnet',
          notice: 'Polymarket uses off-chain CLOB. Addresses are proxy wallets, not verifiable on Polygonscan.',
        });
      } catch (polyError: any) {
        console.error('Polymarket API error:', polyError);
        return NextResponse.json({
          data: [],
          error: polyError.message,
          source: 'polymarket-api',
          platform: 'Polymarket',
        }, { status: 500 });
      }
    }

    // DREAMDEXSWAP / ALL - Query Supabase for on-chain indexed data
    let leaderboardData: LeaderboardEntry[] = [];

    if (platformFilter === 'all') {
      // Query user_platform_stats directly instead of materialized view
      // Only show users with at least 10 bets and score > 0
      const { data: statsData, error: statsError } = await supabase
        .from('user_platform_stats')
        .select(`
          *,
          user:user_id(wallet_address, username),
          platform:platform_id(name)
        `)
        .gt('total_bets', 0)   // Show all traders with bets
        .gte('score', 0)       // Show all scores including 0
        .order('score', { ascending: false })
        .limit(limit);

      if (statsError) {
        throw statsError;
      }

      // Aggregate by user
      const userMap = new Map<string, any>();

      (statsData || []).forEach((stat: any) => {
        const address = stat.user?.wallet_address;
        if (!address) return;

        if (!userMap.has(address)) {
          userMap.set(address, {
            address,
            username: stat.user?.username,
            totalBets: 0,
            wins: 0,
            losses: 0,
            veritasScore: 0,
            totalVolume: '0',
            platforms: [],
          });
        }

        const user = userMap.get(address);
        user.totalBets += stat.total_bets;
        user.wins += stat.wins;
        user.losses += stat.losses;
        // Use highest platform score as base (not sum) - prevents multi-platform inflation
        user.veritasScore = Math.max(user.veritasScore, stat.score);
        user.totalVolume = (BigInt(user.totalVolume) + BigInt(stat.volume || '0')).toString();
        if (stat.platform?.name && !user.platforms.includes(stat.platform.name)) {
          user.platforms.push(stat.platform.name);
        }
      });

      // Calculate recency bonus for top users
      const usersWithBonus = await Promise.all(
        Array.from(userMap.values()).map(async (user) => {
          // Get user ID for recency calculation
          const { data: userData } = await supabase
            .from('users')
            .select('id')
            .eq('wallet_address', user.address.toLowerCase())
            .single();

          let baseScore = user.veritasScore;
          let recencyBonus = 0;

          if (userData?.id) {
            const bonusData = await calculateRecencyBonus(userData.id);
            baseScore = bonusData.baseScore;
            recencyBonus = bonusData.recencyBonus;
          }

          // Cap total at max VeritasScore (1300 = 1000 base + 300 recency)
          const totalScore = Math.min(VERITASSCORE_CONFIG.MAX_TOTAL_SCORE, baseScore + recencyBonus);

          return {
            ...user,
            baseScore,
            recencyBonus,
            veritasScore: totalScore,
            winRate: user.totalBets > 0 ? (user.wins / user.totalBets) * 100 : 0,
          };
        })
      );

      leaderboardData = usersWithBonus
        .sort((a, b) => b.veritasScore - a.veritasScore)
        .map((user, index) => ({
          rank: index + 1,
          address: user.address,
          username: user.username,
          veritasScore: user.veritasScore,
          baseScore: user.baseScore,
          recencyBonus: user.recencyBonus,
          winRate: user.winRate,
          totalBets: user.totalBets,
          wins: user.wins,
          losses: user.losses,
          totalVolume: user.totalVolume,
          platforms: user.platforms,
          followerCount: 0,
        }));
    } else {
      // Filter by specific platform
      const { data: platformData, error: platformError } = await supabase
        .from('platforms')
        .select('id')
        .eq('name', platformFilter)
        .single();

      if (platformError || !platformData) {
        throw new Error('Platform not found');
      }

      const platformId = platformData.id;

      // Query user_platform_stats for specific platform
      const { data, error } = await supabase
        .from('user_platform_stats')
        .select(`
          *,
          user:user_id(wallet_address, username)
        `)
        .eq('platform_id', platformId)
        .order(sortBy === 'score' ? 'score' : sortBy === 'winRate' ? 'win_rate' : 'total_bets', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      leaderboardData = (data || []).map((row: any, index: number) => ({
        rank: index + 1,
        address: row.user?.wallet_address || 'Unknown',
        username: row.user?.username,
        veritasScore: row.score,
        winRate: parseFloat(row.win_rate),
        totalBets: row.total_bets,
        wins: row.wins,
        losses: row.losses,
        totalVolume: row.volume,
        platforms: [platformFilter],
      }));
    }

    // Search filter
    if (searchAddress) {
      leaderboardData = leaderboardData.filter((entry) =>
        entry.address.toLowerCase().includes(searchAddress)
      );
    }

    // Get platform breakdown for top users
    const topUsers = leaderboardData.slice(0, 20);
    const enrichedUsers = await Promise.all(
      topUsers.map(async (user) => {
        // Get platform breakdown
        const { data: statsData } = await supabase
          .from('user_platform_stats')
          .select(`
            *,
            platform:platform_id(name)
          `)
          .eq('user_id', (await supabase
            .from('users')
            .select('id')
            .eq('wallet_address', user.address.toLowerCase())
            .single()).data?.id || '');

        const platformBreakdown = (statsData || []).map((stat: any) => ({
          platform: stat.platform?.name || 'Unknown',
          bets: stat.total_bets,
          winRate: parseFloat(stat.win_rate),
          score: stat.score,
          volume: stat.volume,
        }));

        // Get recent bets
        const { data: betsData } = await supabase
          .from('bets')
          .select(`
            *,
            platform:platform_id(name)
          `)
          .eq('user_id', (await supabase
            .from('users')
            .select('id')
            .eq('wallet_address', user.address.toLowerCase())
            .single()).data?.id || '')
          .order('timestamp', { ascending: false })
          .limit(10);

        const bets = (betsData || []).map((bet: any) => ({
          platform: bet.platform?.name || 'Unknown',
          marketId: bet.market_id,
          amount: bet.amount,
          position: bet.position,
          timestamp: new Date(bet.timestamp).getTime() / 1000,
          won: bet.won,
          claimedAmount: bet.claimed_amount,
        }));

        return {
          ...user,
          platformBreakdown,
          bets,
        };
      })
    );

    // Merge enriched data back
    const finalData = leaderboardData.map((user) => {
      const enriched = enrichedUsers.find((u) => u.address === user.address);
      return enriched || user;
    });

    return NextResponse.json({
      data: finalData,
      cached: false,
      totalUsers: finalData.length,
      timestamp: Date.now(),
      source: 'supabase',
      platform: platformFilter,
      mode: 'mainnet',
    });
  } catch (error: any) {
    console.error('Leaderboard DB API error:', error);

    // Return empty - no fallback mixing
    return NextResponse.json({
      data: [],
      cached: false,
      totalUsers: 0,
      timestamp: Date.now(),
      source: 'none',
      warning: 'Database connection unavailable.',
      error: error.message,
    });
  }
}

/**
 * Dedicated Polymarket leaderboard endpoint
 * Called when platform filter is 'Polymarket'
 */
async function getPolymarketLeaderboard(searchAddress: string, limit: number) {
  const polymarketData = await fetchPolymarketLeaderboard(limit);

  let filteredData = polymarketData;

  // Apply search filter
  if (searchAddress) {
    filteredData = polymarketData.filter((entry) =>
      entry.address.toLowerCase().includes(searchAddress) ||
      entry.username?.toLowerCase().includes(searchAddress)
    );
  }

  // Re-rank after filtering
  const rankedData = filteredData.map((user, index) => ({
    ...user,
    rank: index + 1,
  }));

  return rankedData;
}
