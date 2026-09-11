/**
 * Copy Trading Simulator Service
 *
 * This service runs in SIMULATION MODE:
 * - Monitors REAL mainnet DreamDEX Event Contracts bets from leaders
 * - Uses TESTNET vault for followers/deposits
 * - Logs SIMULATED trades (no real execution)
 * - Tracks virtual PnL based on real mainnet outcomes
 *
 * This allows testing copy-trading on testnet with real mainnet data.
 *
 * Run with: npx ts-node services/copy-trading/simulator.ts
 */

import { ethers } from 'ethers';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import * as path from 'path';

// Load environment
config({ path: path.resolve(process.cwd(), '.env') });
config({ path: path.resolve(process.cwd(), '../frontend/.env.local') });

// ============================================
// Configuration
// ============================================

const CONFIG = {
  // MAINNET - for monitoring real leader bets
  Somnia_MAINNET_RPC: process.env.Somnia_RPC_URL || 'https://somnia-dataseed1.somnia.org',
  Somnia_MAINNET_WS: process.env.Somnia_MAINNET_WS || 'wss://somnia.publicnode.com',
  DREAMDEX_PREDICTION_MAINNET: '0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9',

  // TESTNET - for vault/followers
  Somnia_TESTNET_RPC: process.env.Somnia_TESTNET_RPC || 'https://data-seed-presomnia-1-s1.somnia.org:8545/',
  COPY_TRADING_VAULT: process.env.NEXT_PUBLIC_COPY_VAULT_ADDRESS || process.env.NEXT_PUBLIC_COPY_TRADING_VAULT || '',

  // Supabase for storing simulated trades
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_KEY: process.env.SUPABASE_SERVICE_KEY || '',

  // Monitoring settings
  POLL_INTERVAL_MS: 5000,
  ROUND_CHECK_INTERVAL_MS: 30000, // Check for resolved rounds every 30s
};

// ============================================
// ABIs
// ============================================

const DREAMDEX_PREDICTION_ABI = [
  'event BetBull(address indexed sender, uint256 indexed epoch, uint256 amount)',
  'event BetBear(address indexed sender, uint256 indexed epoch, uint256 amount)',
  'function currentEpoch() view returns (uint256)',
  'function rounds(uint256 epoch) view returns (uint256 epoch, uint256 startTimestamp, uint256 lockTimestamp, uint256 closeTimestamp, int256 lockPrice, int256 closePrice, uint256 lockOracleId, uint256 closeOracleId, uint256 totalAmount, uint256 bullAmount, uint256 bearAmount, uint256 rewardBaseCalAmount, uint256 rewardAmount, bool oracleCalled)',
];

const COPY_TRADING_VAULT_ABI = [
  'function getLeaderFollowers(address leader) view returns (address[])',
  'function balances(address user) view returns (uint256)',
  'function getUserFollows(address user) view returns (tuple(address leader, uint256 allocationBps, uint256 maxBetSize, bool active, uint256 createdAt)[])',
];

// ============================================
// Types
// ============================================

interface SimulatedTrade {
  id?: number;
  follower: string;
  leader: string;
  epoch: number;
  amount: string;
  is_bull: boolean;
  simulated_at: string;
  outcome?: 'win' | 'loss' | 'pending';
  pnl?: string;
  resolved_at?: string;
}

interface RoundResult {
  epoch: number;
  lockPrice: bigint;
  closePrice: bigint;
  bullWins: boolean;
  oracleCalled: boolean;
}

// ============================================
// Simulator Class
// ============================================

class CopyTradingSimulator {
  private mainnetProvider: ethers.JsonRpcProvider;
  private testnetProvider: ethers.JsonRpcProvider;
  private dreamdexContract: ethers.Contract;
  private vaultContract: ethers.Contract | null = null;
  private supabase: SupabaseClient;
  private isRunning = false;
  private leaders: Set<string> = new Set();
  private processedBets: Set<string> = new Set();
  private pendingRounds: Set<number> = new Set();

