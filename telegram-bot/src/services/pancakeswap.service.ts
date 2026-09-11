// @ts-nocheck
import { ethers } from 'ethers';
import { config } from '../config';
import { DreamDEXRound } from '../types';

const DREAMDEX_PREDICTION_ABI = [
  'function currentEpoch() view returns (uint256)',
  'function rounds(uint256) view returns (uint256 epoch, uint256 startTimestamp, uint256 lockTimestamp, uint256 closeTimestamp, int256 lockPrice, int256 closePrice, uint256 lockOracleId, uint256 closeOracleId, uint256 totalAmount, uint256 bullAmount, uint256 bearAmount, uint256 rewardBaseCalAmount, uint256 rewardAmount, bool oracleCalled)',
  'function getUserRounds(address user, uint256 cursor, uint256 size) view returns (uint256[] memory, tuple(uint256 position, uint256 amount, bool claimed)[] memory, uint256)',
  'function claimable(uint256 epoch, address user) view returns (bool)',
  'function ledger(uint256 epoch, address user) view returns (uint256 position, uint256 amount, bool claimed)',
  'event BetBear(address indexed sender, uint256 indexed epoch, uint256 amount)',
  'event BetBull(address indexed sender, uint256 indexed epoch, uint256 amount)',
  'event EndRound(uint256 indexed epoch, uint256 indexed roundId, int256 price)',
  'event LockRound(uint256 indexed epoch, uint256 indexed roundId, int256 price)',
  'event StartRound(uint256 indexed epoch)',
];

export class DreamDEXService {
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;

  constructor() {
    const rpcUrl = config.blockchain.network === 'mainnet'
      ? config.blockchain.somniaRpcUrl
      : config.blockchain.somniaTestnetRpcUrl;

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.contract = new ethers.Contract(
      config.contracts.dreamDEX,
      DREAMDEX_PREDICTION_ABI,
      this.provider
    );
  }

  async getCurrentEpoch(): Promise<number> {
    try {
      const epoch = await this.contract.currentEpoch();
      return Number(epoch);
    } catch (error) {
      console.error('Error fetching current epoch:', error);
      throw error;
    }
  }

  async getRound(epoch: number): Promise<DreamDEXRound | null> {
    try {
      const round = await this.contract.rounds(epoch);

      return {
        epoch: Number(round.epoch),
        startTimestamp: Number(round.startTimestamp),
        lockTimestamp: Number(round.lockTimestamp),
        closeTimestamp: Number(round.closeTimestamp),
        lockPrice: round.lockPrice,
        closePrice: round.closePrice,
        totalAmount: round.totalAmount,
        bullAmount: round.bullAmount,
        bearAmount: round.bearAmount,
        rewardAmount: round.rewardAmount,
        oracleCalled: round.oracleCalled,
      };
    } catch (error) {
      console.error(`Error fetching round ${epoch}:`, error);
      return null;
    }
  }

  async getCurrentRound(): Promise<DreamDEXRound | null> {
    const currentEpoch = await this.getCurrentEpoch();
    return this.getRound(currentEpoch);
  }

  async getUserRounds(address: string, limit: number = 10): Promise<any[]> {
    try {
      const result = await this.contract.getUserRounds(address, 0, limit);
      return result[0].map((epoch: bigint, index: number) => ({
        epoch: Number(epoch),
        position: result[1][index].position,
        amount: result[1][index].amount,
        claimed: result[1][index].claimed,
      }));
    } catch (error) {
      console.error(`Error fetching user rounds for ${address}:`, error);
      return [];
    }
  }

  async getUserBet(epoch: number, address: string): Promise<any> {
    try {
      const ledger = await this.contract.ledger(epoch, address);
      return {
        position: Number(ledger.position), // 0 = Bull, 1 = Bear
        amount: ledger.amount,
        claimed: ledger.claimed,
      };
    } catch (error) {
      console.error(`Error fetching user bet for epoch ${epoch}:`, error);
      return null;
    }
  }

  async isClaimable(epoch: number, address: string): Promise<boolean> {
    try {
      return await this.contract.claimable(epoch, address);
    } catch (error) {
      console.error(`Error checking claimable for epoch ${epoch}:`, error);
      return false;
    }
  }

  formatRoundMessage(round: DreamDEXRound): string {
    const lockPrice = Number(ethers.formatUnits(round.lockPrice, 8));
    const closePrice = round.closePrice > 0 ? Number(ethers.formatUnits(round.closePrice, 8)) : null;
    const totalAmount = parseFloat(ethers.formatEther(round.totalAmount));
    const bullAmount = parseFloat(ethers.formatEther(round.bullAmount));
    const bearAmount = parseFloat(ethers.formatEther(round.bearAmount));

    const bullPercentage = totalAmount > 0 ? (bullAmount / totalAmount * 100).toFixed(1) : '0.0';
    const bearPercentage = totalAmount > 0 ? (bearAmount / totalAmount * 100).toFixed(1) : '0.0';

    let message = `🥞 **DreamDEX Event Contracts Round ${round.epoch}**\n\n`;

    message += `🔒 Lock Price: $${lockPrice.toFixed(2)}\n`;

    if (closePrice) {
      const change = ((closePrice - lockPrice) / lockPrice * 100).toFixed(2);
      const emoji = closePrice > lockPrice ? '📈' : '📉';
      message += `${emoji} Close Price: $${closePrice.toFixed(2)} (${change}%)\n\n`;
    } else {
      message += `⏳ Round in progress...\n\n`;
    }

    message += `💰 Total Pool: ${totalAmount.toFixed(4)} STT\n`;
    message += `🐂 Bull: ${bullAmount.toFixed(4)} STT (${bullPercentage}%)\n`;
    message += `🐻 Bear: ${bearAmount.toFixed(4)} STT (${bearPercentage}%)\n\n`;

    const now = Date.now() / 1000;
    if (round.oracleCalled) {
      message += `✅ Round Ended`;
    } else if (now >= round.lockTimestamp) {
      message += `🔒 Round Locked`;
    } else {
      const timeToLock = Math.floor((round.lockTimestamp - now) / 60);
      message += `⏰ Locks in ${timeToLock} minutes`;
    }

    return message;
  }

  async monitorNewRounds(callback: (round: DreamDEXRound) => void): Promise<void> {
    this.contract.on('StartRound', async (epoch) => {
      const round = await this.getRound(Number(epoch));
      if (round) {
        callback(round);
      }
    });
  }

  async calculateWinRate(address: string, rounds: number = 50): Promise<{ total: number; wins: number; winRate: number }> {
    try {
      const userRounds = await this.getUserRounds(address, rounds);
      let wins = 0;

      for (const userRound of userRounds) {
        const round = await this.getRound(userRound.epoch);
        if (!round || !round.oracleCalled) continue;

        const isWin = (userRound.position === 0 && round.closePrice > round.lockPrice) ||
                      (userRound.position === 1 && round.closePrice < round.lockPrice);

        if (isWin) wins++;
      }

      const total = userRounds.length;
      const winRate = total > 0 ? (wins / total) * 100 : 0;

      return { total, wins, winRate };
    } catch (error) {
      console.error(`Error calculating win rate for ${address}:`, error);
      return { total: 0, wins: 0, winRate: 0 };
    }
  }

  stopMonitoring(): void {
    this.contract.removeAllListeners();
  }
}

export const dreamdexSwapService = new DreamDEXService();
