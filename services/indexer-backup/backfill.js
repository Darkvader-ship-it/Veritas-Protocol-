import { ethers } from 'ethers';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { calculateDreamDEXScore, SCORING_CONFIG } from './scoring.js';

dotenv.config();

/**
 * Backfill historical DreamDEX Event Contracts data
 * This script indexes past events to populate the leaderboard
 */

// Multiple Somnia RPCs for fallback (free public endpoints)
const Somnia_RPCS = [
  'https://somnia.publicnode.com',
  'https://somnia-rpc.publicnode.com',
  'https://somnia.drpc.org',
  'https://somnia-dataseed1.somnia.org',
  'https://somnia-dataseed2.somnia.org',
];

const config = {
  Somnia_RPC: process.env.Somnia_RPC_URL || Somnia_RPCS[0],
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_KEY: process.env.SUPABASE_SERVICE_KEY,
  DREAMDEX_PREDICTION: '0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9',

  // How many blocks to backfill (adjust based on your needs)
  // ~28800 blocks = 1 day, ~86400 = 3 days
  BLOCKS_TO_BACKFILL: parseInt(process.env.BACKFILL_BLOCKS || '28800'), // 1 day default
  CHUNK_SIZE: 100, // Small chunks for free RPCs
  DELAY_MS: 1500, // 1.5 second delay for free RPCs
  MAX_RETRIES: 3,
};

const TOPICS = {
  BetBull: ethers.id('BetBull(address,uint256,uint256)'),
  BetBear: ethers.id('BetBear(address,uint256,uint256)'),
  Claim: ethers.id('Claim(address,uint256,uint256)'),
};

const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_KEY);

let platformId = null;
let stats = {
  bullBets: 0,
  bearBets: 0,
  claims: 0,
  users: new Set(),
  errors: 0,
};

async function initialize() {
  console.log('🔄 Backfill Starting...');
  console.log(`📡 Somnia RPC: ${config.Somnia_RPC}`);
  console.log(`📦 Blocks to backfill: ${config.BLOCKS_TO_BACKFILL}`);

  const { data: platform, error } = await supabase
    .from('platforms')
    .select('id')
    .eq('name', 'DreamDEX Event Contracts')
    .single();

  if (error || !platform) {
    throw new Error('DreamDEX platform not found. Run schema SQL first.');
  }

  platformId = platform.id;
  console.log(`✅ Platform ID: ${platformId}\n`);
}

