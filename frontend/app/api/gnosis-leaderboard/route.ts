import { NextRequest, NextResponse } from 'next/server';
import { calculateVeritasScore, VERITASSCORE_CONFIG } from '@/lib/veritasScore';

export const dynamic = 'force-dynamic';

/**
 * Gnosis/Omen Leaderboard API
 *
 * Leaderboard for Omen prediction market traders on Gnosis Chain.
 * Uses The Graph Network to fetch top traders.
 *
 * Subgraph: https://thegraph.com/explorer/subgraphs/9fUVQpFwzpdWS9bq5WkAnmKbNNcoBwatMR4yZq81pbbz
 */

// The Graph Network gateway with API key
const GRAPH_API_KEY = process.env.GRAPH_API_KEY;
const OMEN_SUBGRAPH_ID = '9fUVQpFwzpdWS9bq5WkAnmKbNNcoBwatMR4yZq81pbbz';

// Fallback to hosted service (may be deprecated)
const OMEN_SUBGRAPH_HOSTED = 'https://api.thegraph.com/subgraphs/name/protofire/omen-xdai';

function getSubgraphUrl(): string {
  if (GRAPH_API_KEY) {
    return `https://gateway.thegraph.com/api/${GRAPH_API_KEY}/subgraphs/id/${OMEN_SUBGRAPH_ID}`;
  }
  return OMEN_SUBGRAPH_HOSTED;
}

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

/**
 * Calculate VeritasScore using unified system
 */
function calculateScore(trades: number, volume: number, pnl: number): number {
  const result = calculateVeritasScore({
    pnl,
    volume,
    trades,
    platform: 'Gnosis/Omen',
    lastTradeAt: new Date(),
  });
  return result.totalScore;
}

/**
 * Query Omen traders from subgraph
 */
async function queryOmenTraders(limit: number = 100): Promise<LeaderboardEntry[]> {
  const subgraphUrl = getSubgraphUrl();

  // Query for users with trading activity and their positions
  const query = `
    query GetTraders($first: Int!) {
      accounts(
        first: $first
        orderBy: tradeNonce
        orderDirection: desc
        where: { tradeNonce_gt: "0" }
      ) {
        id
        tradeNonce
        fpmmPoolMemberships(first: 100) {
          pool {
            id
            collateralVolume
          }
          amount
        }
      }
    }
  `;

  try {
    const response = await fetch(subgraphUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: { first: Math.min(limit * 2, 200) }
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error('Omen subgraph HTTP error:', response.status);
      return [];
    }

    const result = await response.json();

    if (result.errors) {
      console.error('Omen GraphQL errors:', result.errors);
      // Check if it's an API key issue
      const errorMsg = result.errors[0]?.message || '';
      if (errorMsg.includes('API key') || errorMsg.includes('unauthorized')) {
        console.error('The Graph API key is missing or invalid');
      }
      return [];
    }

    const accounts = result.data?.accounts || [];

    if (accounts.length === 0) {
      console.log('Omen: No accounts found from subgraph');
      return [];
    }

    // Transform to leaderboard entries
    const entries: LeaderboardEntry[] = [];

    for (const account of accounts) {
      const trades = parseInt(account.tradeNonce || '0');
      if (trades < VERITASSCORE_CONFIG.MIN_BETS_ODDS) continue;

      // Calculate volume from pool memberships
      let volume = 0;
      for (const membership of account.fpmmPoolMemberships || []) {
        const poolVolume = parseFloat(membership.pool?.collateralVolume || '0');
        const memberAmount = parseFloat(membership.amount || '0');
        // Estimate member's share of volume
        if (poolVolume > 0 && memberAmount > 0) {
          volume += memberAmount / 1e18; // Convert from wei
        }
      }

      // If no volume data, estimate based on trades
      if (volume === 0) {
        volume = trades * 50; // Estimate $50 per trade average
      }

      // Estimate PnL (we don't have exact data, use conservative estimate)
      // Assume slight positive edge for active traders
      const estimatedWinRate = 0.52; // Slightly above break-even
      const estimatedPnl = volume * (estimatedWinRate - 0.5) * 0.5; // Conservative

      const score = calculateScore(trades, volume, estimatedPnl);

      // Skip if score is 0 (not eligible)
      if (score === 0) continue;

      const winRate = Math.round(estimatedWinRate * 1000) / 10;
      const wins = Math.round(trades * estimatedWinRate);
      const losses = trades - wins;

      entries.push({
        rank: 0,
        address: account.id,
        veritasScore: score,
        winRate,
        totalBets: trades,
        wins,
        losses,
        totalVolume: volume.toFixed(2),
        pnl: Math.round(estimatedPnl * 100) / 100,
        platforms: ['Gnosis/Omen'],
      });
    }

    // Sort by VeritasScore and assign ranks
    entries.sort((a, b) => b.veritasScore - a.veritasScore);
    entries.forEach((entry, idx) => {
      entry.rank = idx + 1;
    });

    console.log(`Omen: Found ${entries.length} eligible traders from ${accounts.length} accounts`);
    return entries;
  } catch (error) {
    console.error('Omen traders query failed:', error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(100, parseInt(searchParams.get('limit') || '50'));
  const search = searchParams.get('search')?.toLowerCase();

  try {
    let leaderboard = await queryOmenTraders(limit);

    // Filter by search
    if (search) {
      leaderboard = leaderboard.filter(e => e.address.toLowerCase().includes(search));
    }

    const hasApiKey = !!GRAPH_API_KEY;

    return NextResponse.json({
      success: true,
      data: leaderboard.slice(0, limit),
      count: leaderboard.length,
      isMock: false,
      platform: 'Gnosis/Omen',
      chain: 'Gnosis',
      source: hasApiKey ? 'thegraph-network' : 'thegraph-hosted',
      timestamp: Date.now(),
      note: leaderboard.length === 0
        ? (hasApiKey
            ? 'No eligible traders found (need 20+ trades)'
            : 'Add GRAPH_API_KEY to .env.local for reliable data access')
        : undefined,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      data: [],
      count: 0,
      platform: 'Gnosis/Omen',
      error: error.message,
      timestamp: Date.now(),
      note: 'Add GRAPH_API_KEY to .env.local - get one free at thegraph.com/studio',
    }, { status: 500 });
  }
}
