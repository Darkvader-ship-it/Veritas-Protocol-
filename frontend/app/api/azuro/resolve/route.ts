import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export const dynamic = 'force-dynamic';

/**
 * Azuro Protocol Trade Resolution
 *
 * Resolves pending simulated trades by querying Azuro subgraph
 * for game/condition results.
 */

const AZURO_SUBGRAPHS = {
  polygon: 'https://thegraph.azuro.org/subgraphs/name/azuro-protocol/azuro-api-polygon-v3',
  gnosis: 'https://thegraph.azuro.org/subgraphs/name/azuro-protocol/azuro-api-gnosis-v3',
  arbitrum: 'https://thegraph.azuro.org/subgraphs/name/azuro-protocol/azuro-api-arbitrum-one-v3',
} as const;

interface PendingTrade {
  id: string;
  condition_id: string;
  outcome_id: string;
  amount_usd: number;
  odds_at_entry: number;
  potential_payout: number;
  network: string;
}

interface ConditionResult {
  conditionId: string;
  status: string; // Resolved, Canceled
  wonOutcomeIds: string[];
}

/**
 * Query condition results from subgraph
 */
async function queryConditionResults(network: string, conditionIds: string[]): Promise<Map<string, ConditionResult>> {
  const subgraphUrl = AZURO_SUBGRAPHS[network as keyof typeof AZURO_SUBGRAPHS];
  if (!subgraphUrl) return new Map();

  const query = `
    query GetConditions($ids: [ID!]!) {
      conditions(where: { id_in: $ids }) {
        id
        conditionId
        status
        wonOutcomes {
          outcomeId
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
        variables: { ids: conditionIds },
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return new Map();

    const result = await response.json();
    const conditions = result.data?.conditions || [];

    const resultMap = new Map<string, ConditionResult>();
    for (const cond of conditions) {
      resultMap.set(cond.id, {
        conditionId: cond.conditionId,
        status: cond.status,
        wonOutcomeIds: cond.wonOutcomes?.map((w: any) => w.outcomeId) || [],
      });
    }

    return resultMap;
  } catch (error) {
    console.error(`Azuro ${network} condition query failed:`, error);
    return new Map();
  }
}

/**
 * GET /api/azuro/resolve
 * Resolve pending Azuro simulated trades
 */
export async function GET() {
  const startTime = Date.now();

  try {
    // Fetch pending trades
    const { data: pendingTrades, error: fetchError } = await supabase
      .from('azuro_simulated_trades')
      .select('id, condition_id, outcome_id, amount_usd, odds_at_entry, potential_payout, network')
      .eq('outcome', 'pending');

    if (fetchError) {
      // Table might not exist
      if (fetchError.code === '42P01' || fetchError.message?.includes('does not exist')) {
        return NextResponse.json({
          success: true,
          resolved: 0,
          pending: 0,
          message: 'Azuro simulated trades table not configured',
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
        message: 'No pending Azuro trades to resolve',
        duration: Date.now() - startTime,
      });
    }

    // Group trades by network
    const tradesByNetwork = new Map<string, PendingTrade[]>();
    for (const trade of pendingTrades) {
      const network = trade.network || 'polygon';
      if (!tradesByNetwork.has(network)) {
        tradesByNetwork.set(network, []);
      }
      tradesByNetwork.get(network)!.push(trade);
    }

    let totalResolved = 0;
    let totalWins = 0;
    let totalLosses = 0;

    // Process each network
    for (const [network, trades] of tradesByNetwork.entries()) {
      const conditionIds = [...new Set(trades.map(t => t.condition_id))];
      const results = await queryConditionResults(network, conditionIds);

      for (const trade of trades) {
        const result = results.get(trade.condition_id);
        if (!result) continue;

        // Only process resolved or canceled conditions
        if (result.status !== 'Resolved' && result.status !== 'Canceled') {
          continue;
        }

        let won = false;
        let pnl = 0;

        if (result.status === 'Canceled') {
          // Refund - no win or loss
          pnl = 0;
        } else {
          // Check if user's outcome won
          won = result.wonOutcomeIds.includes(trade.outcome_id);
          pnl = won ? trade.potential_payout - trade.amount_usd : -trade.amount_usd;
        }

        // Update trade
        const { error: updateError } = await supabase
          .from('azuro_simulated_trades')
          .update({
            outcome: result.status === 'Canceled' ? 'canceled' : (won ? 'win' : 'loss'),
            pnl_usd: pnl,
            resolved_at: new Date().toISOString(),
          })
          .eq('id', trade.id);

        if (!updateError) {
          totalResolved++;
          if (result.status !== 'Canceled') {
            if (won) totalWins++;
            else totalLosses++;
          }
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
    console.error('Azuro resolve error:', error);

    return NextResponse.json({
      success: false,
      error: error.message || 'Resolution failed',
      resolved: 0,
      pending: 0,
      duration: Date.now() - startTime,
    }, { status: 500 });
  }
}
