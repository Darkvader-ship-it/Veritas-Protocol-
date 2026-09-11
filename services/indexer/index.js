import { ethers } from 'ethers';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { calculateSimpleScore, SCORING_CONFIG } from './scoring.js';

dotenv.config();

// Configuration
const config = {
  // Somnia RPC endpoints
  Somnia_RPC: process.env.Somnia_RPC_URL || 'https://somnia-dataseed.somnia.org',
  Somnia_WS: process.env.Somnia_WS_URL || 'wss://somnia-ws-node.nariox.org:443',

  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_KEY: process.env.SUPABASE_SERVICE_KEY, // Use service key for writes

  // DreamDEX Event Contracts V2 contract
  DREAMDEX_PREDICTION: '0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9',

  // Indexer settings
  BATCH_SIZE: 100,
  POLL_INTERVAL: 3000, // 3 seconds (Somnia block time)
};

// Event signatures
const EVENTS = {
  BetBull: 'BetBull(address,uint256,uint256)',
  BetBear: 'BetBear(address,uint256,uint256)',
  Claim: 'Claim(address,uint256,uint256)',
  StartRound: 'StartRound(uint256)',
  EndRound: 'EndRound(uint256,uint256)',
};

// Event topic hashes
const TOPICS = {
  BetBull: ethers.id(EVENTS.BetBull),
  BetBear: ethers.id(EVENTS.BetBear),
  Claim: ethers.id(EVENTS.Claim),
};

// Initialize Supabase client
const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_KEY);

// State
let lastProcessedBlock = 0;
let platformId = null;
let isProcessing = false;

/**
 * Initialize the indexer
 */
async function initialize() {
  console.log('🚀 Veritas Indexer Starting...');
  console.log(`📡 Somnia RPC: ${config.Somnia_RPC}`);
  console.log(`🗄️  Supabase: ${config.SUPABASE_URL}`);

  // Get DreamDEX platform ID
  const { data: platform, error } = await supabase
    .from('platforms')
    .select('id')
    .eq('name', 'DreamDEX Event Contracts')
    .single();

  if (error || !platform) {
    throw new Error('DreamDEX platform not found in database. Run schema SQL first.');
  }

  platformId = platform.id;
  console.log(`✅ Platform ID: ${platformId}`);

  // Get last processed block from database or start from recent
  const { data: lastBet } = await supabase
    .from('bets')
    .select('block_number')
    .order('block_number', { ascending: false })
    .limit(1)
    .single();

  if (lastBet?.block_number) {
    lastProcessedBlock = lastBet.block_number;
    console.log(`📦 Resuming from block ${lastProcessedBlock}`);
  } else {
    // Start from ~1 hour ago
    const provider = new ethers.JsonRpcProvider(config.Somnia_RPC);
    const currentBlock = await provider.getBlockNumber();
    lastProcessedBlock = currentBlock - 1200; // ~1 hour
    console.log(`📦 Starting fresh from block ${lastProcessedBlock}`);
  }
}

/**
 * Get or create user by wallet address
 */
async function getOrCreateUser(walletAddress) {
  const address = walletAddress.toLowerCase();

  // Try to get existing user
  let { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('wallet_address', address)
    .single();

  if (!user) {
    // Create new user
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({ wallet_address: address })
      .select('id')
      .single();

    if (error) {
      console.error(`Error creating user ${address}:`, error);
      return null;
    }
    user = newUser;
    console.log(`👤 New user: ${address.slice(0, 10)}...`);
  }

  return user.id;
}

/**
 * Process a bet event (BetBull or BetBear)
 */
async function processBetEvent(log, position) {
  const sender = '0x' + log.topics[1].slice(26);
  const epoch = parseInt(log.topics[2], 16);
  const amount = BigInt(log.data.slice(0, 66)).toString();

  const userId = await getOrCreateUser(sender);
  if (!userId) return;

  // Check if bet already exists
  const { data: existingBet } = await supabase
    .from('bets')
    .select('id')
    .eq('tx_hash', log.transactionHash)
    .single();

  if (existingBet) return; // Skip duplicate

  // Insert bet
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
      timestamp: new Date().toISOString(),
    });

  if (error) {
    console.error(`Error inserting bet:`, error);
    return;
  }

  // Update user stats
  await updateUserStats(userId, amount, null);

  const amountSTT = (Number(amount) / 1e18).toFixed(4);
  console.log(`🎲 ${position.toUpperCase()} | ${sender.slice(0, 10)}... | ${amountSTT} STT | Epoch ${epoch}`);
}

/**
 * Process a claim event
 */
