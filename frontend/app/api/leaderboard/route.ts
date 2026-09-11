import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, Address } from 'viem';
import { somniaTestnet } from 'viem/chains';
import { CONTRACTS, VERITAS_CORE_ABI, REPUTATION_NFT_ABI } from '@/lib/contracts';

export const dynamic = 'force-dynamic';

// Cache configuration
let cachedData: any = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 0; // Disabled for development - set to 5 * 60 * 1000 for production

interface PlatformBreakdown {
  platform: string;
  bets: number;
  winRate: number;
  score: number;
  volume?: string;
}

interface UserBet {
  platform: string;
  marketId: string;
  amount: string;
  position: string;
  timestamp?: number;
  won?: boolean;
  claimedAmount?: string;
}

interface LeaderboardEntry {
  rank: number;
  address: Address;
  veritasScore: number;
  tier: number;
  winRate: number;
  totalPredictions: number;
  correctPredictions: number;
  totalVolume: string;
  nftTokenId: number;
  lastUpdated: number;
  platforms?: string[];
  platformBreakdown?: PlatformBreakdown[];
  bets?: UserBet[];
  totalBets?: number;
  wins?: number;
  losses?: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sortBy = searchParams.get('sortBy') || 'score';
    const tierFilter = searchParams.get('tier') || 'all';
    const searchAddress = searchParams.get('search')?.toLowerCase() || '';

    // Check cache
    const now = Date.now();
    if (cachedData && (now - cacheTimestamp) < CACHE_DURATION) {
      return NextResponse.json({
        data: filterAndSort(cachedData, sortBy, tierFilter, searchAddress),
        cached: true,
        cacheAge: Math.floor((now - cacheTimestamp) / 1000),
      });
    }

    // Create public client for STT testnet
    const publicClient = createPublicClient({
      chain: somniaTestnet,
      transport: http('https://data-seed-presomnia-1-s1.somnia.org:8545'),
    });

    const contracts = CONTRACTS.somniaTestnet;

    // Fetch UserRegistered events
    const registeredEvents = await publicClient.getContractEvents({
      address: contracts.VeritasCore,
      abi: VERITAS_CORE_ABI,
      eventName: 'UserRegistered',
      fromBlock: 'earliest',
      toBlock: 'latest',
    });

    console.log(`Found ${registeredEvents.length} registered users`);

    // Fetch user profiles in parallel (batch of 10 at a time to avoid rate limits)
    const batchSize = 10;
    const leaderboardEntries: LeaderboardEntry[] = [];

    for (let i = 0; i < registeredEvents.length; i += batchSize) {
      const batch = registeredEvents.slice(i, i + batchSize);

      const batchResults = await Promise.allSettled(
        batch.map(async (event: any) => {
          const userAddress = event.args.user as Address;

          // Fetch user profile
          const profile = await publicClient.readContract({
            address: contracts.VeritasCore,
            abi: VERITAS_CORE_ABI,
            functionName: 'getUserProfile',
            args: [userAddress],
          }) as any;

          // Fetch NFT metadata
          const metadata = await publicClient.readContract({
            address: contracts.ReputationNFT,
            abi: REPUTATION_NFT_ABI,
            functionName: 'getMetadata',
            args: [profile.nftTokenId],
          }) as any;

          const veritasScore = Number(metadata.veritasScore);
          const totalPredictions = Number(metadata.totalPredictions);
          const correctPredictions = Number(metadata.correctPredictions);
          const winRate = totalPredictions > 0
            ? (correctPredictions / totalPredictions) * 100
            : 0;

          return {
            rank: 0, // Will be set after sorting
            address: userAddress,
            veritasScore,
            tier: Number(metadata.tier),
            winRate,
            totalPredictions,
            correctPredictions,
            totalVolume: (Number(metadata.totalVolume) / 10 ** 18).toFixed(4),
            nftTokenId: Number(profile.nftTokenId),
            lastUpdated: Number(metadata.lastUpdated),
          };
        })
      );

      // Add successful results
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          leaderboardEntries.push(result.value);
        }
      });
    }

    // Sort by VeritasScore descending
    leaderboardEntries.sort((a, b) => b.veritasScore - a.veritasScore);

    // Assign ranks
    leaderboardEntries.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    // Update cache
    cachedData = leaderboardEntries;
    cacheTimestamp = now;

    return NextResponse.json({
      data: filterAndSort(leaderboardEntries, sortBy, tierFilter, searchAddress),
      cached: false,
      totalUsers: leaderboardEntries.length,
      timestamp: now,
    });
  } catch (error: any) {
    console.error('Leaderboard API error:', error);

    // NO MOCK DATA - Return empty array on error
    return NextResponse.json({
      data: [],
      error: error.message,
      source: 'error',
      message: 'Failed to fetch real data from blockchain',
    }, { status: 500 });
  }
}

function filterAndSort(
  data: LeaderboardEntry[],
  sortBy: string,
  tierFilter: string,
  searchAddress: string
): LeaderboardEntry[] {
  let filtered = [...data];

  // Filter by tier
  if (tierFilter !== 'all') {
    const tierMap: { [key: string]: number } = {
      bronze: 0,
      silver: 1,
      gold: 2,
      platinum: 3,
      diamond: 4,
    };
    const tierValue = tierMap[tierFilter.toLowerCase()];
    if (tierValue !== undefined) {
      filtered = filtered.filter((entry) => entry.tier === tierValue);
    }
  }

  // Filter by address search
  if (searchAddress) {
    filtered = filtered.filter((entry) =>
      entry.address.toLowerCase().includes(searchAddress)
    );
  }

  // Sort
  switch (sortBy) {
    case 'winRate':
      filtered.sort((a, b) => b.winRate - a.winRate);
      break;
    case 'predictions':
      filtered.sort((a, b) => b.totalPredictions - a.totalPredictions);
      break;
    case 'volume':
      filtered.sort((a, b) => parseFloat(b.totalVolume) - parseFloat(a.totalVolume));
      break;
    case 'score':
    default:
      filtered.sort((a, b) => b.veritasScore - a.veritasScore);
      break;
  }

  // Re-assign ranks after filtering/sorting
  filtered.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  return filtered;
}

// NO MOCK DATA - Real data only
