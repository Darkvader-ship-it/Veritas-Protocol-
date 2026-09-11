/**
 * Copy Trading Executor Service
 *
 * This service monitors leader wallets for DreamDEX Event Contracts bets
 * and automatically executes copy trades for followers.
 *
 * Features:
 * - Auto-detects leaders from vault contract events
 * - WebSocket + polling for real-time bet monitoring
 * - Batch execution for gas efficiency
 * - Graceful error handling and recovery
 *
 * Run with: npx ts-node services/copy-trading/index.ts
 */

import { ethers } from 'ethers';
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment from frontend/.env.local
const envPath = path.resolve(process.cwd(), '..', 'frontend', '.env.local');
config({ path: envPath });

// Fallback: try current directory parent
if (!process.env.EXECUTOR_PRIVATE_KEY) {
  config({ path: path.resolve(process.cwd(), '../../frontend/.env.local') });
}

// ============================================
// Configuration
// ============================================

const CONFIG = {
  // Somnia RPC endpoints (Testnet for now, switch to mainnet for production)
  Somnia_RPC_URL: process.env.Somnia_RPC_URL || 'https://data-seed-presomnia-1-s1.somnia.org:8545/',
  Somnia_WS_URL: process.env.Somnia_WS_URL || 'wss://somnia-testnet.publicnode.com',

  // Contract addresses
  // Note: DreamDEX Event Contracts is mainnet-only. For testnet testing, we'll monitor
  // but copy trades will only work with a testnet prediction contract.
  DREAMDEX_PREDICTION: process.env.DREAMDEX_PREDICTION || '0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9',
  COPY_TRADING_VAULT: process.env.NEXT_PUBLIC_COPY_TRADING_VAULT || '',

  // Executor wallet (hot wallet for executing trades)
  EXECUTOR_PRIVATE_KEY: process.env.EXECUTOR_PRIVATE_KEY || '',

  // Monitoring settings
  POLL_INTERVAL_MS: 3000, // Check every 3 seconds
  LEADER_REFRESH_INTERVAL_MS: 60000, // Refresh leaders every minute
  MAX_GAS_PRICE_GWEI: 10, // Don't execute if gas > 10 gwei
  MIN_COPY_AMOUNT_STT: 0.001, // Minimum 0.001 STT to copy

  // State persistence
  STATE_FILE: path.resolve(process.cwd(), 'state.json'),
};

// ============================================
// ABIs
// ============================================

const DREAMDEX_PREDICTION_ABI = [
  'event BetBull(address indexed sender, uint256 indexed epoch, uint256 amount)',
  'event BetBear(address indexed sender, uint256 indexed epoch, uint256 amount)',
  'function currentEpoch() view returns (uint256)',
  'function rounds(uint256) view returns (uint256 epoch, uint256 startTimestamp, uint256 lockTimestamp, uint256 closeTimestamp, int256 lockPrice, int256 closePrice, uint256 lockOracleId, uint256 closeOracleId, uint256 totalAmount, uint256 bullAmount, uint256 bearAmount, uint256 rewardBaseCalAmount, uint256 rewardAmount, bool oracleCalled)',
];

const COPY_TRADING_VAULT_ABI = [
  // Events for leader detection
  'event FollowCreated(address indexed follower, address indexed leader, uint256 allocationBps, uint256 maxBet)',
  'event FollowRemoved(address indexed follower, address indexed leader)',
  'event CopyTradeExecuted(address indexed follower, address indexed leader, uint256 indexed epoch, uint256 amount, bool isBull)',

  // Functions
  'function batchExecuteCopyTrades(address[] followers, address leader, uint256 leaderBetAmount, uint256 epoch, bool isBull) external',
  'function executeCopyTrade(address follower, address leader, uint256 leaderBetAmount, uint256 epoch, bool isBull) external',
  'function getLeaderFollowers(address leader) view returns (address[])',
  'function getFollowerCount(address leader) view returns (uint256)',
  'function balances(address) view returns (uint256)',
  'function getUserFollows(address user) view returns (tuple(address leader, uint256 allocationBps, uint256 maxBetSize, bool active, uint256 createdAt)[])',
  'function getVaultStats() view returns (uint256 totalValueLocked, uint256 totalCopyTrades, uint256 totalVolumeExecuted, uint256 totalFeesCollected, address executor)',
  'function hasCopiedEpoch(address follower, uint256 epoch) view returns (bool)',
];

