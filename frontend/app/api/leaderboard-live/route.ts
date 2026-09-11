import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { calculateVeritasScore, VERITASSCORE_CONFIG } from '@/lib/veritasScore';

// DreamDEX Event Contracts V2 on Somnia Mainnet
const DREAMDEX_PREDICTION = '0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9';

// Event signatures
const BET_BULL_TOPIC = ethers.id('BetBull(address,uint256,uint256)');
const BET_BEAR_TOPIC = ethers.id('BetBear(address,uint256,uint256)');
const CLAIM_TOPIC = ethers.id('Claim(address,uint256,uint256)');

// Somnia RPC endpoints
const Somnia_RPCS = [
  'https://somnia-dataseed.somnia.org',
  'https://somnia-dataseed1.somnia.org',
  'https://somnia-dataseed2.somnia.org',
];

// Cache for leaderboard data (refresh every 10 minutes)
let cachedData: any = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

interface TraderStats {
  address: string;
  totalBets: number;
  bullBets: number;
  bearBets: number;
  claims: number;
  totalBetAmount: bigint;
  totalClaimedAmount: bigint;
  estimatedWinRate: number;
  veritasScore: number;
}

async function getProvider(): Promise<ethers.JsonRpcProvider> {
  for (const rpc of Somnia_RPCS) {
    try {
      const provider = new ethers.JsonRpcProvider(rpc);
      await provider.getBlockNumber();
      return provider;
    } catch {
      continue;
    }
  }
  throw new Error('All Somnia RPCs failed');
}

// Delay helper
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function indexTraders(provider: ethers.JsonRpcProvider): Promise<TraderStats[]> {
  const currentBlock = await provider.getBlockNumber();

  // Scan last ~4 hours only (Somnia ~3s per block = ~4800 blocks)
  // This avoids rate limits while still getting active traders
  const blocksToScan = 2000; // ~1.5 hours
  const fromBlock = currentBlock - blocksToScan;

  console.log(`[Leaderboard] Scanning blocks ${fromBlock} to ${currentBlock}`);

  const tradersMap = new Map<string, TraderStats>();

  // Helper to update trader stats
  const updateTrader = (address: string, update: Partial<TraderStats>) => {
    const existing = tradersMap.get(address.toLowerCase()) || {
      address: address.toLowerCase(),
      totalBets: 0,
      bullBets: 0,
      bearBets: 0,
      claims: 0,
      totalBetAmount: 0n,
      totalClaimedAmount: 0n,
      estimatedWinRate: 0,
      veritasScore: 0,
    };

    tradersMap.set(address.toLowerCase(), {
      ...existing,
      ...update,
      totalBets: (existing.totalBets || 0) + (update.totalBets || 0),
      bullBets: (existing.bullBets || 0) + (update.bullBets || 0),
      bearBets: (existing.bearBets || 0) + (update.bearBets || 0),
      claims: (existing.claims || 0) + (update.claims || 0),
      totalBetAmount: (existing.totalBetAmount || 0n) + (update.totalBetAmount || 0n),
      totalClaimedAmount: (existing.totalClaimedAmount || 0n) + (update.totalClaimedAmount || 0n),
    });
  };

  // Scan in smaller chunks with delays to avoid rate limits
  const chunkSize = 500; // Smaller chunks

  for (let start = fromBlock; start < currentBlock; start += chunkSize) {
    const end = Math.min(start + chunkSize - 1, currentBlock);

    try {
      // Add delay between requests to avoid rate limiting
      await delay(200);

      // Get BetBull events
      const bullLogs = await provider.getLogs({
        address: DREAMDEX_PREDICTION,
        topics: [BET_BULL_TOPIC],
        fromBlock: start,
        toBlock: end,
      });

      for (const log of bullLogs) {
        const sender = '0x' + log.topics[1]?.slice(26);
        const amount = BigInt(log.data.slice(0, 66));
        updateTrader(sender, { bullBets: 1, totalBets: 1, totalBetAmount: amount });
      }

      await delay(200);

      // Get BetBear events
      const bearLogs = await provider.getLogs({
        address: DREAMDEX_PREDICTION,
        topics: [BET_BEAR_TOPIC],
        fromBlock: start,
        toBlock: end,
      });

      for (const log of bearLogs) {
        const sender = '0x' + log.topics[1]?.slice(26);
        const amount = BigInt(log.data.slice(0, 66));
        updateTrader(sender, { bearBets: 1, totalBets: 1, totalBetAmount: amount });
      }

      await delay(200);

      // Get Claim events
      const claimLogs = await provider.getLogs({
        address: DREAMDEX_PREDICTION,
        topics: [CLAIM_TOPIC],
        fromBlock: start,
        toBlock: end,
      });

      for (const log of claimLogs) {
        const sender = '0x' + log.topics[1]?.slice(26);
        const amount = BigInt(log.data.slice(0, 66));
        updateTrader(sender, { claims: 1, totalClaimedAmount: amount });
      }

      console.log(`[Leaderboard] Scanned blocks ${start}-${end}, found ${tradersMap.size} traders so far`);

    } catch (error: any) {
      console.error(`[Leaderboard] Error scanning blocks ${start}-${end}:`, error.message);
      // Wait longer on error
      await delay(1000);
    }
  }

  // Calculate win rate and score for each trader using unified VeritasScore system
  const traders = Array.from(tradersMap.values()).map(trader => {
    // Estimate win rate from claims vs bets
    const estimatedWinRate = trader.totalBets > 0
      ? Math.min(100, (trader.claims / trader.totalBets) * 100)
      : 0;

    // Use unified VeritasScore system (binary market - DreamDEX is 50/50 up/down)
    const wins = trader.claims;
    const losses = trader.totalBets - trader.claims;

    const scoreResult = calculateVeritasScore({
      wins,
      losses,
      totalBets: trader.totalBets,
      platform: 'DreamDEX',
      lastTradeAt: new Date(),
    });

    return {
      ...trader,
      estimatedWinRate: Math.round(estimatedWinRate * 10) / 10,
      veritasScore: scoreResult.totalScore,
    };
  });

  // Sort by VeritasScore descending
  traders.sort((a, b) => b.veritasScore - a.veritasScore);

  // Return top 100
  return traders.slice(0, 100);
}

