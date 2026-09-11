import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

const LIMITLESS_API = 'https://api.limitless.exchange';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

interface LimitlessMarketResponse {
  id: string;
  slug: string;
  title: string;
  status: string;
  expired: boolean;
  winningIndex?: number;
  outcomeTokens?: Array<{
    symbol: string;
    price: number;
  }>;
  prices?: number[];
}

/**
 * Fetch market details from Limitless API
 */
async function fetchMarket(marketId: string): Promise<LimitlessMarketResponse | null> {
  try {
    // Try fetching by address/ID
    const response = await fetch(`${LIMITLESS_API}/markets/${marketId}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

/**
 * GET /api/limitless/resolve
 * Resolve pending Limitless simulated trades
 */
export async function GET() {
  const startTime = Date.now();

  try {
    // Get all pending trades
    const { data: pendingTrades, error: fetchError } = await supabase
      .from('limitless_simulated_trades')
      .select('id, market_id, market_slug, market_question, position, amount_usd, price_at_entry, expires_at')
      .eq('outcome', 'pending');

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!pendingTrades || pendingTrades.length === 0) {
      return NextResponse.json({
        resolved: 0,
        pending: 0,
        message: 'No pending trades',
        duration: Date.now() - startTime,
      });
    }

    // Get unique market IDs
    const uniqueMarkets = [...new Set(pendingTrades.map(t => t.market_id))];

    let resolved = 0;
    let skipped = 0;

    for (const marketId of uniqueMarkets) {
      if (Date.now() - startTime > 8000) break;

      const market = await fetchMarket(marketId);

      // Check if market expired and should be resolved
      const marketTrades = pendingTrades.filter(t => t.market_id === marketId);
      const now = Date.now();

      if (!market) {
        // If market not found and expired > 24h ago, refund
        for (const trade of marketTrades) {
          const expiresAt = trade.expires_at ? new Date(trade.expires_at).getTime() : 0;
          const hoursAfterExpiry = (now - expiresAt) / (1000 * 60 * 60);

          if (hoursAfterExpiry > 24) {
            await supabase
              .from('limitless_simulated_trades')
              .update({
                outcome: 'refund',
                pnl_usd: 0,
                resolved_at: new Date().toISOString(),
              })
              .eq('id', trade.id);
            resolved++;
          } else {
            skipped++;
          }
        }
        continue;
      }

      // Check if market is resolved
      // winningIndex: 0 = Yes wins, 1 = No wins
      const isResolved = market.expired === true ||
                         market.status === 'resolved' ||
                         market.winningIndex !== undefined;

      if (!isResolved) {
        // Also check if prices are at extremes (0.99/0.01 = resolved)
        const prices = market.prices || [];
        const hasExtremePrice = prices.some((p: number) => p > 0.95 || p < 0.05);

        if (!hasExtremePrice) {
          skipped += marketTrades.length;
          continue;
        }
      }

      // Determine winning outcome
      let winningPosition: 'Yes' | 'No' | null = null;

      if (market.winningIndex !== undefined) {
        // winningIndex 0 = Yes, 1 = No
        winningPosition = market.winningIndex === 0 ? 'Yes' : 'No';
      } else if (market.prices && market.prices.length >= 2) {
        // Use price to determine winner (price > 0.95 = winner)
        if (market.prices[0] > 0.95) {
          winningPosition = 'Yes';
        } else if (market.prices[1] > 0.95) {
          winningPosition = 'No';
        }
      } else if (market.outcomeTokens && market.outcomeTokens.length >= 2) {
        // Check outcome token prices
        const yesPrice = market.outcomeTokens[0]?.price || 0;
        const noPrice = market.outcomeTokens[1]?.price || 0;

        if (yesPrice > 0.95) {
          winningPosition = 'Yes';
        } else if (noPrice > 0.95) {
          winningPosition = 'No';
        }
      }

      if (!winningPosition) {
        skipped += marketTrades.length;
        continue;
      }

      // Resolve trades
      for (const trade of marketTrades) {
        const won = trade.position === winningPosition;
        const amount = Number(trade.amount_usd);
        const entryPrice = trade.price_at_entry ? Number(trade.price_at_entry) : 0.5;

        // Calculate PnL
        let pnl: number;
        if (won) {
          // shares = amount / entryPrice, profit = shares * (1 - entryPrice)
          const shares = amount / entryPrice;
          pnl = shares * (1 - entryPrice);
        } else {
          pnl = -amount;
        }

        await supabase
          .from('limitless_simulated_trades')
          .update({
            outcome: won ? 'win' : 'loss',
            pnl_usd: pnl.toFixed(2),
            resolved_at: new Date().toISOString(),
          })
          .eq('id', trade.id);

        resolved++;
      }
    }

    // Get updated stats
    const { data: stats } = await supabase
      .from('limitless_simulated_trades')
      .select('outcome');

    const wins = stats?.filter(t => t.outcome === 'win').length || 0;
    const losses = stats?.filter(t => t.outcome === 'loss').length || 0;
    const pending = stats?.filter(t => t.outcome === 'pending').length || 0;

    return NextResponse.json({
      resolved,
      skipped,
      pending,
      wins,
      losses,
      winRate: wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) + '%' : 'N/A',
      marketsChecked: uniqueMarkets.length,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Limitless resolve error:', error);
    return NextResponse.json({
      error: error.message,
      duration: Date.now() - startTime,
    }, { status: 500 });
  }
}
