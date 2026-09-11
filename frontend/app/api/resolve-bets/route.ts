import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';

// Initialize Supabase with service key for update permissions
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// DreamDEX Event Contracts contract on Somnia Mainnet
const DREAMDEX_PREDICTION = '0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9';

// Multiple RPC endpoints for reliability
const Somnia_RPCS = [
  'https://somnia-dataseed1.somnia.org',
  'https://somnia.publicnode.com',
  'https://somnia-dataseed2.somnia.org',
];

const PREDICTION_ABI = [
  'function currentEpoch() view returns (uint256)',
  'function rounds(uint256) view returns (uint256 epoch, uint256 startTimestamp, uint256 lockTimestamp, uint256 closeTimestamp, int256 lockPrice, int256 closePrice, uint256 lockOracleId, uint256 closeOracleId, uint256 totalAmount, uint256 bullAmount, uint256 bearAmount, uint256 rewardBaseCalAmount, uint256 rewardAmount, bool oracleCalled)',
];

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel Pro allows up to 60s

async function getProvider(): Promise<ethers.JsonRpcProvider> {
  for (const rpc of Somnia_RPCS) {
    try {
      const provider = new ethers.JsonRpcProvider(rpc);
      await provider.getBlockNumber(); // Test connection
      return provider;
    } catch {
      continue;
    }
  }
  throw new Error('All RPC endpoints failed');
}

export async function GET() {
  const startTime = Date.now();
  console.log('[resolve-bets] Starting resolution at', new Date().toISOString());

  try {
    // Initialize provider and contract with failover
    const provider = await getProvider();
    const contract = new ethers.Contract(DREAMDEX_PREDICTION, PREDICTION_ABI, provider);

    // Get current epoch
    const currentEpoch = Number(await contract.currentEpoch());

    // Get all pending trades
    const { data: pendingTrades, error: fetchError } = await supabase
      .from('simulated_trades')
      .select('id, epoch, is_bull, amount')
      .eq('outcome', 'pending');

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!pendingTrades || pendingTrades.length === 0) {
      return NextResponse.json({
        resolved: 0,
        pending: 0,
        message: 'No pending trades',
        duration: Date.now() - startTime
      });
    }

    // Get unique epochs
    const uniqueEpochs = [...new Set(pendingTrades.map(t => t.epoch))];

    let resolved = 0;
    let skipped = 0;

    for (const epoch of uniqueEpochs) {
      // Skip recent epochs (not closed yet)
      if (currentEpoch - epoch < 2) {
        skipped++;
        continue;
      }

      // Check time to avoid timeout (50s limit for 60s max)
      if (Date.now() - startTime > 50000) {
        console.log('[resolve-bets] Approaching timeout, stopping early');
        break;
      }

      try {
        // Get round result
        const round = await contract.rounds(epoch);
        const lockPrice = Number(round[4]);
        const closePrice = Number(round[5]);
        const oracleCalled = round[13];

        if (!oracleCalled || closePrice === 0) {
          skipped++;
          continue;
        }

        const bullWins = closePrice > lockPrice;

        // Get trades for this epoch
        const epochTrades = pendingTrades.filter(t => t.epoch === epoch);

        for (const trade of epochTrades) {
          const won = trade.is_bull === bullWins;
          const pnl = won
            ? (BigInt(trade.amount) * BigInt(90)) / BigInt(100)  // 90% return on win
            : -BigInt(trade.amount);  // Lose full amount

          const { error: updateError } = await supabase
            .from('simulated_trades')
            .update({
              outcome: won ? 'win' : 'loss',
              pnl: pnl.toString(),
              resolved_at: new Date().toISOString(),
            })
            .eq('id', trade.id);

          if (!updateError) {
            resolved++;
          }
        }
      } catch (err) {
        console.error(`Error resolving epoch ${epoch}:`, err);
      }
    }

    // Get updated stats
    const { data: stats } = await supabase
      .from('simulated_trades')
      .select('outcome');

    const wins = stats?.filter(t => t.outcome === 'win').length || 0;
    const losses = stats?.filter(t => t.outcome === 'loss').length || 0;
    const pending = stats?.filter(t => t.outcome === 'pending').length || 0;

    console.log(`[resolve-bets] Completed: resolved=${resolved}, pending=${pending}, duration=${Date.now() - startTime}ms`);

    return NextResponse.json({
      resolved,
      skipped,
      pending,
      wins,
      losses,
      winRate: wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) + '%' : 'N/A',
      currentEpoch,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Resolve bets error:', error);
    return NextResponse.json({
      error: error.message,
      duration: Date.now() - startTime
    }, { status: 500 });
  }
}