export async function GET() {
  try {
    // Check cache
    const now = Date.now();
    if (cachedData && (now - cacheTimestamp) < CACHE_DURATION) {
      return NextResponse.json({
        ...cachedData,
        cached: true,
        cacheAge: Math.floor((now - cacheTimestamp) / 1000),
      });
    }

    console.log('[Leaderboard] Fetching fresh data from Somnia...');

    const provider = await getProvider();
    const traders = await indexTraders(provider);

    // Format for leaderboard - use unified min bets requirement
    const leaderboardData = traders
      .filter(t => t.totalBets >= VERITASSCORE_CONFIG.MIN_BETS_BINARY) // Minimum 30 bets to appear
      .map((trader, index) => ({
        rank: index + 1,
        address: trader.address,
        veritasScore: trader.veritasScore,
        // Tier based on 1300 scale: Diamond(900+), Platinum(650+), Gold(400+), Silver(200+), Bronze(0+)
        tier: trader.veritasScore >= 900 ? 4 : trader.veritasScore >= 650 ? 3 : trader.veritasScore >= 400 ? 2 : trader.veritasScore >= 200 ? 1 : 0,
        winRate: trader.estimatedWinRate,
        totalBets: trader.totalBets,
        wins: trader.claims,
        losses: trader.totalBets - trader.claims,
        totalVolume: trader.totalBetAmount.toString(),
        platforms: ['DreamDEX Event Contracts'],
        platformBreakdown: [{
          platform: 'DreamDEX Event Contracts',
          bets: trader.totalBets,
          winRate: trader.estimatedWinRate,
          score: trader.veritasScore,
          volume: trader.totalBetAmount.toString(),
        }],
      }));

    // Update cache
    cachedData = {
      data: leaderboardData,
      totalUsers: leaderboardData.length,
      timestamp: now,
      source: 'somnia-live',
      blocksScanned: 50000,
    };
    cacheTimestamp = now;

    console.log(`[Leaderboard] Found ${leaderboardData.length} traders`);

    return NextResponse.json({
      ...cachedData,
      cached: false,
    });

  } catch (error: any) {
    console.error('[Leaderboard] Error:', error);
    return NextResponse.json({
      data: [],
      error: error.message,
      source: 'error',
    }, { status: 500 });
  }
}
