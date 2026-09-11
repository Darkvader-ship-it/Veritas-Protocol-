import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Polymarket Auto-Copy Trading
 *
 * This endpoint monitors followed Polymarket leaders and automatically
 * creates simulated trades when they enter new positions.
 *
 * Flow:
 * 1. Get all active follows with auto_copy=true
 * 2. For each unique leader, fetch their recent activity
 * 3. Detect new positions (not already copied)
 * 4. Create simulated trades for all followers
 *
 * Run via Vercel cron every 30 minutes
 */

// Lazy-initialized Supabase client (avoids build-time errors when env vars aren't set)
let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error('Supabase credentials not configured');
    }
    supabase = createClient(url, key);
  }
  return supabase;
}

// Polymarket API endpoints
const POLYMARKET_ACTIVITY_API = 'https://data-api.polymarket.com/activity';
const POLYMARKET_MARKETS_API = 'https://gamma-api.polymarket.com/markets';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel Pro plan allows up to 60s

interface PolymarketActivity {
  id: string;
  timestamp: string;
  type: 'BUY' | 'SELL';
  market: string;
  asset: string;
  outcome: string;
  side: 'BUY' | 'SELL';
  price: number;
  amount: number;
  usdcSize: number;
}

interface LeaderPosition {
  marketId: string;
  marketQuestion?: string;
  outcome: 'Yes' | 'No';
  entryPrice: number;
  amountUsd: number;
  timestamp: string;
}

/**
 * Fetch recent activity for a Polymarket user
 */
async function fetchLeaderActivity(leaderAddress: string): Promise<PolymarketActivity[]> {
  try {
    const url = `${POLYMARKET_ACTIVITY_API}?user=${leaderAddress}&limit=20`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 60 }, // Cache for 1 minute
    });

    if (!response.ok) {
      console.error(`Failed to fetch activity for ${leaderAddress}: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data || [];
  } catch (error) {
    console.error(`Error fetching activity for ${leaderAddress}:`, error);
    return [];
  }
}

/**
 * Fetch market details from Polymarket
 */
async function fetchMarketDetails(marketId: string): Promise<{ question: string } | null> {
  try {
    const response = await fetch(`${POLYMARKET_MARKETS_API}/${marketId}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) return null;

    const data = await response.json();
    return { question: data.question || `Market ${marketId.slice(0, 8)}...` };
  } catch {
    return null;
  }
}

/**
 * Check if we already have a simulated trade for this market/follower
 */
async function hasExistingTrade(follower: string, marketId: string): Promise<boolean> {
  const { data } = await getSupabase()
    .from('polymarket_simulated_trades')
    .select('id')
    .eq('follower', follower)
    .eq('market_id', marketId)
    .limit(1);

  return (data?.length || 0) > 0;
}

/**
 * Check if any follower already has a trade for this market from this leader
 * (used to skip already-processed activities without needing separate table)
 */
async function wasActivityAlreadyCopied(leader: string, marketId: string): Promise<boolean> {
  const { data } = await getSupabase()
    .from('polymarket_simulated_trades')
    .select('id')
    .eq('leader', leader)
    .eq('market_id', marketId)
    .limit(1);

  return (data?.length || 0) > 0;
}

/**
 * Create simulated trade for a follower
 */
