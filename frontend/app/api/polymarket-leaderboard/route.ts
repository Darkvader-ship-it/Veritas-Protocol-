import { NextRequest, NextResponse } from 'next/server';
import { calculateVeritasScore, VERITASSCORE_CONFIG } from '@/lib/veritasScore';

export const dynamic = 'force-dynamic';

/**
 * Polymarket Leaderboard API
 * Fetches real trader data from Polymarket's official Data API
 * Endpoint: https://data-api.polymarket.com/v1/leaderboard
 *
 * Uses unified VeritasScore v2.0 system (odds-based market scoring with ROI).
 */

const POLYMARKET_LEADERBOARD_URL = 'https://data-api.polymarket.com/v1/leaderboard';

export interface PolymarketTrader {
  rank: string;
  proxyWallet: string;
  userName?: string;
  vol: number;      // Volume in USD
  pnl: number;      // Profit/Loss in USD
  profileImage?: string;
  xUsername?: string;
  verifiedBadge?: boolean;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Build query params
    const params = new URLSearchParams({
      category: searchParams.get('category') || 'OVERALL',
      timePeriod: searchParams.get('timePeriod') || 'ALL',
      orderBy: searchParams.get('orderBy') || 'PNL',
      limit: searchParams.get('limit') || '50',
      offset: searchParams.get('offset') || '0',
    });

    // Optional user filter
    const user = searchParams.get('user');
    if (user) params.append('user', user);

    const response = await fetch(`${POLYMARKET_LEADERBOARD_URL}?${params}`, {
      headers: {
        'Accept': 'application/json',
      },
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      throw new Error(`Polymarket API error: ${response.status}`);
    }

    const traders: PolymarketTrader[] = await response.json();

    // Transform to match our leaderboard format
    const transformedData = traders.map((trader, index) => {
      const volume = trader.vol || 0;
      const pnl = trader.pnl || 0;
      const { score: veritasScore, winRate } = calculatePolymarketScore(trader);

      // Estimate trades from volume (avg trade ~$500)
      const estimatedTrades = Math.max(1, Math.floor(volume / 500));
      const estimatedWinRate = winRate / 100;
      const estimatedWins = Math.floor(estimatedTrades * estimatedWinRate);
      const estimatedLosses = estimatedTrades - estimatedWins;

      return {
        rank: parseInt(trader.rank) || index + 1,
        address: trader.proxyWallet,
        username: trader.userName || null,
        veritasScore,
        winRate,
        totalBets: estimatedTrades,
        wins: estimatedWins,
        losses: estimatedLosses,
        totalVolume: volume.toFixed(2), // Keep as USD string, not wei
        pnl,
        platforms: ['Polymarket'],
        platformBreakdown: [{
          platform: 'Polymarket',
          bets: estimatedTrades,
          winRate,
          score: veritasScore,
          volume: volume.toFixed(2),
          pnl,
        }],
        profileImage: trader.profileImage,
        xUsername: trader.xUsername,
        verifiedBadge: trader.verifiedBadge,
      };
    });

    return NextResponse.json({
      success: true,
      data: transformedData,
      source: 'polymarket-api',
      timestamp: Date.now(),
      count: transformedData.length,
    });

  } catch (error: any) {
    console.error('Polymarket Leaderboard API error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      data: [],
    }, { status: 500 });
  }
}

/**
 * Calculate VeritasScore from Polymarket data using unified scoring system
 */
function calculatePolymarketScore(trader: PolymarketTrader): { score: number; winRate: number } {
  const pnl = trader.pnl || 0;
  const volume = trader.vol || 0;

  if (volume <= 0) return { score: 0, winRate: 50 };

  // Estimate number of trades from volume (assume avg trade is $500)
  const estimatedTrades = Math.max(1, Math.floor(volume / 500));

  // Use unified VeritasScore system (odds-based market)
  // For live API data, assume recent activity (full recency bonus)
  const scoreResult = calculateVeritasScore({
    pnl,
    volume,
    trades: estimatedTrades,
    platform: 'Polymarket',
    lastTradeAt: new Date(), // Live data = active trader
  });

  // Estimate win rate from ROI for display purposes
  const roi = pnl / volume;
  const winRate = Math.max(5, Math.min(95, 50 + (roi * 100)));

  return { score: scoreResult.totalScore, winRate };
}