// ============================================
// Types
// ============================================

interface ServiceState {
  leaders: string[];
  lastProcessedBlock: number;
  processedBets: string[]; // Array of `${leader}-${epoch}` keys
  stats: {
    betsDetected: number;
    copyTradesExecuted: number;
    copyTradesFailed: number;
    totalVolumeExecuted: string; // BigInt as string
  };
}

// ============================================
// Service Class
// ============================================

class CopyTradingExecutor {
  private provider: ethers.JsonRpcProvider;
  private wsProvider: ethers.WebSocketProvider | null = null;
  private wallet: ethers.Wallet;
  private dreamdexContract: ethers.Contract;
  private vaultContract: ethers.Contract;
  private isRunning = false;
  private state: ServiceState;

  constructor() {
    // Validate config
    if (!CONFIG.EXECUTOR_PRIVATE_KEY) {
      throw new Error('EXECUTOR_PRIVATE_KEY not set in environment');
    }
    if (!CONFIG.COPY_TRADING_VAULT) {
      throw new Error('NEXT_PUBLIC_COPY_TRADING_VAULT not set in environment');
    }

    // Initialize provider and wallet
    this.provider = new ethers.JsonRpcProvider(CONFIG.Somnia_RPC_URL);
    this.wallet = new ethers.Wallet(CONFIG.EXECUTOR_PRIVATE_KEY, this.provider);

    // Initialize contracts
    this.dreamdexContract = new ethers.Contract(
      CONFIG.DREAMDEX_PREDICTION,
      DREAMDEX_PREDICTION_ABI,
      this.provider
    );

    this.vaultContract = new ethers.Contract(
      CONFIG.COPY_TRADING_VAULT,
      COPY_TRADING_VAULT_ABI,
      this.wallet
    );

    // Load or initialize state
    this.state = this.loadState();
  }

  /**
   * Load persisted state or create new
   */
  private loadState(): ServiceState {
    try {
      if (fs.existsSync(CONFIG.STATE_FILE)) {
        const data = fs.readFileSync(CONFIG.STATE_FILE, 'utf-8');
        const state = JSON.parse(data);
        console.log(`Loaded state: ${state.leaders.length} leaders, ${state.processedBets.length} processed bets`);
        return state;
      }
    } catch (error) {
      console.warn('Could not load state, starting fresh:', error);
    }

    return {
      leaders: [],
      lastProcessedBlock: 0,
      processedBets: [],
      stats: {
        betsDetected: 0,
        copyTradesExecuted: 0,
        copyTradesFailed: 0,
        totalVolumeExecuted: '0',
      },
    };
  }

  /**
   * Save state to disk
   */
  private saveState(): void {
    try {
      // Keep only last 1000 processed bets to prevent unbounded growth
      if (this.state.processedBets.length > 1000) {
        this.state.processedBets = this.state.processedBets.slice(-1000);
      }
      fs.writeFileSync(CONFIG.STATE_FILE, JSON.stringify(this.state, null, 2));
    } catch (error) {
      console.error('Failed to save state:', error);
    }
  }

  /**
   * Start the executor service
   */
  async start(): Promise<void> {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║         VERITAS COPY TRADING EXECUTOR                ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`Executor Wallet: ${this.wallet.address}`);
    console.log(`Vault Contract:  ${CONFIG.COPY_TRADING_VAULT}`);
    console.log(`DreamDEX:     ${CONFIG.DREAMDEX_PREDICTION}`);
    console.log('');

    // Check executor balance
    const balance = await this.provider.getBalance(this.wallet.address);
    console.log(`Executor Balance: ${ethers.formatEther(balance)} STT`);

    if (balance < ethers.parseEther('0.01')) {
      console.warn('⚠️  WARNING: Low executor balance! Fund the wallet for gas fees.');
    }

