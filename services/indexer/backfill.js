import { ethers } from 'ethers';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { calculateDreamDEXScore } from './scoring.js';

dotenv.config();

/**
 * Fast Backfill with Batch Operations + Caching
 * Much faster than original sequential processing
 */

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

  // Optimized settings
  BLOCKS_TO_BACKFILL: parseInt(process.env.BACKFILL_BLOCKS || '28800'), // 1 day
  CHUNK_SIZE: 500, // Larger chunks (was 100)
  DELAY_MS: 500, // Shorter delay (was 1500)
  MAX_RETRIES: 3,
};

const TOPICS = {
  BetBull: ethers.id('BetBull(address,uint256,uint256)'),
  BetBear: ethers.id('BetBear(address,uint256,uint256)'),
  Claim: ethers.id('Claim(address,uint256,uint256)'),
};

const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_KEY);

// In-memory caches for speed
const userCache = new Map(); // address -> user_id
const existingTxHashes = new Set(); // tx hashes already in DB

let platformId = null;
let currentRpcIndex = 0;
let provider = null;

let stats = {
  bullBets: 0,
  bearBets: 0,
  claims: 0,
  usersCreated: 0,
  skipped: 0,
  errors: 0,
};

async function initialize() {
  console.log('Fast Backfill Starting (Batch Mode)...');
  console.log(`Blocks to backfill: ${config.BLOCKS_TO_BACKFILL}`);
  console.log(`Chunk size: ${config.CHUNK_SIZE}`);

  const { data: platform } = await supabase
    .from('platforms')
    .select('id')
    .eq('name', 'DreamDEX Event Contracts')
    .single();

  if (!platform) {
    throw new Error('DreamDEX platform not found. Run schema SQL first.');
  }
  platformId = platform.id;
  console.log(`Platform ID: ${platformId}`);

  // Pre-load existing users into cache
  console.log('Loading existing users...');
  const { data: users } = await supabase
    .from('users')
    .select('id, wallet_address');

  for (const user of users || []) {
    userCache.set(user.wallet_address.toLowerCase(), user.id);
  }
  console.log(`Cached ${userCache.size} existing users`);

  // Pre-load existing tx hashes to avoid duplicates
  console.log('Loading existing bets...');
  const { data: bets } = await supabase
    .from('bets')
    .select('tx_hash')
    .eq('platform_id', platformId);

  for (const bet of bets || []) {
    if (bet.tx_hash) existingTxHashes.add(bet.tx_hash.toLowerCase());
  }
  console.log(`Cached ${existingTxHashes.size} existing tx hashes\n`);
}

function getProvider() {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(Somnia_RPCS[currentRpcIndex]);
  }
  return provider;
}

async function rotateRpc() {
  currentRpcIndex = (currentRpcIndex + 1) % Somnia_RPCS.length;
  provider = new ethers.JsonRpcProvider(Somnia_RPCS[currentRpcIndex]);
  console.log(`\nSwitched to RPC: ${Somnia_RPCS[currentRpcIndex]}`);
  await new Promise(r => setTimeout(r, 1000));
  return provider;
}

async function fetchLogsWithRetry(start, end, retries = 0) {
  const prov = getProvider();

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
      await rotateRpc();
      await new Promise(r => setTimeout(r, 2000));
      return fetchLogsWithRetry(start, end, retries + 1);
    }
    throw error;
  }
}

async function getOrCreateUserBatch(addresses) {
  const newAddresses = [];
  const results = new Map();

  // Check cache first
  for (const addr of addresses) {
    const lower = addr.toLowerCase();
    if (userCache.has(lower)) {
      results.set(lower, userCache.get(lower));
    } else {
      newAddresses.push(lower);
    }
  }

  // Batch insert new users
  if (newAddresses.length > 0) {
    const toInsert = newAddresses.map(addr => ({ wallet_address: addr }));

    const { data: inserted, error } = await supabase
      .from('users')
      .upsert(toInsert, { onConflict: 'wallet_address', ignoreDuplicates: false })
      .select('id, wallet_address');

    if (error) {
      console.error('Error batch inserting users:', error.message);
      stats.errors++;
    } else {
      for (const user of inserted || []) {
        userCache.set(user.wallet_address.toLowerCase(), user.id);
        results.set(user.wallet_address.toLowerCase(), user.id);
        stats.usersCreated++;
      }
    }
  }

  return results;
}

function parseLog(log) {
  const isBull = log.topics[0] === TOPICS.BetBull;
  const isBear = log.topics[0] === TOPICS.BetBear;
  const isClaim = log.topics[0] === TOPICS.Claim;

  const sender = '0x' + log.topics[1].slice(26);
  const epoch = parseInt(log.topics[2], 16);
  const amount = BigInt(log.data.slice(0, 66)).toString();

  return {
    type: isBull ? 'bull' : isBear ? 'bear' : 'claim',
    sender: sender.toLowerCase(),
    epoch,
    amount,
    txHash: log.transactionHash?.toLowerCase(),
    blockNumber: log.blockNumber,
  };
}