async function createSimulatedTrade(
  follower: string,
  leader: string,
  position: LeaderPosition,
  allocationUsd: number
): Promise<boolean> {
  try {
    // Check if already has position
    const exists = await hasExistingTrade(follower, position.marketId);
    if (exists) {
      return false;
    }

    // Use follower's allocation or default to leader's amount (capped)
    const tradeAmount = Math.min(allocationUsd, position.amountUsd, 100);

    const { error } = await getSupabase()
      .from('polymarket_simulated_trades')
      .insert({
        follower,
        leader,
        market_id: position.marketId,
        market_question: position.marketQuestion || `Market ${position.marketId.slice(0, 8)}...`,
        outcome_selected: position.outcome,
        amount_usd: tradeAmount,
        price_at_entry: position.entryPrice,
        outcome: 'pending',
        simulated_at: new Date().toISOString(),
      });

    if (error) {
      console.error(`Error creating trade for ${follower}:`, error.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Error creating simulated trade:`, error);
    return false;
  }
}

export async function GET() {
  const startTime = Date.now();
  console.log('[polymarket-auto-copy] Starting at', new Date().toISOString());

  try {

    // Get all active follows with auto_copy enabled
    const { data: follows, error: followsError } = await getSupabase()
      .from('polymarket_follows')
      .select('follower, leader, leader_username, allocation_usd')
      .eq('is_active', true)
      .eq('auto_copy', true);

    if (followsError) {
      throw followsError;
    }

    if (!follows || follows.length === 0) {
      return NextResponse.json({
        message: 'No active auto-copy follows',
        tradesCreated: 0,
        duration: Date.now() - startTime,
      });
    }

    console.log(`[polymarket-auto-copy] Found ${follows.length} active auto-copy follows`);

    // Group followers by leader
    const leaderFollowers: Record<string, Array<{ follower: string; allocation: number }>> = {};
    for (const follow of follows) {
      if (!leaderFollowers[follow.leader]) {
        leaderFollowers[follow.leader] = [];
      }
      leaderFollowers[follow.leader].push({
        follower: follow.follower,
        allocation: follow.allocation_usd || 10,
      });
    }

    const uniqueLeaders = Object.keys(leaderFollowers);
    console.log(`[polymarket-auto-copy] Monitoring ${uniqueLeaders.length} unique leaders`);

    let tradesCreated = 0;
    let activitiesProcessed = 0;
    let leadersChecked = 0;
    const errors: string[] = [];

    for (const leader of uniqueLeaders) {
      // Timeout protection
      if (Date.now() - startTime > 55000) {
        console.log('[polymarket-auto-copy] Approaching timeout, stopping');
        break;
      }

      try {
        leadersChecked++;

        // Fetch recent activity for this leader
        const activities = await fetchLeaderActivity(leader);

        if (!activities || activities.length === 0) {
          continue;
        }

        // Filter to only BUY activities (entering positions)
        const buyActivities = activities.filter(a =>
          a.type === 'BUY' || a.side === 'BUY'
        );

        for (const activity of buyActivities) {
          // Parse the position first to get market ID
          const marketId = activity.market || activity.asset;
          if (!marketId) continue;

          // Check if this leader's activity on this market was already copied
          const alreadyCopied = await wasActivityAlreadyCopied(leader, marketId);
          if (alreadyCopied) {
            continue;
          }

          // Parse the full position
          const position: LeaderPosition = {
            marketId,
            outcome: (activity.outcome === 'Yes' || activity.outcome === 'No')
              ? activity.outcome
              : 'Yes', // Default to Yes if unclear
            entryPrice: activity.price || 0.5,
            amountUsd: activity.usdcSize || activity.amount || 10,
            timestamp: activity.timestamp,
          };

          // Fetch market question
          const marketDetails = await fetchMarketDetails(position.marketId);
          if (marketDetails) {
            position.marketQuestion = marketDetails.question;
          }

          // Create trades for all followers of this leader
          const followers = leaderFollowers[leader];
          let copiedCount = 0;
          for (const { follower, allocation } of followers) {
            const created = await createSimulatedTrade(
              follower,
              leader,
              position,
              allocation
            );
            if (created) {
              tradesCreated++;
              copiedCount++;
            }
          }

          if (copiedCount > 0) {
            console.log(`[polymarket-auto-copy] Copied ${leader.slice(0, 10)}...'s trade on "${position.marketQuestion?.slice(0, 40)}..." to ${copiedCount} followers`);
          }
          activitiesProcessed++;
        }
      } catch (err: any) {
        console.error(`[polymarket-auto-copy] Error processing leader ${leader}:`, err.message);
        errors.push(leader.slice(0, 10));
      }
    }

    const result = {
      success: true,
      leadersChecked,
      activitiesProcessed,
      tradesCreated,
      totalFollows: follows.length,
      errors: errors.length,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };

    console.log('[polymarket-auto-copy] Complete:', JSON.stringify(result));

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[polymarket-auto-copy] Error:', error);
    return NextResponse.json({
      error: error.message,
      duration: Date.now() - startTime,
    }, { status: 500 });
  }
}
