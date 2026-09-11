/**
 * Bet Watcher Service (Polling Mode)
 *
 * Watches for new bets from followed traders and executes copy trades
 * Uses polling instead of real-time susomniariptions (doesn't require Supabase realtime)
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Configuration
const config = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  pollInterval: 5000, // Poll every 5 seconds
};

// Initialize Supabase client
const supabase = createClient(config.supabaseUrl, config.supabaseKey);

interface Bet {
  id: string;
  user_id: string;
  platform_id: number;
  market_id: string;
  position: string;
  amount: string;
  tx_hash: string;
  block_number: number;
  timestamp: string;
  created_at: string;
}

interface CopyFollow {
  id: string;
  follower_id: string;
  trader_id: string;
  platform_id: number | null;
  allocation_percentage: number;
  max_bet_amount: string;
  is_active: boolean;
}

class BetWatcherServicePolling {
  private isRunning = false;
  private lastCheckTime: string = new Date(0).toISOString(); // Start from epoch
  private processedBetIds = new Set<string>();

  async initialize() {
    console.log('🚀 Initializing Bet Watcher Service (Polling Mode)...');
    console.log('   This service watches for new bets and executes copy trades');
    console.log(`   Poll interval: ${config.pollInterval}ms`);
    console.log('');

    // Check database connection
    const { data, error } = await supabase
      .from('platforms')
      .select('id, name')
      .limit(1);

    if (error) {
      console.error('❌ Failed to connect to database:', error);
      throw error;
    }

    console.log('✅ Connected to Supabase database');

    // Check for active copy follows
    const { data: follows, error: followsError } = await supabase
      .from('copy_follows')
      .select('id, follower_id, trader_id')
      .eq('is_active', true);

    if (followsError) {
      console.error('❌ Failed to fetch copy follows:', followsError);
      throw followsError;
    }

    console.log(`📊 Active copy follows: ${follows?.length || 0}`);
    console.log('');

    // Set last check time to now minus 1 hour to catch recent bets
    this.lastCheckTime = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  }

  async start() {
    if (this.isRunning) {
      console.log('⚠️  Bet watcher is already running');
      return;
    }

    this.isRunning = true;
    console.log('🏁 Starting bet watcher (polling mode)...\n');
    console.log('💡 Press Ctrl+C to stop\n');

    // Start polling loop
    while (this.isRunning) {
      try {
        await this.checkForNewBets();
      } catch (error) {
        console.error('❌ Error in polling loop:', error);
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, config.pollInterval));
    }
  }

  stop() {
    console.log('\n⏹️  Stopping bet watcher...');
    this.isRunning = false;
  }

  private async checkForNewBets() {
    // Fetch new bets since last check
    const { data: newBets, error } = await supabase
      .from('bets')
      .select('*')
      .gt('created_at', this.lastCheckTime)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ Failed to fetch new bets:', error);
      return;
    }

    if (!newBets || newBets.length === 0) {
      return; // No new bets
    }

    console.log(`🆕 Found ${newBets.length} new bet(s) since ${new Date(this.lastCheckTime).toLocaleTimeString()}`);

    // Process each new bet
    for (const bet of newBets) {
      // Skip if already processed
      if (this.processedBetIds.has(bet.id)) {
        continue;
      }

      await this.handleNewBet(bet);
      this.processedBetIds.add(bet.id);
    }

    // Update last check time to the most recent bet
    if (newBets.length > 0) {
      this.lastCheckTime = newBets[newBets.length - 1].created_at;
    }
  }

  private async handleNewBet(bet: Bet) {
    console.log(`\n🎲 Processing bet from user: ${bet.user_id.slice(0, 8)}...`);
    console.log(`   Amount: ${(Number(bet.amount) / 1e18).toFixed(4)} STT`);
    console.log(`   Position: ${bet.position}`);
    console.log(`   Market: ${bet.market_id}`);

    // Find active copy follows for this trader
    const { data: follows, error: followsError } = await supabase
      .from('copy_follows')
      .select('*')
      .eq('trader_id', bet.user_id)
      .eq('is_active', true);

    if (followsError) {
      console.error('❌ Failed to fetch copy follows:', followsError);
      return;
    }

    if (!follows || follows.length === 0) {
      console.log('   ℹ️  No active followers for this trader');
      return;
    }

    console.log(`   👥 Found ${follows.length} active follower(s)`);

    // Execute copy trade for each follower
    for (const follow of follows) {
      await this.executeCopyTrade(bet, follow);
    }
  }

  private async executeCopyTrade(originalBet: Bet, follow: CopyFollow) {
    try {
      // Check platform match (if specified)
      if (follow.platform_id !== null && follow.platform_id !== originalBet.platform_id) {
        console.log(`   ⏭️  Skipping - platform mismatch`);
        return;
      }

      // Calculate copy amount
      const originalAmount = BigInt(originalBet.amount);
      const allocation = BigInt(follow.allocation_percentage);
      let copyAmount = (originalAmount * allocation) / 100n;

      // Apply max bet cap
      const maxBet = BigInt(follow.max_bet_amount);
      if (copyAmount > maxBet) {
        copyAmount = maxBet;
        console.log(`   ⚠️  Copy amount capped at max bet: ${(Number(maxBet) / 1e18).toFixed(4)} STT`);
      }

      console.log(`   💰 Copy amount: ${(Number(copyAmount) / 1e18).toFixed(4)} STT (${follow.allocation_percentage}% of ${(Number(originalAmount) / 1e18).toFixed(4)} STT)`);

      // Create copy bet
      const { data: copyBet, error: copyBetError } = await supabase
        .from('bets')
        .insert({
          user_id: follow.follower_id,
          platform_id: originalBet.platform_id,
          market_id: originalBet.market_id,
          position: originalBet.position,
          amount: copyAmount.toString(),
          won: null,
          tx_hash: `copy_${Date.now()}_${follow.follower_id.slice(0, 8)}`,
          block_number: originalBet.block_number,
          timestamp: originalBet.timestamp,
        })
        .select()
        .single();

      if (copyBetError) {
        console.error(`   ❌ Failed to create copy bet:`, copyBetError);
        return;
      }

      // Record copy trade relationship
      const { error: copyTradeError } = await supabase
        .from('copy_trades')
        .insert({
          copy_follow_id: follow.id,
          original_bet_id: originalBet.id,
          copied_bet_id: copyBet.id,
          executed_at: new Date().toISOString(),
        });

      if (copyTradeError) {
        console.error(`   ❌ Failed to record copy trade:`, copyTradeError);
        return;
      }

      console.log(`   ✅ Created copy bet: ${copyBet.id}`);
    } catch (error) {
      console.error(`   ❌ Error executing copy trade:`, error);
    }
  }
}

// Main execution
async function main() {
  const watcher = new BetWatcherServicePolling();

  await watcher.initialize();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    watcher.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    watcher.stop();
    process.exit(0);
  });

  await watcher.start();
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { BetWatcherServicePolling };
