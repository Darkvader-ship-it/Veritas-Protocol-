/**
 * One-time script to resolve all pending simulated trades
 */

const { ethers } = require('ethers');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
// Load local .env first (has service key), then frontend env
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../frontend/.env.local') });

const CONFIG = {
  Somnia_MAINNET_RPC: 'https://somnia-dataseed1.somnia.org',
  DREAMDEX_PREDICTION_MAINNET: '0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9',
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  SUPABASE_KEY: process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

const DREAMDEX_ABI = [
  'function currentEpoch() view returns (uint256)',
  'function rounds(uint256 epoch) view returns (uint256 epoch, uint256 startTimestamp, uint256 lockTimestamp, uint256 closeTimestamp, int256 lockPrice, int256 closePrice, uint256 lockOracleId, uint256 closeOracleId, uint256 totalAmount, uint256 bullAmount, uint256 bearAmount, uint256 rewardBaseCalAmount, uint256 rewardAmount, bool oracleCalled)',
];

async function main() {
  console.log('Resolving pending simulated trades...\n');

  const provider = new ethers.JsonRpcProvider(CONFIG.Somnia_MAINNET_RPC);
  const dreamdex = new ethers.Contract(CONFIG.DREAMDEX_PREDICTION_MAINNET, DREAMDEX_ABI, provider);
  const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

  // Get current epoch
  const currentEpoch = await dreamdex.currentEpoch();
  console.log(`Current epoch: ${currentEpoch}\n`);

  // Get all pending trades
  const { data: pendingTrades, error } = await supabase
    .from('simulated_trades')
    .select('*')
    .eq('outcome', 'pending');

  if (error) {
    console.error('Error fetching pending trades:', error);
    return;
  }

  console.log(`Found ${pendingTrades.length} pending trades\n`);

  // Group by epoch
  const byEpoch = {};
  for (const trade of pendingTrades) {
    if (!byEpoch[trade.epoch]) byEpoch[trade.epoch] = [];
    byEpoch[trade.epoch].push(trade);
  }

  // Resolve each epoch
  let resolved = 0;
  let skipped = 0;

  for (const [epoch, trades] of Object.entries(byEpoch)) {
    const epochNum = parseInt(epoch);

    // Skip if epoch is too recent (not yet resolved)
    if (Number(currentEpoch) - epochNum < 2) {
      console.log(`Epoch ${epoch}: Too recent, skipping ${trades.length} trades`);
      skipped += trades.length;
      continue;
    }

    try {
      const round = await dreamdex.rounds(epochNum);
      const oracleCalled = round[13];

      if (!oracleCalled) {
        console.log(`Epoch ${epoch}: Oracle not called yet, skipping`);
        skipped += trades.length;
        continue;
      }

      const lockPrice = round[4];
      const closePrice = round[5];
      const bullWins = closePrice > lockPrice;

      console.log(`Epoch ${epoch}: ${bullWins ? 'BULL WINS' : 'BEAR WINS'} (lock: ${lockPrice}, close: ${closePrice})`);

      for (const trade of trades) {
        const won = trade.is_bull === bullWins;
        const pnl = won
          ? (BigInt(trade.amount) * BigInt(95)) / BigInt(100)
          : -BigInt(trade.amount);

        const { data: updateData, error: updateError, count } = await supabase
          .from('simulated_trades')
          .update({
            outcome: won ? 'win' : 'loss',
            pnl: pnl.toString(),
            resolved_at: new Date().toISOString(),
          })
          .eq('id', trade.id)
          .select();

        if (updateError) {
          console.error(`  Error updating trade ${trade.id}:`, updateError);
        } else if (!updateData || updateData.length === 0) {
          console.error(`  Trade ${trade.id}: Update returned no data (RLS may be blocking)`);
        } else {
          console.log(`  ${trade.follower.slice(0, 10)}... - ${won ? '✅ WON' : '❌ LOST'} ${ethers.formatEther(trade.amount)} STT`);
          resolved++;
        }
      }
    } catch (err) {
      console.error(`Error resolving epoch ${epoch}:`, err.message);
    }
  }

  console.log(`\n✅ Done! Resolved: ${resolved}, Skipped: ${skipped}`);

  // Show updated stats
  const { data: stats } = await supabase
    .from('simulated_trades')
    .select('outcome, amount, pnl');

  let wins = 0, losses = 0, pending = 0, totalPnl = BigInt(0);
  for (const t of stats || []) {
    if (t.outcome === 'win') { wins++; totalPnl += BigInt(t.pnl || '0'); }
    else if (t.outcome === 'loss') { losses++; totalPnl += BigInt(t.pnl || '0'); }
    else pending++;
  }

  console.log('\n📊 Updated Stats:');
  console.log(`   Total trades: ${stats.length}`);
  console.log(`   Wins: ${wins}, Losses: ${losses}, Pending: ${pending}`);
  console.log(`   Win rate: ${((wins / (wins + losses)) * 100).toFixed(1)}%`);
  console.log(`   Total PnL: ${ethers.formatEther(totalPnl.toString())} STT`);
}

main().catch(console.error);
