/**
 * Bet Watcher Service
 *
 * Watches for new bets from followed traders and executes copy trades
 * Uses Supabase real-time susomniariptions to detect new bets
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Configuration
const config = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

interface User {
  id: string;
  wallet_address: string;
  username: string | null;
}

class BetWatcherService {
  private isRunning = false;

  async initialize() {
    console.log('🚀 Initializing Bet Watcher Service...');
    console.log('   This service watches for new bets and executes copy trades');
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
  }

  async start() {
    if (this.isRunning) {
      console.log('⚠️  Bet watcher is already running');
      return;
    }

    this.isRunning = true;
    console.log('🏁 Starting bet watcher...\n');

    // Susomniaribe to new bets
    const susomniaription = supabase
      .channel('bets-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bets',
        },
        async (payload) => {
          await this.handleNewBet(payload.new as Bet);
        }
      )
      .susomniaribe((status) => {
        if (status === 'SUSomniaRIBED') {
          console.log('✅ Susomniaribed to new bets');
          console.log('👀 Watching for trader activity...\n');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Susomniaription error');
        } else if (status === 'TIMED_OUT') {
          console.error('❌ Susomniaription timed out');
        }
      });

    console.log('💡 Press Ctrl+C to stop\n');
  }

  stop() {
    console.log('\n⏹️  Stopping bet watcher...');
    this.isRunning = false;
  }

  private async handleNewBet(bet: Bet) {
    try {
      console.log(`\n📥 New bet detected!`);
      console.log(`   Bet ID: ${bet.id}`);
      console.log(`   Market: ${bet.market_id}`);
      console.log(`   Position: ${bet.position}`);
      console.log(`   Amount: ${this.formatAmount(bet.amount)}`);

      // Get active followers for this trader
      const { data: follows, error: followsError } = await supabase
        .from('copy_follows')
        .select(`
          id,
          follower_id,
          trader_id,
          platform_id,
          allocation_percentage,
          max_bet_amount,
          is_active
        `)
        .eq('trader_id', bet.user_id)
        .eq('is_active', true);

      if (followsError) {
        console.error('   ❌ Error fetching followers:', followsError);
        return;
      }

      if (!follows || follows.length === 0) {
        console.log('   ℹ️  No active followers for this trader');
        return;
      }

      // Filter follows by platform (if platform-specific)
      const relevantFollows = follows.filter(
        (follow) => !follow.platform_id || follow.platform_id === bet.platform_id
      );

      if (relevantFollows.length === 0) {
        console.log('   ℹ️  No followers for this platform');
        return;
      }

      console.log(`   👥 Found ${relevantFollows.length} follower(s) to copy`);

      // Execute copy trades for each follower
      for (const follow of relevantFollows) {
        await this.executeCopyTrade(bet, follow);
      }
    } catch (error) {
      console.error('   ❌ Error handling new bet:', error);
    }
  }

  private async executeCopyTrade(originalBet: Bet, follow: CopyFollow) {
    try {
      // Get follower info
      const { data: follower, error: followerError } = await supabase
        .from('users')
        .select('wallet_address, username')
        .eq('id', follow.follower_id)
        .single();

      if (followerError || !follower) {
        console.error('      ❌ Failed to get follower info');
        return;
      }

      // Calculate copy bet amount
      const originalAmount = BigInt(originalBet.amount);
      const copyAmount = (originalAmount * BigInt(follow.allocation_percentage)) / 100n;
      const maxBetAmount = BigInt(follow.max_bet_amount);

      const finalAmount = copyAmount > maxBetAmount ? maxBetAmount : copyAmount;

      console.log(`\n      💼 Executing copy trade for ${follower.username || follower.wallet_address}`);
      console.log(`         Original amount: ${this.formatAmount(originalBet.amount)}`);
      console.log(`         Allocation: ${follow.allocation_percentage}%`);
      console.log(`         Copy amount: ${this.formatAmount(finalAmount.toString())}`);

      // In a real implementation, this would:
      // 1. Check follower's vault balance
      // 2. Call CopyTradingVault.executeCopyBet()
      // 3. Wait for transaction confirmation
      // 4. Create bet record with the copy trade details

      // For now, we'll create a simulated copy bet record
      const { data: copyBet, error: betError } = await supabase
        .from('bets')
        .insert({
          user_id: follow.follower_id,
          platform_id: originalBet.platform_id,
          market_id: originalBet.market_id,
          position: originalBet.position,
          amount: finalAmount.toString(),
          won: null, // Will be determined when market resolves
          tx_hash: `copy_${Date.now()}_${follow.follower_id.slice(0, 8)}`, // Placeholder
          block_number: originalBet.block_number,
          timestamp: new Date().toISOString(),
        })
        .select()
        .single();

      if (betError || !copyBet) {
        console.error('      ❌ Failed to create copy bet:', betError);
        return;
      }

      // Log the copy trade execution
      const { error: logError } = await supabase
        .from('copy_trades')
        .insert({
          copy_follow_id: follow.id,
          original_bet_id: originalBet.id,
          copied_bet_id: copyBet.id,
        });

      if (logError) {
        console.error('      ❌ Failed to log copy trade:', logError);
        return;
      }

      console.log(`      ✅ Copy trade executed successfully!`);
      console.log(`         Copy bet ID: ${copyBet.id}`);
    } catch (error) {
      console.error('      ❌ Error executing copy trade:', error);
    }
  }

  private formatAmount(weiAmount: string): string {
    try {
      const amount = BigInt(weiAmount);
      const stt = Number(amount) / 1e18;
      return `${stt.toFixed(4)} STT`;
    } catch {
      return weiAmount;
    }
  }
}

// Main execution
async function main() {
  const watcher = new BetWatcherService();

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

export { BetWatcherService };