async function processClaimEvent(log) {
  const sender = '0x' + log.topics[1].slice(26);
  const epoch = parseInt(log.topics[2], 16);
  const amount = BigInt(log.data.slice(0, 66)).toString();

  const userId = await getOrCreateUser(sender);
  if (!userId) return;

  // Find the original bet for this epoch
  const { data: bet } = await supabase
    .from('bets')
    .select('id')
    .eq('user_id', userId)
    .eq('epoch', epoch)
    .single();

  if (bet) {
    // Update bet as won
    await supabase
      .from('bets')
      .update({
        won: true,
        claimed_amount: amount,
      })
      .eq('id', bet.id);
  }

  // Update user stats with win
  await updateUserStats(userId, '0', amount);

  const amountSTT = (Number(amount) / 1e18).toFixed(4);
  console.log(`🏆 CLAIM | ${sender.slice(0, 10)}... | ${amountSTT} STT | Epoch ${epoch}`);
}

/**
 * Update user platform stats
 */
async function updateUserStats(userId, betAmount, claimAmount) {
  // Get current stats
  const { data: stats } = await supabase
    .from('user_platform_stats')
    .select('*')
    .eq('user_id', userId)
    .eq('platform_id', platformId)
    .single();

  const currentStats = stats || {
    total_bets: 0,
    wins: 0,
    losses: 0,
    volume: '0',
    score: 0,
  };

  // Calculate new values
  const isNewBet = BigInt(betAmount || '0') > 0n;
  const isWin = BigInt(claimAmount || '0') > 0n;

  const newTotalBets = currentStats.total_bets + (isNewBet ? 1 : 0);
  const newWins = currentStats.wins + (isWin ? 1 : 0);
  const newLosses = newTotalBets - newWins;
  const newVolume = (BigInt(currentStats.volume || '0') + BigInt(betAmount || '0')).toString();
  const newWinRate = newTotalBets > 0 ? (newWins / newTotalBets) * 100 : 0;

  // Calculate score using Wilson Score and sample size adjustments
  const newScore = calculateSimpleScore({
    wins: newWins,
    totalBets: newTotalBets,
    volume: newVolume,
  });

  // VALIDATION: Score should never exceed MAX_SCORE (1300)
  if (newScore > SCORING_CONFIG.MAX_SCORE) {
    console.error(`[SCORE ANOMALY] Score ${newScore} exceeds max ${SCORING_CONFIG.MAX_SCORE} for user ${userId}`);
  }

  // Upsert stats
  await supabase
    .from('user_platform_stats')
    .upsert({
      user_id: userId,
      platform_id: platformId,
      total_bets: newTotalBets,
      wins: newWins,
      losses: newLosses,
      win_rate: Math.round(newWinRate * 100) / 100,
      volume: newVolume,
      score: newScore,
      last_bet_at: new Date().toISOString(),
      last_updated: new Date().toISOString(),
    }, { onConflict: 'user_id,platform_id' });
}

/**
 * Process a batch of blocks
 */
async function processBlocks(fromBlock, toBlock, provider) {
  try {
    // Fetch all relevant events in one call
    const filter = {
      address: config.DREAMDEX_PREDICTION,
      fromBlock,
      toBlock,
      topics: [[TOPICS.BetBull, TOPICS.BetBear, TOPICS.Claim]],
    };

    const logs = await provider.getLogs(filter);

    if (logs.length === 0) return;

    console.log(`📥 Processing ${logs.length} events from blocks ${fromBlock}-${toBlock}`);

    for (const log of logs) {
      if (log.topics[0] === TOPICS.BetBull) {
        await processBetEvent(log, 'bull');
      } else if (log.topics[0] === TOPICS.BetBear) {
        await processBetEvent(log, 'bear');
      } else if (log.topics[0] === TOPICS.Claim) {
        await processClaimEvent(log);
      }
    }
  } catch (error) {
    console.error(`Error processing blocks ${fromBlock}-${toBlock}:`, error.message);
    throw error;
  }
}

/**
 * Main polling loop
 */
async function startPolling() {
  const provider = new ethers.JsonRpcProvider(config.Somnia_RPC);

  console.log('🔄 Starting polling loop...');

  const poll = async () => {
    if (isProcessing) return;
    isProcessing = true;

    try {
      const currentBlock = await provider.getBlockNumber();

      if (currentBlock > lastProcessedBlock) {
        const fromBlock = lastProcessedBlock + 1;
        const toBlock = Math.min(fromBlock + config.BATCH_SIZE - 1, currentBlock);

        await processBlocks(fromBlock, toBlock, provider);
        lastProcessedBlock = toBlock;
      }
    } catch (error) {
      console.error('Polling error:', error.message);
      // Wait longer on error
      await new Promise(resolve => setTimeout(resolve, 5000));
    } finally {
      isProcessing = false;
    }
  };

  // Initial poll
  await poll();

  // Continue polling
  setInterval(poll, config.POLL_INTERVAL);
}

/**
 * Main entry point
 */
async function main() {
  try {
    await initialize();
    await startPolling();

    console.log('✅ Indexer running! Press Ctrl+C to stop.');

    // Keep alive
    process.on('SIGINT', () => {
      console.log('\n👋 Shutting down...');
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