    // Check vault stats
    try {
      const stats = await this.vaultContract.getVaultStats();
      console.log(`\nVault Stats:`);
      console.log(`  TVL: ${ethers.formatEther(stats[0])} STT`);
      console.log(`  Total Copy Trades: ${stats[1]}`);
      console.log(`  Total Volume: ${ethers.formatEther(stats[2])} STT`);
      console.log(`  Configured Executor: ${stats[4]}`);

      if (stats[4].toLowerCase() !== this.wallet.address.toLowerCase()) {
        console.error('❌ ERROR: Wallet is not the configured executor!');
        console.error(`   Expected: ${stats[4]}`);
        console.error(`   Got: ${this.wallet.address}`);
        throw new Error('Executor wallet mismatch');
      }
    } catch (error: any) {
      if (error.message !== 'Executor wallet mismatch') {
        console.warn('Could not fetch vault stats:', error.message);
      } else {
        throw error;
      }
    }

    this.isRunning = true;

    // Initial leader discovery
    await this.discoverLeaders();

    // Start WebSocket monitoring
    await this.startWebSocketMonitoring();

    // Start polling as backup
    this.startPolling();

    // Periodically refresh leaders
    this.startLeaderRefresh();

    console.log('\n✅ Executor running. Monitoring for leader bets...\n');
  }

  /**
   * Discover leaders by querying vault contract events
   */
  async discoverLeaders(): Promise<void> {
    console.log('\nDiscovering leaders from vault events...');

    try {
      // Query FollowCreated events from the last 100,000 blocks
      const currentBlock = await this.provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 100000);

      const filter = this.vaultContract.filters.FollowCreated();
      const events = await this.vaultContract.queryFilter(filter, fromBlock, currentBlock);

      const leaderSet = new Set<string>();

      for (const event of events) {
        const args = (event as any).args;
        if (args && args.leader) {
          const leader = args.leader.toLowerCase();
          // Verify leader still has followers
          try {
            const followerCount = await this.vaultContract.getFollowerCount(leader);
            if (followerCount > 0) {
              leaderSet.add(leader);
            }
          } catch (e) {
            // Skip if check fails
          }
        }
      }

      this.state.leaders = Array.from(leaderSet);
      this.state.lastProcessedBlock = currentBlock;
      this.saveState();

      console.log(`Found ${this.state.leaders.length} active leaders:`);
      for (const leader of this.state.leaders) {
        const count = await this.vaultContract.getFollowerCount(leader);
        console.log(`  ${leader} (${count} followers)`);
      }
    } catch (error) {
      console.error('Error discovering leaders:', error);
    }
  }

  /**
   * Start WebSocket monitoring for real-time events
   */
  async startWebSocketMonitoring(): Promise<void> {
    try {
      this.wsProvider = new ethers.WebSocketProvider(CONFIG.Somnia_WS_URL);

      const dreamdexWs = new ethers.Contract(
        CONFIG.DREAMDEX_PREDICTION,
        DREAMDEX_PREDICTION_ABI,
        this.wsProvider
      );

      // Listen for BetBull events
      dreamdexWs.on('BetBull', async (sender: string, epoch: bigint, amount: bigint, event: any) => {
        await this.handleBetEvent(sender, Number(epoch), amount, true, event.log?.transactionHash || '');
      });

      // Listen for BetBear events
      dreamdexWs.on('BetBear', async (sender: string, epoch: bigint, amount: bigint, event: any) => {
        await this.handleBetEvent(sender, Number(epoch), amount, false, event.log?.transactionHash || '');
      });

      // Also monitor vault for new followers
      const vaultWs = new ethers.Contract(
        CONFIG.COPY_TRADING_VAULT,
        COPY_TRADING_VAULT_ABI,
        this.wsProvider
      );

      vaultWs.on('FollowCreated', async (follower: string, leader: string) => {
        const leaderLower = leader.toLowerCase();
        if (!this.state.leaders.includes(leaderLower)) {
          console.log(`\n📢 New leader detected: ${leader}`);
          this.state.leaders.push(leaderLower);
          this.saveState();
        }
      });

      console.log('WebSocket monitoring active');
    } catch (error) {
      console.error('WebSocket connection failed, using polling only:', error);
    }
  }

  /**
   * Polling fallback for bet detection
   */
  startPolling(): void {
    setInterval(async () => {
      if (!this.isRunning) return;

      try {
        const latestBlock = await this.provider.getBlockNumber();
        const fromBlock = latestBlock - 10; // Last ~30 seconds

        const bullFilter = this.dreamdexContract.filters.BetBull();
        const bearFilter = this.dreamdexContract.filters.BetBear();

        const [bullEvents, bearEvents] = await Promise.all([
          this.dreamdexContract.queryFilter(bullFilter, fromBlock, latestBlock),
          this.dreamdexContract.queryFilter(bearFilter, fromBlock, latestBlock),
        ]);

        // Process bull events
        for (const event of bullEvents) {
          const eventLog = event as ethers.EventLog;
          if (eventLog.args) {
            await this.handleBetEvent(
              eventLog.args[0] as string,
              Number(eventLog.args[1]),
              eventLog.args[2] as bigint,
              true, // isBull
              event.transactionHash
            );
          }
        }

        // Process bear events
        for (const event of bearEvents) {
          const eventLog = event as ethers.EventLog;
          if (eventLog.args) {
            await this.handleBetEvent(
              eventLog.args[0] as string,
              Number(eventLog.args[1]),
              eventLog.args[2] as bigint,
              false, // isBear
              event.transactionHash
            );
          }
        }
      } catch (error) {
        // Silent fail for polling - it's a backup
      }
    }, CONFIG.POLL_INTERVAL_MS);
  }

  /**
   * Periodically refresh leader list
   */
  startLeaderRefresh(): void {
    setInterval(async () => {
      if (!this.isRunning) return;
      await this.discoverLeaders();
    }, CONFIG.LEADER_REFRESH_INTERVAL_MS);
  }

  /**
   * Handle a detected bet event
   */
  async handleBetEvent(
    sender: string,
    epoch: number,
    amount: bigint,
    isBull: boolean,
    txHash: string
  ): Promise<void> {
    const senderLower = sender.toLowerCase();

    // Check if this is a leader we're monitoring
    if (!this.state.leaders.includes(senderLower)) {
      return;
    }

    // Check for duplicate
    const betKey = `${senderLower}-${epoch}`;
    if (this.state.processedBets.includes(betKey)) {
      return;
    }

    // Mark as processed
    this.state.processedBets.push(betKey);
    this.state.stats.betsDetected++;

    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║                   LEADER BET DETECTED                     ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log(`║ Leader: ${sender.slice(0, 20)}...`);
    console.log(`║ Epoch:  ${epoch}`);
    console.log(`║ Amount: ${ethers.formatEther(amount)} STT`);
    console.log(`║ Bet:    ${isBull ? '🐂 BULL (UP)' : '🐻 BEAR (DOWN)'}`);
    console.log(`║ Tx:     ${txHash.slice(0, 20)}...`);
    console.log('╚══════════════════════════════════════════════════════════╝');

    // Execute copy trades
    await this.executeCopyTrades(sender, epoch, amount, isBull);
  }

  /**
   * Execute copy trades for all followers
   */
  async executeCopyTrades(
    leader: string,
    epoch: number,
    amount: bigint,
    isBull: boolean
  ): Promise<void> {
    try {
      // Get followers
      const followers = await this.vaultContract.getLeaderFollowers(leader);

      if (followers.length === 0) {
        console.log('  ℹ️  No followers to copy for this leader');
        return;
      }

      console.log(`\n  Processing ${followers.length} followers...`);

      // Filter followers with sufficient balance who haven't already copied
      const eligibleFollowers: string[] = [];

      for (const follower of followers) {
        try {
          // Check balance
          const balance = await this.vaultContract.balances(follower);
          if (balance < ethers.parseEther(CONFIG.MIN_COPY_AMOUNT_STT.toString())) {
            console.log(`    ${follower.slice(0, 10)}... - Insufficient balance`);
            continue;
          }

          // Check if already copied this epoch
          const hasCopied = await this.vaultContract.hasCopiedEpoch(follower, epoch);
          if (hasCopied) {
            console.log(`    ${follower.slice(0, 10)}... - Already copied epoch ${epoch}`);
            continue;
          }

          eligibleFollowers.push(follower);
          console.log(`    ${follower.slice(0, 10)}... - Eligible ✓`);
        } catch (e) {
          console.log(`    ${follower.slice(0, 10)}... - Check failed`);
        }
      }

      if (eligibleFollowers.length === 0) {
        console.log('  ℹ️  No eligible followers to copy');
        this.saveState();
        return;
      }

      // Check gas price
      const feeData = await this.provider.getFeeData();
      const gasPrice = feeData.gasPrice || BigInt(0);
      const maxGas = ethers.parseUnits(CONFIG.MAX_GAS_PRICE_GWEI.toString(), 'gwei');

      if (gasPrice > maxGas) {
        console.log(`  ⚠️  Gas too high: ${ethers.formatUnits(gasPrice, 'gwei')} gwei. Skipping.`);
        this.saveState();
        return;
      }

      console.log(`\n  Executing batch copy trade for ${eligibleFollowers.length} followers...`);

      // Execute batch copy trade
      const tx = await this.vaultContract.batchExecuteCopyTrades(
        eligibleFollowers,
        leader,
        amount,
        epoch,
        isBull,
        {
          gasLimit: BigInt(300000) + BigInt(eligibleFollowers.length) * BigInt(150000),
        }
      );

      console.log(`  📤 Tx submitted: ${tx.hash}`);

      const receipt = await tx.wait();

      if (receipt && receipt.status === 1) {
        console.log(`  ✅ SUCCESS! Gas used: ${receipt.gasUsed}`);
        this.state.stats.copyTradesExecuted += eligibleFollowers.length;

        // Update volume
        const currentVolume = BigInt(this.state.stats.totalVolumeExecuted);
        const addedVolume = amount * BigInt(eligibleFollowers.length);
        this.state.stats.totalVolumeExecuted = (currentVolume + addedVolume).toString();
      } else {
        console.log(`  ❌ Transaction failed`);
        this.state.stats.copyTradesFailed++;
      }

      this.saveState();
    } catch (error: any) {
      console.error('  ❌ Error executing copy trades:', error.message);
      this.state.stats.copyTradesFailed++;
      this.saveState();
    }
  }

  /**
   * Manually add a leader to monitor
   */
  addLeader(address: string): void {
    const lower = address.toLowerCase();
    if (!this.state.leaders.includes(lower)) {
      this.state.leaders.push(lower);
      this.saveState();
      console.log(`Added leader: ${address}`);
    }
  }

  /**
   * Get current stats
   */
  getStats(): object {
    return {
      isRunning: this.isRunning,
      leaders: this.state.leaders.length,
      processedBets: this.state.processedBets.length,
      ...this.state.stats,
      totalVolumeExecutedSTT: ethers.formatEther(this.state.stats.totalVolumeExecuted),
    };
  }

  /**
   * Stop the service
   */
  stop(): void {
    this.isRunning = false;
    if (this.wsProvider) {
      this.wsProvider.destroy();
    }
    this.saveState();
    console.log('\n📊 Final Stats:', this.getStats());
    console.log('Executor stopped.');
  }
}

// ============================================
// Main Entry Point
// ============================================

async function main(): Promise<void> {
  console.log('Starting Veritas Copy Trading Executor...\n');

  const executor = new CopyTradingExecutor();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\nReceived SIGINT. Shutting down gracefully...');
    executor.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n\nReceived SIGTERM. Shutting down gracefully...');
    executor.stop();
    process.exit(0);
  });

  await executor.start();

  // Print stats every 5 minutes
  setInterval(() => {
    console.log('\n📊 Current Stats:', executor.getStats());
  }, 300000);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

export { CopyTradingExecutor, CONFIG };
