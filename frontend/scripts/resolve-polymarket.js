/**
 * Polymarket Trade Resolver
 *
 * Resolves pending Polymarket simulated trades by checking if markets have closed.
 *
 * Usage: node scripts/resolve-polymarket.js
 *
 * In production, this runs via Vercel cron every 5 minutes.
 * Locally, run this script manually or set up a local cron.
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const POLYMARKET_API = 'https://gamma-api.polymarket.com';

async function resolvePolymarketTrades() {
  console.log('🔍 Checking for pending Polymarket trades...');

  // Get all pending trades
  const { data: pendingTrades, error: fetchError } = await supabase
    .from('polymarket_simulated_trades')
    .select('id, market_id, outcome_selected, amount_usd, price_at_entry, market_question')
    .eq('outcome', 'pending');

  if (fetchError) {
    console.error('❌ Error fetching trades:', fetchError.message);
    return;
  }

  if (!pendingTrades || pendingTrades.length === 0) {
    console.log('✅ No pending trades to resolve');
    return;
  }

  console.log(`📊 Found ${pendingTrades.length} pending trades`);

  // Get unique market IDs
  const uniqueMarkets = [...new Set(pendingTrades.map(t => t.market_id))];
  console.log(`🎯 Checking ${uniqueMarkets.length} unique markets`);

  let resolved = 0;
  let skipped = 0;

  for (const marketId of uniqueMarkets) {
    try {
      // Fetch market data from Polymarket
      // Market IDs stored are condition IDs (0x...), need to query by conditionId param
      const isConditionId = marketId.startsWith('0x');
      const apiUrl = isConditionId
        ? `${POLYMARKET_API}/markets?conditionId=${marketId}`
        : `${POLYMARKET_API}/markets/${marketId}`;

      const marketRes = await fetch(apiUrl, {
        headers: { 'Accept': 'application/json' },
      });

      if (!marketRes.ok) {
        console.log(`  ⏭️  Market ${marketId.slice(0, 8)}... - API error (${marketRes.status}), skipping`);
        skipped++;
        continue;
      }

      const marketData = await marketRes.json();
      // If queried by conditionId, result is array - take first match
      const market = isConditionId ? (marketData[0] || null) : marketData;

      if (!market) {
        console.log(`  ⏭️  Market ${marketId.slice(0, 8)}... - Not found, skipping`);
        skipped++;
        continue;
      }

      // Check if market is resolved
      const isResolved = market.closed === true || market.resolvedAt != null;

      if (!isResolved) {
        console.log(`  ⏳ Market "${market.question?.slice(0, 40)}..." - Still open`);
        skipped++;
        continue;
      }

      // Determine winning outcome
      let winningOutcome = null;

      // Parse outcomes and outcomePrices (they're JSON strings in the API)
      let outcomes = market.outcomes;
      let outcomePrices = market.outcomePrices;

      // Parse if they're strings
      if (typeof outcomes === 'string') {
        try { outcomes = JSON.parse(outcomes); } catch (e) { outcomes = []; }
      }
      if (typeof outcomePrices === 'string') {
        try { outcomePrices = JSON.parse(outcomePrices); } catch (e) { outcomePrices = []; }
      }

      // For resolved binary markets, the winning outcome has price close to 1
      if (Array.isArray(outcomes) && Array.isArray(outcomePrices) && outcomes.length === 2) {
        const price0 = parseFloat(outcomePrices[0]) || 0;
        const price1 = parseFloat(outcomePrices[1]) || 0;

        // If one price is very close to 1 (>0.95), that's the winner
        if (price0 > 0.95) {
          winningOutcome = outcomes[0]; // Yes typically
        } else if (price1 > 0.95) {
          winningOutcome = outcomes[1]; // No typically
        }
        // If both are 0, market might be very old - check bestAsk/bestBid
        else if (price0 === 0 && price1 === 0) {
          // For old markets with no liquidity, use bestAsk (1 = certain loss, 0 = certain win)
          if (market.bestAsk === 1 && market.bestBid === 0) {
            // This means "No" won (Yes is worthless)
            winningOutcome = 'No';
          } else if (market.bestAsk === 0 && market.bestBid === 1) {
            winningOutcome = 'Yes';
          }
        }
      }

      // Legacy: Check if outcomes is array of objects with winner field
      if (!winningOutcome && Array.isArray(outcomes)) {
        const yesToken = outcomes.find(o => o?.value === 'Yes' || o?.outcome === 'Yes' || o === 'Yes');
        const noToken = outcomes.find(o => o?.value === 'No' || o?.outcome === 'No' || o === 'No');

        if (yesToken?.winner === true) {
          winningOutcome = 'Yes';
        } else if (noToken?.winner === true) {
          winningOutcome = 'No';
        }
      }

      // Fallback: Check resolution source
      if (!winningOutcome && market.resolutionSource) {
        if (market.resolutionSource.toLowerCase().includes('yes')) {
          winningOutcome = 'Yes';
        } else if (market.resolutionSource.toLowerCase().includes('no')) {
          winningOutcome = 'No';
        }
      }

      // Handle voided markets
      if (!winningOutcome && market.voided) {
        const marketTrades = pendingTrades.filter(t => t.market_id === marketId);
        for (const trade of marketTrades) {
          await supabase
            .from('polymarket_simulated_trades')
            .update({
              outcome: 'refund',
              pnl_usd: 0,
              resolved_at: new Date().toISOString(),
            })
            .eq('id', trade.id);
          resolved++;
        }
        console.log(`  🔄 Market voided - ${marketTrades.length} trades refunded`);
        continue;
      }

      if (!winningOutcome) {
        console.log(`  ❓ Market closed but can't determine winner, skipping`);
        skipped++;
        continue;
      }

      // Resolve trades for this market
      const marketTrades = pendingTrades.filter(t => t.market_id === marketId);
      console.log(`  🏆 Winner: ${winningOutcome} - Resolving ${marketTrades.length} trades`);

      for (const trade of marketTrades) {
        const won = trade.outcome_selected === winningOutcome;
        const amount = Number(trade.amount_usd);
        const entryPrice = trade.price_at_entry ? Number(trade.price_at_entry) : 0.5;

        // Calculate PnL
        let pnl;
        if (won) {
          const shares = amount / entryPrice;
          pnl = shares * (1 - entryPrice);
        } else {
          pnl = -amount;
        }

        await supabase
          .from('polymarket_simulated_trades')
          .update({
            outcome: won ? 'win' : 'loss',
            pnl_usd: pnl.toFixed(2),
            resolved_at: new Date().toISOString(),
          })
          .eq('id', trade.id);

        console.log(`    ${won ? '✅' : '❌'} Trade #${trade.id}: ${trade.outcome_selected} → ${won ? 'WIN' : 'LOSS'} (${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)})`);
        resolved++;
      }
    } catch (err) {
      console.error(`  ❌ Error processing market ${marketId}:`, err.message);
    }
  }

  // Summary
  console.log('\n📋 Summary:');
  console.log(`   Resolved: ${resolved}`);
  console.log(`   Skipped (still open): ${skipped}`);

  // Get updated stats
  const { data: stats } = await supabase
    .from('polymarket_simulated_trades')
    .select('outcome, pnl_usd');

  if (stats) {
    const wins = stats.filter(t => t.outcome === 'win').length;
    const losses = stats.filter(t => t.outcome === 'loss').length;
    const pending = stats.filter(t => t.outcome === 'pending').length;
    const totalPnl = stats.reduce((sum, t) => sum + (Number(t.pnl_usd) || 0), 0);

    console.log(`\n📊 Overall Stats:`);
    console.log(`   Wins: ${wins}`);
    console.log(`   Losses: ${losses}`);
    console.log(`   Pending: ${pending}`);
    console.log(`   Win Rate: ${wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : 'N/A'}%`);
    console.log(`   Total PnL: ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`);
  }
}

// Run
resolvePolymarketTrades()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
