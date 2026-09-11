/**
 * Blockchain Connections
 * Multi-chain provider management and contract interactions
 */

import { ethers } from 'ethers';
import { config } from './config.js';
import { logger } from './logger.js';
import type { RoundInfo, Platform } from '../types/index.js';

// ===========================================
// Contract ABIs
// ===========================================

const DREAMDEX_PREDICTION_ABI = [
  'event BetBull(address indexed sender, uint256 indexed epoch, uint256 amount)',
  'event BetBear(address indexed sender, uint256 indexed epoch, uint256 amount)',
  'event Claim(address indexed sender, uint256 indexed epoch, uint256 amount)',
  'event EndRound(uint256 indexed epoch, uint256 indexed roundId, int256 price)',
  'event StartRound(uint256 indexed epoch)',
  'event LockRound(uint256 indexed epoch, uint256 indexed roundId, int256 price)',
  'function currentEpoch() view returns (uint256)',
  'function genesisLockOnce() view returns (bool)',
  'function genesisStartOnce() view returns (bool)',
  'function intervalSeconds() view returns (uint256)',
  'function minBetAmount() view returns (uint256)',
  'function treasuryFee() view returns (uint256)',
  'function rounds(uint256 epoch) view returns (uint256 epoch, uint256 startTimestamp, uint256 lockTimestamp, uint256 closeTimestamp, int256 lockPrice, int256 closePrice, uint256 lockOracleId, uint256 closeOracleId, uint256 totalAmount, uint256 bullAmount, uint256 bearAmount, uint256 rewardBaseCalAmount, uint256 rewardAmount, bool oracleCalled)',
  'function ledger(uint256 epoch, address user) view returns (uint8 position, uint256 amount, bool claimed)',
  'function getUserRounds(address user, uint256 cursor, uint256 size) view returns (uint256[], tuple(uint8 position, uint256 amount, bool claimed)[], uint256)',
];

const COPY_TRADING_VAULT_ABI = [
  'event FollowCreated(address indexed follower, address indexed leader, uint256 allocationBps, uint256 maxBet)',
  'event FollowRemoved(address indexed follower, address indexed leader)',
  'event CopyTradeExecuted(address indexed follower, address indexed leader, uint256 indexed epoch, uint256 amount, bool isBull)',
  'function batchExecuteCopyTrades(address[] followers, address leader, uint256 leaderBetAmount, uint256 epoch, bool isBull) external',
  'function executeCopyTrade(address follower, address leader, uint256 leaderBetAmount, uint256 epoch, bool isBull) external',
  'function getLeaderFollowers(address leader) view returns (address[])',
  'function getFollowerCount(address leader) view returns (uint256)',
  'function balances(address) view returns (uint256)',
  'function getUserFollows(address user) view returns (tuple(address leader, uint256 allocationBps, uint256 maxBetSize, bool active, uint256 createdAt)[])',
  'function getVaultStats() view returns (uint256 totalValueLocked, uint256 totalCopyTrades, uint256 totalVolumeExecuted, uint256 totalFeesCollected, address executor)',
  'function hasCopiedEpoch(address follower, uint256 epoch) view returns (bool)',
];

// ===========================================
// Blockchain Manager
// ===========================================

class BlockchainManager {
  private providers: Map<string, ethers.JsonRpcProvider> = new Map();
  private wsProviders: Map<string, ethers.WebSocketProvider> = new Map();
  private contracts: Map<string, ethers.Contract> = new Map();

  constructor() {
    this.initializeProviders();
    logger.info('Blockchain manager initialized');
  }

  private initializeProviders(): void {
    // Somnia Mainnet
    this.providers.set('somnia-mainnet', new ethers.JsonRpcProvider(config.blockchain.somniaMainnetRpc));

    // Somnia Testnet
    this.providers.set('somnia-testnet', new ethers.JsonRpcProvider(config.blockchain.somniaTestnetRpc));

    // Polygon (if configured)
    if (config.blockchain.polygonRpc) {
      this.providers.set('polygon', new ethers.JsonRpcProvider(config.blockchain.polygonRpc));
    }
  }

  // ===========================================
  // Provider Access
  // ===========================================

  getProvider(network: string): ethers.JsonRpcProvider {
    const provider = this.providers.get(network);
    if (!provider) {
      throw new Error(`No provider configured for network: ${network}`);
    }
    return provider;
  }

  async getWebSocketProvider(network: string): Promise<ethers.WebSocketProvider> {
    const existing = this.wsProviders.get(network);
    if (existing) return existing;

    let wsUrl: string;
    switch (network) {
      case 'somnia-mainnet':
        wsUrl = config.blockchain.somniaMainnetWs;
        break;
      case 'polygon':
        wsUrl = config.blockchain.polygonWs || '';
        break;
      default:
        throw new Error(`No WebSocket URL configured for network: ${network}`);
    }

    const wsProvider = new ethers.WebSocketProvider(wsUrl);
    this.wsProviders.set(network, wsProvider);

    // Handle reconnection via error event
    wsProvider.on('error', () => {
      logger.warn(`WebSocket error for ${network}, removing provider`);
      this.wsProviders.delete(network);
    });

    return wsProvider;
  }