  constructor() {
    // Validate config
    if (!CONFIG.COPY_TRADING_VAULT) {
      console.warn('Warning: COPY_TRADING_VAULT not set. Will run in monitor-only mode.');
    }
    if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_KEY) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY required for simulation storage');
    }

    // Initialize providers
    this.mainnetProvider = new ethers.JsonRpcProvider(CONFIG.Somnia_MAINNET_RPC);
    this.testnetProvider = new ethers.JsonRpcProvider(CONFIG.Somnia_TESTNET_RPC);

    // Initialize contracts
    this.dreamdexContract = new ethers.Contract(
      CONFIG.DREAMDEX_PREDICTION_MAINNET,
      DREAMDEX_PREDICTION_ABI,
      this.mainnetProvider
    );

    if (CONFIG.COPY_TRADING_VAULT) {
      this.vaultContract = new ethers.Contract(
        CONFIG.COPY_TRADING_VAULT,
        COPY_TRADING_VAULT_ABI,
        this.testnetProvider
      );
    }

    // Initialize Supabase
    this.supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
  }

  /**
   * Start the simulator
   */
  async start(): Promise<void> {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║     VERITAS COPY TRADING SIMULATOR (TESTNET MODE)        ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log('║  Using REAL mainnet data with SIMULATED trade execution      ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`Mainnet DreamDEX: ${CONFIG.DREAMDEX_PREDICTION_MAINNET}`);
    console.log(`Testnet Vault:       ${CONFIG.COPY_TRADING_VAULT || 'Not configured'}`);
    console.log('');

    // Ensure database table exists
    await this.ensureTable();

    // Load leaders from leaderboard
    await this.loadLeadersFromLeaderboard();

    // Load any pending trades from database (recover from restart)
    await this.loadPendingFromDatabase();

    this.isRunning = true;

    // Start monitoring mainnet for bets
    this.startBetMonitoring();

    // Start checking for resolved rounds
    this.startRoundResolution();

    console.log('\n✅ Simulator running. Monitoring mainnet for leader bets...\n');
  }

  /**
   * Load pending epochs from database (recover from restart)
   */
  private async loadPendingFromDatabase(): Promise<void> {
    console.log('Loading pending trades from database...');
    try {
      const { data: pending, error } = await this.supabase
        .from('simulated_trades')
        .select('epoch')
        .eq('outcome', 'pending');

      if (error) {
        console.error('Error loading pending trades:', error);
        return;
      }

      const uniqueEpochs = [...new Set(pending?.map(t => t.epoch) || [])];
      for (const epoch of uniqueEpochs) {
        this.pendingRounds.add(epoch);
      }

      console.log(`Loaded ${uniqueEpochs.length} pending epochs from database`);
    } catch (error) {
      console.error('Error loading pending epochs:', error);
    }
  }

  /**
   * Ensure simulated_trades table exists
   */
  private async ensureTable(): Promise<void> {
    console.log('Checking database table...');

    // Try to query - if it fails, table might not exist
    const { error } = await this.supabase
      .from('simulated_trades')
      .select('id')
      .limit(1);

    if (error && error.message.includes('does not exist')) {
      console.log('Creating simulated_trades table...');
      // Table needs to be created via SQL migration
      console.log(`
Please run this SQL in Supabase:

CREATE TABLE IF NOT EXISTS simulated_trades (
  id SERIAL PRIMARY KEY,
  follower TEXT NOT NULL,
  leader TEXT NOT NULL,
  epoch INTEGER NOT NULL,
  amount TEXT NOT NULL,
  is_bull BOOLEAN NOT NULL,
  simulated_at TIMESTAMPTZ DEFAULT NOW(),
  outcome TEXT DEFAULT 'pending',
  pnl TEXT,
  resolved_at TIMESTAMPTZ,
  UNIQUE(follower, epoch)
);

CREATE INDEX idx_simulated_trades_follower ON simulated_trades(follower);
CREATE INDEX idx_simulated_trades_epoch ON simulated_trades(epoch);
CREATE INDEX idx_simulated_trades_outcome ON simulated_trades(outcome);
`);
    } else {
      console.log('simulated_trades table ready');
    }
  }

  /**
   * Load leaders from the real leaderboard
   */
  private async loadLeadersFromLeaderboard(): Promise<void> {
    console.log('Loading leaders from leaderboard...');

    try {
      // Get top traders from user_platform_stats
      const { data: topTraders, error } = await this.supabase
        .from('user_platform_stats')
        .select('user_id, users!inner(wallet_address)')
        .order('score', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error loading leaderboard:', error);
        return;
      }

      for (const trader of topTraders || []) {
        const address = (trader as any).users?.wallet_address;
        if (address) {
          this.leaders.add(address.toLowerCase());
        }
      }

      console.log(`Loaded ${this.leaders.size} leaders from leaderboard`);

      // Also check vault for followed leaders if vault is configured
      if (this.vaultContract) {
        await this.loadFollowedLeaders();
      }
    } catch (error) {
      console.error('Error loading leaders:', error);
    }
  }

  /**
   * Load leaders that have followers in the vault
   */
  private async loadFollowedLeaders(): Promise<void> {
    try {
      // This would require querying vault events
      // For now, we'll use the leaderboard leaders
      console.log('Vault configured - will check for followers when bets detected');
    } catch (error) {
      console.error('Error loading followed leaders:', error);
    }
  }

  /**
   * Start monitoring mainnet for bet events
   */
  private startBetMonitoring(): void {
    console.log('Starting mainnet bet monitoring (polling)...');

    let lastBlock = 0;

    setInterval(async () => {
      if (!this.isRunning) return;

      try {
        const currentBlock = await this.mainnetProvider.getBlockNumber();

        if (lastBlock === 0) {
          lastBlock = currentBlock - 10;
        }

        if (currentBlock <= lastBlock) return;

        // Query bet events
        const bullFilter = this.dreamdexContract.filters.BetBull();
        const bearFilter = this.dreamdexContract.filters.BetBear();

        const [bullEvents, bearEvents] = await Promise.all([
          this.dreamdexContract.queryFilter(bullFilter, lastBlock + 1, currentBlock),
          this.dreamdexContract.queryFilter(bearFilter, lastBlock + 1, currentBlock),
        ]);

        lastBlock = currentBlock;

        // Process events
        for (const event of bullEvents) {
          const eventLog = event as ethers.EventLog;
          if (eventLog.args) {
            await this.handleBetEvent(
              eventLog.args[0] as string,
              Number(eventLog.args[1]),
              eventLog.args[2] as bigint,
              true
            );
          }
        }

        for (const event of bearEvents) {
          const eventLog = event as ethers.EventLog;
          if (eventLog.args) {
            await this.handleBetEvent(
              eventLog.args[0] as string,
              Number(eventLog.args[1]),
              eventLog.args[2] as bigint,
              false
            );
          }
        }
      } catch (error) {
        // Silent fail for polling
      }
    }, CONFIG.POLL_INTERVAL_MS);
  }

  /**
   * Handle a detected bet event
   */
  private async handleBetEvent(
    sender: string,
    epoch: number,
    amount: bigint,
    isBull: boolean
  ): Promise<void> {
    const senderLower = sender.toLowerCase();

    // Check if this is a leader
    if (!this.leaders.has(senderLower)) {
      return;
    }

    // Deduplicate
    const betKey = `${senderLower}-${epoch}`;
    if (this.processedBets.has(betKey)) {
      return;
    }
    this.processedBets.add(betKey);

    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║              LEADER BET DETECTED (MAINNET)                   ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log(`║ Leader: ${sender.slice(0, 20)}...`);
    console.log(`║ Epoch:  ${epoch}`);
    console.log(`║ Amount: ${ethers.formatEther(amount)} STT`);
    console.log(`║ Bet:    ${isBull ? '🐂 BULL (UP)' : '🐻 BEAR (DOWN)'}`);
    console.log('╚══════════════════════════════════════════════════════════════╝');

    // Simulate copy trades
    await this.simulateCopyTrades(sender, epoch, amount, isBull);

    // Track this round for resolution
    this.pendingRounds.add(epoch);
  }

  /**
   * Simulate copy trades for followers
   */
  private async simulateCopyTrades(
    leader: string,
    epoch: number,
    leaderAmount: bigint,
    isBull: boolean
  ): Promise<void> {
    if (!this.vaultContract) {
      console.log('  ℹ️  No vault configured - skipping follower simulation');
      return;
    }

    try {
      // Get followers from testnet vault
      const followers = await this.vaultContract.getLeaderFollowers(leader);

      if (followers.length === 0) {
        console.log('  ℹ️  No followers on testnet vault');
        return;
      }

      console.log(`\n  Simulating trades for ${followers.length} followers...`);

      for (const follower of followers) {
        try {
          // Get follower's vault balance
          const balance = await this.vaultContract.balances(follower);

          if (balance === BigInt(0)) {
            console.log(`    ${follower.slice(0, 10)}... - No balance`);
            continue;
          }

          // Get follow settings
          const follows = await this.vaultContract.getUserFollows(follower);
          const followSetting = follows.find(
            (f: any) => f.leader.toLowerCase() === leader.toLowerCase() && f.active
          );

          if (!followSetting) {
            console.log(`    ${follower.slice(0, 10)}... - Not following this leader`);
            continue;
          }

          // Calculate copy amount
          let copyAmount = (leaderAmount * BigInt(followSetting.allocationBps)) / BigInt(10000);

          // Apply max bet limit
          if (copyAmount > followSetting.maxBetSize) {
            copyAmount = followSetting.maxBetSize;
          }

          // Can't exceed balance
          if (copyAmount > balance) {
            copyAmount = balance;
          }

          if (copyAmount === BigInt(0)) {
            console.log(`    ${follower.slice(0, 10)}... - Copy amount too small`);
            continue;
          }

          // Record simulated trade
          const trade: SimulatedTrade = {
            follower: follower.toLowerCase(),
            leader: leader.toLowerCase(),
            epoch,
            amount: copyAmount.toString(),
            is_bull: isBull,
            simulated_at: new Date().toISOString(),
            outcome: 'pending',
          };

          const { error } = await this.supabase
            .from('simulated_trades')
            .upsert(trade, { onConflict: 'follower,epoch' });

          if (error) {
            console.error(`    ${follower.slice(0, 10)}... - DB error:`, error.message);
          } else {
            console.log(`    ${follower.slice(0, 10)}... - SIMULATED ${ethers.formatEther(copyAmount)} STT ${isBull ? 'BULL' : 'BEAR'}`);
          }
        } catch (err: any) {
          console.log(`    ${follower.slice(0, 10)}... - Error: ${err.message}`);
        }
      }
    } catch (error: any) {
      console.error('  Error simulating copy trades:', error.message);
    }
  }

  /**
   * Periodically check for resolved rounds and update outcomes
   */
  private startRoundResolution(): void {
    console.log('Starting round resolution checker...');

    setInterval(async () => {
      if (!this.isRunning) return;
      if (this.pendingRounds.size === 0) return;

      try {
        const currentEpochBigInt = await this.dreamdexContract.currentEpoch();
        const currentEpoch = Number(currentEpochBigInt);

        for (const epoch of Array.from(this.pendingRounds)) {
          // Round needs to be at least 2 epochs behind current to be resolved
          if (currentEpoch - epoch < 2) continue;

          const result = await this.getRoundResult(epoch);

          if (result && result.oracleCalled) {
            await this.resolveSimulatedTrades(epoch, result);
            this.pendingRounds.delete(epoch);
          }
        }
      } catch (error: any) {
        console.error('Round resolution error:', error.message);
      }
    }, CONFIG.ROUND_CHECK_INTERVAL_MS);
    // Run catch-up resolver every 30 seconds for any database pending trades
    setInterval(() => this.resolvePendingFromDatabase(), 30000);
    // Run once on startup after a short delay
    setTimeout(() => this.resolvePendingFromDatabase(), 5000);
  }

  /**
   * Catch-up resolver: finds pending trades in DB and resolves them
   */
  private async resolvePendingFromDatabase(): Promise<void> {
    try {
      const currentEpochBigInt = await this.dreamdexContract.currentEpoch();
      const currentEpoch = Number(currentEpochBigInt);

      // Get all pending trades from database
      const { data: pendingTrades } = await this.supabase
        .from('simulated_trades')
        .select('epoch')
        .eq('outcome', 'pending');

      if (!pendingTrades || pendingTrades.length === 0) return;

      // Get unique epochs
      const uniqueEpochs = [...new Set(pendingTrades.map(t => t.epoch))];
      let resolved = 0;

      for (const epoch of uniqueEpochs) {
        // Skip recent epochs (not closed yet)
        if (currentEpoch - epoch < 2) continue;

        const result = await this.getRoundResult(epoch);
        if (result && result.oracleCalled) {
          await this.resolveSimulatedTrades(epoch, result);
          resolved++;
        }
      }

      if (resolved > 0) {
        console.log(`Catch-up resolver: resolved ${resolved} epochs`);
      }
    } catch (error: any) {
      console.error('Catch-up resolver error:', error.message);
    }
  }

  /**
   * Get round result from mainnet
   */
  private async getRoundResult(epoch: number): Promise<RoundResult | null> {
    try {
      const round = await this.dreamdexContract.rounds(epoch);

      return {
        epoch,
        lockPrice: round[4],
        closePrice: round[5],
        bullWins: round[5] > round[4], // closePrice > lockPrice = bull wins
        oracleCalled: round[13],
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Resolve simulated trades for an epoch
   */
  private async resolveSimulatedTrades(epoch: number, result: RoundResult): Promise<void> {
    console.log(`\n📊 Resolving epoch ${epoch} - ${result.bullWins ? 'BULL WINS' : 'BEAR WINS'}`);

    try {
      // Get pending trades for this epoch
      const { data: trades, error } = await this.supabase
        .from('simulated_trades')
        .select('*')
        .eq('epoch', epoch)
        .eq('outcome', 'pending');

      if (error || !trades) {
        console.error('Error fetching trades:', error);
        return;
      }

      for (const trade of trades) {
        const won = trade.is_bull === result.bullWins;
        // Simplified PnL: win = +95% (after 5% platform fee), loss = -100%
        const pnl = won
          ? (BigInt(trade.amount) * BigInt(95)) / BigInt(100)
          : -BigInt(trade.amount);

        await this.supabase
          .from('simulated_trades')
          .update({
            outcome: won ? 'win' : 'loss',
            pnl: pnl.toString(),
            resolved_at: new Date().toISOString(),
          })
          .eq('id', trade.id);

        console.log(`  ${trade.follower.slice(0, 10)}... - ${won ? '✅ WON' : '❌ LOST'} ${ethers.formatEther(trade.amount)} STT (PnL: ${ethers.formatEther(pnl.toString())} STT)`);
      }
    } catch (error: any) {
      console.error('Error resolving trades:', error.message);
    }
  }

  /**
   * Get simulation stats
   */
  async getStats(): Promise<object> {
    const { data: stats } = await this.supabase
      .from('simulated_trades')
      .select('outcome, amount, pnl');

    let totalTrades = 0;
    let wins = 0;
    let losses = 0;
    let pending = 0;
    let totalPnl = BigInt(0);

    for (const trade of stats || []) {
      totalTrades++;
      if (trade.outcome === 'win') {
        wins++;
        totalPnl += BigInt(trade.pnl || '0');
      } else if (trade.outcome === 'loss') {
        losses++;
        totalPnl += BigInt(trade.pnl || '0');
      } else {
        pending++;
      }
    }

    return {
      isRunning: this.isRunning,
      leadersMonitored: this.leaders.size,
      pendingRounds: this.pendingRounds.size,
      totalSimulatedTrades: totalTrades,
      wins,
      losses,
      pending,
      winRate: totalTrades > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) + '%' : 'N/A',
      totalPnlSTT: ethers.formatEther(totalPnl.toString()),
    };
  }

  /**
   * Stop the simulator
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    console.log('\n📊 Final Stats:', await this.getStats());
    console.log('Simulator stopped.');
  }
}

// ============================================
// Main Entry Point
// ============================================

async function main(): Promise<void> {
  console.log('Starting Veritas Copy Trading Simulator...\n');

  const simulator = new CopyTradingSimulator();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\nReceived SIGINT. Shutting down gracefully...');
    await simulator.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n\nReceived SIGTERM. Shutting down gracefully...');
    await simulator.stop();
    process.exit(0);
  });

  await simulator.start();

  // Print stats every 5 minutes
  setInterval(async () => {
    console.log('\n📊 Current Stats:', await simulator.getStats());
  }, 300000);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

export { CopyTradingSimulator, CONFIG };
