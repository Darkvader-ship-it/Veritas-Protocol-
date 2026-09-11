import { ethers } from 'ethers';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Resolve bet outcomes by querying DreamDEX contract
 * A bet wins if:
 * - Bull position: closePrice > lockPrice
 * - Bear position: closePrice < lockPrice
 */

const Somnia_RPCS = [
  'https://somnia.publicnode.com',
  'https://somnia-rpc.publicnode.com',
  'https://somnia-dataseed1.somnia.org',
];

const DREAMDEX_PREDICTION = '0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9';

// DreamDEX Event Contracts ABI (just the round getter)
const ABI = [
  'function rounds(uint256 epoch) view returns (uint256 epoch, uint256 startTimestamp, uint256 lockTimestamp, uint256 closeTimestamp, int256 lockPrice, int256 closePrice, uint256 lockOracleId, uint256 closeOracleId, uint256 totalAmount, uint256 bullAmount, uint256 bearAmount, uint256 rewardBaseCalAmount, uint256 rewardAmount, bool oracleCalled)'
];

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

let provider = null;
let contract = null;
let rpcIndex = 0;

async function getContract() {
  if (!contract) {
    provider = new ethers.JsonRpcProvider(Somnia_RPCS[rpcIndex]);
    contract = new ethers.Contract(DREAMDEX_PREDICTION, ABI, provider);
  }
  return contract;
}

async function rotateRpc() {
  rpcIndex = (rpcIndex + 1) % Somnia_RPCS.length;
  provider = new ethers.JsonRpcProvider(Somnia_RPCS[rpcIndex]);
  contract = new ethers.Contract(DREAMDEX_PREDICTION, ABI, provider);
  console.log(`🔄 Switched to RPC: ${Somnia_RPCS[rpcIndex]}`);
  await new Promise(r => setTimeout(r, 1000));
}

// Cache for round data
const roundCache = new Map();

async function getRoundData(epoch) {
  if (roundCache.has(epoch)) {
    return roundCache.get(epoch);
  }

  const c = await getContract();

  for (let retry = 0; retry < 3; retry++) {
    try {
      const round = await c.rounds(epoch);
      const data = {
        lockPrice: round.lockPrice,
        closePrice: round.closePrice,
        oracleCalled: round.oracleCalled,
      };
      roundCache.set(epoch, data);
      return data;
    } catch (error) {
      await rotateRpc();
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  return null;
}

async function resolveBets() {
  console.log('🔄 Resolving bet outcomes...\n');

  // Get all unresolved bets
  const { data: bets, error } = await supabase
    .from('bets')
    .select('id, epoch, position, user_id')
    .is('won', null)
    .order('epoch', { ascending: true });

  if (error) {
    console.error('Error fetching bets:', error);
    return;
  }

  console.log(`📋 Found ${bets?.length || 0} unresolved bets\n`);

  // Group bets by epoch
  const betsByEpoch = new Map();
  for (const bet of bets || []) {
    if (!betsByEpoch.has(bet.epoch)) {
      betsByEpoch.set(bet.epoch, []);
    }
    betsByEpoch.get(bet.epoch).push(bet);
  }

  console.log(`📅 Epochs to check: ${betsByEpoch.size}\n`);

  let resolved = 0;
  let wins = 0;
  let losses = 0;
  let pending = 0;

  const epochs = Array.from(betsByEpoch.keys()).sort((a, b) => a - b);

  for (const epoch of epochs) {
    const epochBets = betsByEpoch.get(epoch);

    try {
      const round = await getRoundData(epoch);

      if (!round || !round.oracleCalled) {
        pending += epochBets.length;
        continue;
      }

      const lockPrice = BigInt(round.lockPrice.toString());
      const closePrice = BigInt(round.closePrice.toString());

      // Determine winning position
      let winningPosition = null;
      if (closePrice > lockPrice) {
        winningPosition = 'bull';
      } else if (closePrice < lockPrice) {
        winningPosition = 'bear';
      }
      // If prices are equal, house wins (no one wins)

      // Update bets
      for (const bet of epochBets) {
        const won = winningPosition === bet.position;

        const { error: updateError } = await supabase
          .from('bets')
          .update({ won })
          .eq('id', bet.id);

        if (!updateError) {
          resolved++;
          if (won) wins++;
          else losses++;
        }
      }

      process.stdout.write(`\r⏳ Resolved: ${resolved} | Wins: ${wins} | Losses: ${losses} | Pending: ${pending}   `);

      // Small delay
      await new Promise(r => setTimeout(r, 100));

    } catch (error) {
      console.error(`\n❌ Error resolving epoch ${epoch}:`, error.message);
      pending += epochBets.length;
    }
  }

  console.log(`\n\n✅ Resolution complete!`);
  console.log(`   Resolved: ${resolved}`);
  console.log(`   Wins: ${wins}`);
  console.log(`   Losses: ${losses}`);
  console.log(`   Pending: ${pending}`);
}

async function recalculateStats() {
  console.log('\n📊 Recalculating user stats...');

  const { data: platformData } = await supabase
    .from('platforms')
    .select('id')
    .eq('name', 'DreamDEX Event Contracts')
    .single();

  const platformId = platformData?.id;

  // Get all users
  const { data: users } = await supabase
    .from('users')
    .select('id');

  for (const user of users || []) {
    const { data: bets } = await supabase
      .from('bets')
      .select('amount, won')
      .eq('user_id', user.id)
      .eq('platform_id', platformId);

    if (!bets || bets.length === 0) continue;

    const totalBets = bets.length;
    const wins = bets.filter(b => b.won === true).length;
    const losses = bets.filter(b => b.won === false).length;
    const volume = bets.reduce((sum, b) => sum + BigInt(b.amount || '0'), 0n).toString();
    const winRate = totalBets > 0 ? (wins / totalBets) * 100 : 0;

    // Calculate score
    const winPoints = wins * 100;
    const winRateBonus = winRate > 55 ? (winRate - 55) * 10 : 0;
    const volumeSTT = Number(volume) / 1e18;
    const volumeBonus = Math.min(500, Math.floor(volumeSTT * 10));
    const score = Math.floor(winPoints + winRateBonus + volumeBonus);

    await supabase
      .from('user_platform_stats')
      .upsert({
        user_id: user.id,
        platform_id: platformId,
        total_bets: totalBets,
        wins,
        losses,
        win_rate: Math.round(winRate * 100) / 100,
        volume,
        score,
        last_updated: new Date().toISOString(),
      }, { onConflict: 'user_id,platform_id' });
  }

  console.log(`✅ Stats updated for ${users?.length || 0} users`);
}

async function main() {
  await resolveBets();
  await recalculateStats();
}

main().catch(console.error);