  // ===========================================
  // Contract Access
  // ===========================================

  getDreamDEXPrediction(network: 'somnia-mainnet' | 'somnia-testnet' = 'somnia-mainnet'): ethers.Contract {
    const key = `dreamdex-${network}`;
    let contract = this.contracts.get(key);

    if (!contract) {
      const provider = this.getProvider(network);
      contract = new ethers.Contract(
        config.contracts.dreamDEX,
        DREAMDEX_PREDICTION_ABI,
        provider
      );
      this.contracts.set(key, contract);
    }

    return contract;
  }

  getCopyTradingVault(signer?: ethers.Signer): ethers.Contract | null {
    if (!config.contracts.copyTradingVault) {
      return null;
    }

    const key = 'copy-vault';
    let contract = this.contracts.get(key);

    if (!contract) {
      const provider = this.getProvider('somnia-testnet');
      contract = new ethers.Contract(
        config.contracts.copyTradingVault,
        COPY_TRADING_VAULT_ABI,
        signer || provider
      );
      this.contracts.set(key, contract);
    }

    return contract;
  }

  // ===========================================
  // DreamDEX Event Contracts Queries
  // ===========================================

  async getCurrentEpoch(): Promise<number> {
    const contract = this.getDreamDEXPrediction();
    const epoch = await contract.currentEpoch();
    return Number(epoch);
  }

  async getRoundInfo(epoch: number): Promise<RoundInfo> {
    const contract = this.getDreamDEXPrediction();
    const round = await contract.rounds(epoch);

    return {
      epoch: Number(round[0]),
      platform: 'dreamdex',
      startTimestamp: Number(round[1]),
      lockTimestamp: Number(round[2]),
      closeTimestamp: Number(round[3]),
      lockPrice: round[4].toString(),
      closePrice: round[5].toString(),
      totalAmount: round[8].toString(),
      bullAmount: round[9].toString(),
      bearAmount: round[10].toString(),
      bullWins: round[5] > round[4],
      oracleCalled: round[13],
    };
  }

  async getUserBetForRound(
    epoch: number,
    user: string
  ): Promise<{ position: 'Bull' | 'Bear' | 'None'; amount: string; claimed: boolean }> {
    const contract = this.getDreamDEXPrediction();
    const [position, amount, claimed] = await contract.ledger(epoch, user);

    const positionMap: Record<number, 'Bull' | 'Bear' | 'None'> = {
      0: 'None',
      1: 'Bull',
      2: 'Bear',
    };

    return {
      position: positionMap[position] || 'None',
      amount: amount.toString(),
      claimed,
    };
  }

  // ===========================================
  // Event Monitoring
  // ===========================================

  async susomniaribeToBetrEvents(
    callback: (event: {
      type: 'Bull' | 'Bear';
      sender: string;
      epoch: number;
      amount: bigint;
      txHash: string;
    }) => void
  ): Promise<() => void> {
    const wsProvider = await this.getWebSocketProvider('somnia-mainnet');
    const contract = new ethers.Contract(
      config.contracts.dreamDEX,
      DREAMDEX_PREDICTION_ABI,
      wsProvider
    );

    const handleBull = (sender: string, epoch: bigint, amount: bigint, event: any) => {
      callback({
        type: 'Bull',
        sender,
        epoch: Number(epoch),
        amount,
        txHash: event.log?.transactionHash || '',
      });
    };

    const handleBear = (sender: string, epoch: bigint, amount: bigint, event: any) => {
      callback({
        type: 'Bear',
        sender,
        epoch: Number(epoch),
        amount,
        txHash: event.log?.transactionHash || '',
      });
    };

    contract.on('BetBull', handleBull);
    contract.on('BetBear', handleBear);

    logger.info('Susomniaribed to DreamDEX bet events');

    // Return unsusomniaribe function
    return () => {
      contract.off('BetBull', handleBull);
      contract.off('BetBear', handleBear);
      logger.info('Unsusomniaribed from DreamDEX bet events');
    };
  }

  // ===========================================
  // Utility Methods
  // ===========================================

  async getBlockNumber(network = 'somnia-mainnet'): Promise<number> {
    const provider = this.getProvider(network);
    return provider.getBlockNumber();
  }

  async getGasPrice(network = 'somnia-mainnet'): Promise<bigint> {
    const provider = this.getProvider(network);
    const feeData = await provider.getFeeData();
    return feeData.gasPrice || BigInt(0);
  }

  async getBalance(address: string, network = 'somnia-mainnet'): Promise<bigint> {
    const provider = this.getProvider(network);
    return provider.getBalance(address);
  }

  formatStt(wei: bigint | string): string {
    return ethers.formatEther(wei);
  }

  parseStt(stt: string): bigint {
    return ethers.parseEther(stt);
  }

  // ===========================================
  // Cleanup
  // ===========================================

  async cleanup(): Promise<void> {
    for (const [network, wsProvider] of this.wsProviders) {
      logger.info(`Closing WebSocket for ${network}`);
      await wsProvider.destroy();
    }
    this.wsProviders.clear();
    logger.info('Blockchain manager cleaned up');
  }
}

// ===========================================
// Singleton Export
// ===========================================

export const blockchain = new BlockchainManager();
