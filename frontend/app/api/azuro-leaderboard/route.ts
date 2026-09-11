import { NextRequest, NextResponse } from 'next/server';
import { calculateVeritasScore, VERITASSCORE_CONFIG } from '@/lib/veritasScore';

export const dynamic = 'force-dynamic';

/**
 * Azuro Protocol Leaderboard API
 *
 * Azuro is a decentralized betting infrastructure on Polygon, Gnosis, Arbitrum, and more.
 * Uses The Graph subgraph for data: https://gem.azuro.org/subgraph/overview
 * Uses unified VeritasScore v2.0 system (odds-based market scoring with ROI).
 */

// Azuro subgraph endpoints
const AZURO_SUBGRAPHS = {
  polygon: 'https://thegraph.azuro.org/subgraphs/name/azuro-protocol/azuro-api-polygon-v3',
  gnosis: 'https://thegraph.azuro.org/subgraphs/name/azuro-protocol/azuro-api-gnosis-v3',
  arbitrum: 'https://thegraph.azuro.org/subgraphs/name/azuro-protocol/azuro-api-arbitrum-one-v3',
  linea: 'https://thegraph.azuro.org/subgraphs/name/azuro-protocol/azuro-api-linea-v3',
  chiliz: 'https://thegraph.azuro.org/subgraphs/name/azuro-protocol/azuro-api-chiliz-v3',
} as const;

type AzuroNetwork = keyof typeof AZURO_SUBGRAPHS;

interface AzuroBettor {
  id: string;
  rawTurnover: string;
  rawInBets: string;
  rawToPayout: string;
  betsCount: string;
  wonBetsCount: string;
  lostBetsCount: string;
  pnl: string;
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
 * Query Azuro subgraph for top bettors
 */
async function queryAzuroSubgraph(network: AzuroNetwork, limit: number = 100): Promise<AzuroBettor[]> {
  // Note: betsCount_gt must be a number, not a string
  const query = `
    query GetTopBettors($first: Int!) {
      bettors(
        first: $first
        orderBy: rawTurnover
        orderDirection: desc
        where: { betsCount_gt: 0 }
      ) {
        id
        rawTurnover
        rawInBets
        rawToPayout
        betsCount
        wonBetsCount
        lostBetsCount
        pnl
      }
    }
  `;

  try {
    const response = await fetch(AZURO_SUBGRAPHS[network], {
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
      console.error('Azuro subgraph errors:', result.errors);
      return [];
    }

    return result.data?.bettors || [];
  } catch (error) {
    console.error(`Azuro ${network} subgraph query failed:`, error);
    return [];
  }
}

/**
 * Fetch bettors from multiple networks and merge
 */
async function fetchAllNetworkBettors(limit: number): Promise<{ bettors: AzuroBettor[]; network: string }[]> {
  const networks: AzuroNetwork[] = ['polygon', 'gnosis', 'arbitrum'];

  const results = await Promise.all(
    networks.map(async (network) => {
      const bettors = await queryAzuroSubgraph(network, limit);
      return { bettors, network };
    })
  );

  return results.filter(r => r.bettors.length > 0);
}

/**
 * GET /api/azuro-leaderboard
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const network = searchParams.get('network') as AzuroNetwork | 'all' | null;
  const limit = Math.min(100, parseInt(searchParams.get('limit') || '50'));
  const search = searchParams.get('search')?.toLowerCase();

  try {
    let allBettors: { bettor: AzuroBettor; network: string }[] = [];

    if (network && network !== 'all' && AZURO_SUBGRAPHS[network as AzuroNetwork]) {
      // Query single network
      const bettors = await queryAzuroSubgraph(network as AzuroNetwork, limit);
      allBettors = bettors.map(b => ({ bettor: b, network }));
    } else {
      // Query all networks - fetch more per network for better coverage
      const results = await fetchAllNetworkBettors(Math.max(100, limit));
      for (const result of results) {
        for (const bettor of result.bettors) {
          allBettors.push({ bettor, network: result.network });
        }
      }
    }

    if (allBettors.length === 0) {
      return NextResponse.json({
        success: false,
        data: [],
        count: 0,
        isMock: false,
        source: 'none',
        platform: 'Azuro',
        network: network || 'all',
        error: 'Azuro subgraph unavailable. Please try again later.',
        timestamp: Date.now(),
      }, { status: 503 });
    }

    // Transform to leaderboard entries
    const leaderboard: LeaderboardEntry[] = allBettors.map(({ bettor, network: net }) => {
      // rawTurnover is in smallest units (6 decimals for USDC/USDT)
      const volume = parseFloat(bettor.rawTurnover || '0') / 1e6;
      const pnl = parseFloat(bettor.pnl || '0');
      const totalBets = parseInt(bettor.betsCount || '0');
      const wins = parseInt(bettor.wonBetsCount || '0');
      const losses = parseInt(bettor.lostBetsCount || '0');
      const winRate = totalBets > 0 ? (wins / totalBets) * 100 : 0;

      // Use unified VeritasScore system (odds-based market)
      const scoreResult = calculateVeritasScore({
        pnl,
        volume,
        trades: totalBets,
        platform: 'Azuro',
        lastTradeAt: new Date(),
      });
      const score = scoreResult.totalScore;

      // Extract wallet address from compound ID (format: coreAddress_bettorAddress_lpAddress)
      const idParts = bettor.id.split('_');
      const walletAddress = idParts.length >= 2 ? idParts[1] : bettor.id;

      return {
        rank: 0, // Will be set after sorting
        address: walletAddress,
        veritasScore: score,
        winRate: Math.round(winRate * 10) / 10,
        totalBets,
        wins,
        losses,
        totalVolume: volume.toFixed(2),
        pnl,
        platforms: ['Azuro'],
        network: net,
      };
    });

    // Sort by VeritasScore
    leaderboard.sort((a, b) => b.veritasScore - a.veritasScore);

    // Assign ranks
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
      data: filteredData.slice(0, limit),
      count: filteredData.length,
      isMock: false,
      source: 'azuro-subgraph',
      platform: 'Azuro',
      network: network || 'all',
      networks: ['polygon', 'gnosis', 'arbitrum'],
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('Azuro leaderboard error:', error);

    return NextResponse.json({
      success: false,
      data: [],
      count: 0,
      isMock: false,
      source: 'none',
      platform: 'Azuro',
      network: network || 'all',
      error: `Azuro API error: ${error.message}`,
      timestamp: Date.now(),
    }, { status: 500 });
  }
}