async function processBatch(logs, blockTimestamp) {
  if (logs.length === 0) return;

  // Parse all logs
  const parsed = logs.map(parseLog);

  // Get unique addresses
  const addresses = [...new Set(parsed.map(p => p.sender))];
  const userMap = await getOrCreateUserBatch(addresses);

  // Separate bets and claims
  const betsToInsert = [];
  const claimsToProcess = [];

  for (const p of parsed) {
    if (p.type === 'claim') {
      claimsToProcess.push(p);
      continue;
    }

    // Skip if already exists
    if (p.txHash && existingTxHashes.has(p.txHash)) {
      stats.skipped++;
      continue;
    }

    const userId = userMap.get(p.sender);
    if (!userId) continue;

    betsToInsert.push({
      user_id: userId,
      platform_id: platformId,
      market_id: 'dreamdex-stt-usd',
      epoch: p.epoch,
      position: p.type,
      amount: p.amount,
      tx_hash: p.txHash,
      block_number: p.blockNumber,
      timestamp: new Date(blockTimestamp * 1000).toISOString(),
    });

    if (p.txHash) existingTxHashes.add(p.txHash);
    if (p.type === 'bull') stats.bullBets++;
    else stats.bearBets++;
  }

  // Batch insert bets
  if (betsToInsert.length > 0) {
    const { error } = await supabase
      .from('bets')
      .upsert(betsToInsert, { onConflict: 'tx_hash', ignoreDuplicates: true });

    if (error) {
      console.error('Error batch inserting bets:', error.message);
      stats.errors++;
    }
  }

  // Process claims (update existing bets)
  for (const claim of claimsToProcess) {
    const userId = userMap.get(claim.sender);
    if (!userId) continue;

    await supabase
      .from('bets')
      .update({ won: true, claimed_amount: claim.amount })
      .eq('user_id', userId)
      .eq('epoch', claim.epoch);

    stats.claims++;
  }
}

async function recalculateAllStats() {
  console.log('\nRecalculating user stats...');

  const { data: userBets } = await supabase
    .from('bets')
    .select('user_id, amount, won')
    .eq('platform_id', platformId);

  if (!userBets || userBets.length === 0) {
    console.log('No bets found');
    return;
  }

  // Aggregate in memory
  const userStats = new Map();

  for (const bet of userBets) {
    if (!userStats.has(bet.user_id)) {
      userStats.set(bet.user_id, { totalBets: 0, wins: 0, volume: 0n });
    }
    const s = userStats.get(bet.user_id);
    s.totalBets++;
    s.volume += BigInt(bet.amount || '0');
    if (bet.won === true) s.wins++;
  }

  // Batch upsert stats
  const statsToUpsert = [];

  for (const [userId, s] of userStats) {
    const losses = s.totalBets - s.wins;
    const winRate = s.totalBets > 0 ? (s.wins / s.totalBets) * 100 : 0;

    const scoreResult = calculateDreamDEXScore({
      wins: s.wins,
      totalBets: s.totalBets,
      volume: s.volume.toString(),
      bets: [],
      firstBetAt: null,
    });

    statsToUpsert.push({
      user_id: userId,
      platform_id: platformId,
      total_bets: s.totalBets,
      wins: s.wins,
      losses,
      win_rate: Math.round(winRate * 100) / 100,
      volume: s.volume.toString(),
      score: scoreResult.score,
      last_updated: new Date().toISOString(),
    });
  }

  const { error } = await supabase
    .from('user_platform_stats')
    .upsert(statsToUpsert, { onConflict: 'user_id,platform_id' });

  if (error) {
    console.error('Error updating stats:', error.message);
  } else {
    console.log(`Stats updated for ${statsToUpsert.length} users`);
  }
}

async function backfill() {
  provider = getProvider();
  const currentBlock = await provider.getBlockNumber();
  const fromBlock = currentBlock - config.BLOCKS_TO_BACKFILL;

  console.log(`Scanning blocks ${fromBlock} to ${currentBlock}`);
  console.log(`(${config.BLOCKS_TO_BACKFILL} blocks, ~${Math.round(config.BLOCKS_TO_BACKFILL / 28800)} days)\n`);

  const totalChunks = Math.ceil(config.BLOCKS_TO_BACKFILL / config.CHUNK_SIZE);
  let processedChunks = 0;
  let consecutiveErrors = 0;

  for (let start = fromBlock; start < currentBlock; start += config.CHUNK_SIZE) {
    const end = Math.min(start + config.CHUNK_SIZE - 1, currentBlock);
    processedChunks++;

    try {
      const logs = await fetchLogsWithRetry(start, end);
      consecutiveErrors = 0;

      // Get block timestamp
      let blockTimestamp = Math.floor(Date.now() / 1000);
      if (logs.length > 0) {
        try {
          const block = await getProvider().getBlock(logs[0].blockNumber);
          blockTimestamp = block?.timestamp || blockTimestamp;
        } catch (e) { /* ignore */ }
      }

      await processBatch(logs, blockTimestamp);

      const progress = ((processedChunks / totalChunks) * 100).toFixed(1);
      process.stdout.write(`\r${progress}% | Blocks: ${start}-${end} | Events: ${logs.length} | Bulls: ${stats.bullBets} | Bears: ${stats.bearBets} | Claims: ${stats.claims} | Skip: ${stats.skipped}   `);

    } catch (error) {
      consecutiveErrors++;
      console.error(`\nError at blocks ${start}-${end}:`, error.message);
      stats.errors++;

      if (consecutiveErrors >= 3) {
        console.log('Too many errors, waiting 30s...');
        await new Promise(r => setTimeout(r, 30000));
        consecutiveErrors = 0;
      } else {
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    await new Promise(r => setTimeout(r, config.DELAY_MS));
  }

  console.log('\n');
}

async function main() {
  const startTime = Date.now();

  try {
    await initialize();
    await backfill();
    await recalculateAllStats();

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n=== Backfill Complete ===');
    console.log(`Duration: ${duration}s`);
    console.log(`Bull bets: ${stats.bullBets}`);
    console.log(`Bear bets: ${stats.bearBets}`);
    console.log(`Claims: ${stats.claims}`);
    console.log(`Users created: ${stats.usersCreated}`);
    console.log(`Skipped: ${stats.skipped}`);
    console.log(`Errors: ${stats.errors}`);

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
