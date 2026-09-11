import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export const dynamic = 'force-dynamic';

/**
 * SX Bet Trade Resolution
 *
 * Resolves pending simulated trades by querying SX Bet API
 * for settled market results.
 */

const SX_API = 'https://api.sx.bet';

interface PendingTrade {
  id: string;
  market_hash: string;
  outcome: number; // 1 or 2
  amount_usd: number;
  odds_at_entry: number;
  potential_payout: number;
}

interface MarketResult {
  marketHash: string;
  outcome1: string;
  outcome2: string;
  outcomeVoid?: string;
  status: string; // SETTLED, VOIDED, etc.
  reportedOutcome?: number; // 1, 2, or 3 (void)
}

/**
 * Fetch market results from SX Bet
 */
async function fetchMarketResults(marketHashes: string[]): Promise<Map<string, MarketResult>> {
  const resultMap = new Map<string, MarketResult>();

  // SX Bet API requires individual market queries
  // We'll batch these with Promise.all
  const fetchPromises = marketHashes.map(async (hash) => {
    try {
      const response = await fetch(`${SX_API}/markets/${hash}`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) return null;

      const data = await response.json();
      const market = data.data || data;

      if (market && market.marketHash) {
        return {
          marketHash: market.marketHash,
          outcome1: market.outcomeOneName,
          outcome2: market.outcomeTwoName,
          outcomeVoid: market.outcomeVoidName,
          status: market.status,
          reportedOutcome: market.reportedOutcome,
        } as MarketResult;
      }
      return null;
    } catch (error) {
      console.error(`Failed to fetch market ${hash}:`, error);
      return null;
    }
  });

  const results = await Promise.all(fetchPromises);

  for (const result of results) {
    if (result) {
      resultMap.set(result.marketHash, result);
    }
  }

  return resultMap;
}

/**
 * GET /api/sxbet/resolve
 * Resolve pending SX Bet simulated trades
 */
export async function GET() {
  const startTime = Date.now();

  try {
    // Fetch pending trades
    const { data: pendingTrades, error: fetchError } = await supabase
      .from('sxbet_simulated_trades')
      .select('id, market_hash, outcome, amount_usd, odds_at_entry, potential_payout')
      .eq('result', 'pending');

    if (fetchError) {
      // Table might not exist
      if (fetchError.code === '42P01' || fetchError.message?.includes('does not exist')) {
        return NextResponse.json({
          success: true,
          resolved: 0,
          pending: 0,
          message: 'SX Bet simulated trades table not configured',
          duration: Date.now() - startTime,
        });
      }
      throw fetchError;
    }

    if (!pendingTrades || pendingTrades.length === 0) {
      return NextResponse.json({
        success: true,
        resolved: 0,
        pending: 0,
        message: 'No pending SX Bet trades to resolve',
        duration: Date.now() - startTime,
      });
    }

    // Get unique market hashes
    const marketHashes = [...new Set(pendingTrades.map(t => t.market_hash))];

    // Fetch results for all markets
    const results = await fetchMarketResults(marketHashes);

    let totalResolved = 0;
    let totalWins = 0;
    let totalLosses = 0;

    for (const trade of pendingTrades) {
      const result = results.get(trade.market_hash);
      if (!result) continue;

      // Check if market is settled
      if (result.status !== 'SETTLED' && result.status !== 'VOIDED') {
        continue;
      }

      let won = false;
      let pnl = 0;

      if (result.status === 'VOIDED' || result.reportedOutcome === 3) {
        // Void - refund
        pnl = 0;
      } else if (result.reportedOutcome) {
        // Check if user's outcome won
        won = trade.outcome === result.reportedOutcome;
        pnl = won ? trade.potential_payout - trade.amount_usd : -trade.amount_usd;
      }

      // Update trade
      const { error: updateError } = await supabase
        .from('sxbet_simulated_trades')
        .update({
          result: result.status === 'VOIDED' ? 'void' : (won ? 'win' : 'loss'),
          pnl_usd: pnl,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', trade.id);

      if (!updateError) {
        totalResolved++;
        if (result.status !== 'VOIDED') {
          if (won) totalWins++;
          else totalLosses++;
        }
      }
    }

    const winRate = totalWins + totalLosses > 0
      ? ((totalWins / (totalWins + totalLosses)) * 100).toFixed(1)
      : 'N/A';

    return NextResponse.json({
      success: true,
      resolved: totalResolved,
      pending: pendingTrades.length - totalResolved,
      wins: totalWins,
      losses: totalLosses,
      winRate: `${winRate}%`,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('SX Bet resolve error:', error);

    return NextResponse.json({
      success: false,
      error: error.message || 'Resolution failed',
      resolved: 0,
      pending: 0,
      duration: Date.now() - startTime,
    }, { status: 500 });
  }
}