async function getOrCreateUser(walletAddress) {
  const address = walletAddress.toLowerCase();

  let { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('wallet_address', address)
    .single();

  if (!user) {
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({ wallet_address: address })
      .select('id')
      .single();

    if (error) {
      stats.errors++;
      return null;
    }
    user = newUser;
    stats.users.add(address);
  }

  return user.id;
}

async function processBetEvent(log, position, blockTimestamp) {
  const sender = '0x' + log.topics[1].slice(26);
  const epoch = parseInt(log.topics[2], 16);
  const amount = BigInt(log.data.slice(0, 66)).toString();

  const userId = await getOrCreateUser(sender);
  if (!userId) return;

  // Check if bet exists
  const { data: existing } = await supabase
    .from('bets')
    .select('id')
    .eq('tx_hash', log.transactionHash)
    .single();

  if (existing) return;

  const { error } = await supabase
    .from('bets')
    .insert({
      user_id: userId,
      platform_id: platformId,
      market_id: 'dreamdex-stt-usd',
      epoch: epoch,
      position: position,
      amount: amount,
      tx_hash: log.transactionHash,
      block_number: log.blockNumber,
      timestamp: new Date(blockTimestamp * 1000).toISOString(),
    });

  if (!error) {
    if (position === 'bull') stats.bullBets++;
    else stats.bearBets++;
  } else {
    stats.errors++;
  }
}

async function processClaimEvent(log) {
  const sender = '0x' + log.topics[1].slice(26);
  const epoch = parseInt(log.topics[2], 16);
  const amount = BigInt(log.data.slice(0, 66)).toString();

  const userId = await getOrCreateUser(sender);
  if (!userId) return;

  // Update bet as won
  const { error } = await supabase
    .from('bets')
    .update({
      won: true,
      claimed_amount: amount,
    })
    .eq('user_id', userId)
    .eq('epoch', epoch);

  if (!error) stats.claims++;
}

async function recalculateAllStats() {
  console.log('\n📊 Recalculating user stats...');

  // Get all users with bets
  const { data: users } = await supabase
    .from('users')
    .select('id, wallet_address');

  for (const user of users || []) {
    // Get aggregated bet data
    const { data: bets } = await supabase
      .from('bets')
      .select('amount, won')
      .eq('user_id', user.id)
      .eq('platform_id', platformId);

    if (!bets || bets.length === 0) continue;

    const totalBets = bets.length;
    const wins = bets.filter(b => b.won === true).length;
    const losses = totalBets - wins;
    const volume = bets.reduce((sum, b) => sum + BigInt(b.amount || '0'), 0n).toString();
    const winRate = totalBets > 0 ? (wins / totalBets) * 100 : 0;

    // Calculate score using Wilson Score with all adjustments
    const scoreResult = calculateDreamDEXScore({
      wins,
      totalBets,
      volume,
      bets,
      firstBetAt: null, // Will use default maturity
    });

    const score = scoreResult.score;

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

let currentRpcIndex = 0;
let provider = null;

async function getProvider() {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(Somnia_RPCS[currentRpcIndex]);
  }
  return provider;
}

async function rotateRpc() {
  currentRpcIndex = (currentRpcIndex + 1) % Somnia_RPCS.length;
  provider = new ethers.JsonRpcProvider(Somnia_RPCS[currentRpcIndex]);
  console.log(`\n🔄 Switched to RPC: ${Somnia_RPCS[currentRpcIndex]}`);
  await new Promise(r => setTimeout(r, 2000)); // Wait after switch
  return provider;
}

async function fetchLogsWithRetry(start, end, retries = 0) {
  const prov = await getProvider();

  try {
    const logs = await prov.getLogs({
      address: config.DREAMDEX_PREDICTION,
      fromBlock: start,
      toBlock: end,
      topics: [[TOPICS.BetBull, TOPICS.BetBear, TOPICS.Claim]],
    });
    return logs;
  } catch (error) {
    if (retries < config.MAX_RETRIES) {
      // Rotate RPC and retry
      await rotateRpc();
      await new Promise(r => setTimeout(r, 3000)); // Wait 3 seconds
      return fetchLogsWithRetry(start, end, retries + 1);
    }
    throw error;
  }
}

async function backfill() {
  provider = await getProvider();
  const currentBlock = await provider.getBlockNumber();
  const fromBlock = currentBlock - config.BLOCKS_TO_BACKFILL;

  console.log(`📦 Scanning blocks ${fromBlock} to ${currentBlock}`);
  console.log(`   (${config.BLOCKS_TO_BACKFILL} blocks, ~${Math.round(config.BLOCKS_TO_BACKFILL / 28800)} days)`);
  console.log(`   Chunk size: ${config.CHUNK_SIZE}, Delay: ${config.DELAY_MS}ms\n`);

  const totalChunks = Math.ceil(config.BLOCKS_TO_BACKFILL / config.CHUNK_SIZE);
  let processedChunks = 0;
  let consecutiveErrors = 0;

  for (let start = fromBlock; start < currentBlock; start += config.CHUNK_SIZE) {
    const end = Math.min(start + config.CHUNK_SIZE - 1, currentBlock);
    processedChunks++;

    try {
      // Fetch events with retry
      const logs = await fetchLogsWithRetry(start, end);
      consecutiveErrors = 0; // Reset on success

      // Get block timestamp for the first log
      let blockTimestamp = Math.floor(Date.now() / 1000);
      if (logs.length > 0) {
        try {
          const prov = await getProvider();
          const block = await prov.getBlock(logs[0].blockNumber);
          blockTimestamp = block?.timestamp || blockTimestamp;
        } catch (e) {
          // Ignore timestamp fetch errors
        }
      }

      // Process events
      for (const log of logs) {
        if (log.topics[0] === TOPICS.BetBull) {
          await processBetEvent(log, 'bull', blockTimestamp);
        } else if (log.topics[0] === TOPICS.BetBear) {
          await processBetEvent(log, 'bear', blockTimestamp);
        } else if (log.topics[0] === TOPICS.Claim) {
          await processClaimEvent(log);
        }
      }

      const progress = ((processedChunks / totalChunks) * 100).toFixed(1);
      const eventsFound = logs.length;
      process.stdout.write(`\r⏳ Progress: ${progress}% | Blocks: ${start}-${end} | Events: ${eventsFound} | Bulls: ${stats.bullBets} | Bears: ${stats.bearBets} | Claims: ${stats.claims}   `);

    } catch (error) {
      consecutiveErrors++;
      console.error(`\n❌ Error at blocks ${start}-${end} (attempt ${consecutiveErrors}):`, error.message);
      stats.errors++;

      // If too many consecutive errors, increase delay
      if (consecutiveErrors >= 3) {
        console.log('⏸️  Too many errors, waiting 30 seconds...');
        await new Promise(r => setTimeout(r, 30000));
        consecutiveErrors = 0;
      } else {
        await new Promise(r => setTimeout(r, 5000));
      }
    }

    // Delay to avoid rate limits
    await new Promise(r => setTimeout(r, config.DELAY_MS));
  }

  console.log('\n');
}

async function main() {
  try {
    await initialize();
    await backfill();
    await recalculateAllStats();

    console.log('\n📊 Backfill Complete!');
    console.log(`   Bull bets: ${stats.bullBets}`);
    console.log(`   Bear bets: ${stats.bearBets}`);
    console.log(`   Claims: ${stats.claims}`);
    console.log(`   Unique users: ${stats.users.size}`);
    console.log(`   Errors: ${stats.errors}`);

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
