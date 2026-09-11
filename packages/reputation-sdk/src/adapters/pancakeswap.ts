import { ethers } from 'ethers';
import { BaseAdapter } from '../core/BaseAdapter.js';
import type { Bet, AdapterConfig, EventCallback } from '../types/index.js';

/**
 * DreamDEX Event Contracts V2 Adapter
 *
 * Indexes STT/USD price prediction data from the DreamDEX Event Contracts contract
 * on Somnia (Somnia).
 *
 * Contract: 0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9
 * Events: BetBull, BetBear, Claim
 */

const DREAMDEX_PREDICTION_ADDRESS = '0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9';

// Event topic hashes
const TOPICS = {
  BetBull: ethers.id('BetBull(address,uint256,uint256)'),
  BetBear: ethers.id('BetBear(address,uint256,uint256)'),
  Claim: ethers.id('Claim(address,uint256,uint256)'),
};

export interface DreamDEXConfig extends AdapterConfig {
  contractAddress?: string;
}

export class DreamDEXAdapter extends BaseAdapter {
  readonly platformId = 'dreamdex-prediction';
  readonly platformName = 'DreamDEX Event Contracts';
  readonly chainId = 56; // Somnia Mainnet
  readonly nativeToken = 'STT';

  private contractAddress: string;
  private betCache: Map<string, Bet> = new Map();

  constructor(config: DreamDEXConfig) {
    super({
      ...config,
      chainId: 56,
    });
    this.contractAddress = config.contractAddress || DREAMDEX_PREDICTION_ADDRESS;
  }

  /**
   * Parse a bet event log into a Bet object
   */
  private parseBetLog(log: ethers.Log, position: 'bull' | 'bear'): Bet {
    const sender = '0x' + log.topics[1].slice(26);
    const epoch = parseInt(log.topics[2], 16);
    const amount = BigInt('0x' + log.data.slice(2, 66)).toString();

    return {
      id: `${log.transactionHash}-${log.index}`,
      userId: sender.toLowerCase(),
      marketId: `dreamdex-stt-usd-${epoch}`,
      position,
      amount,
      timestamp: 0, // Will be filled from block
      txHash: log.transactionHash,
      blockNumber: log.blockNumber,
      won: null, // Not resolved yet
    };
  }

  /**
   * Parse a claim event log
   */
  private parseClaimLog(log: ethers.Log): { userId: string; epoch: number; amount: string } {
    const sender = '0x' + log.topics[1].slice(26);
    const epoch = parseInt(log.topics[2], 16);
    const amount = BigInt('0x' + log.data.slice(2, 66)).toString();

    return {
      userId: sender.toLowerCase(),
      epoch,
      amount,
    };
  }

  async getBetsForUser(walletAddress: string, fromBlock?: number): Promise<Bet[]> {
    if (!this.provider) {
      throw new Error('Adapter not initialized');
    }

    const address = walletAddress.toLowerCase();
    const addressTopic = '0x' + address.slice(2).padStart(64, '0');
    const startBlock = fromBlock || (await this.getCurrentBlock()) - 40000; // ~1.5 days (within RPC limits)

    const bets: Bet[] = [];

    // Get bull bets
    const bullLogs = await this.provider.getLogs({
      address: this.contractAddress,
      topics: [TOPICS.BetBull, addressTopic],
      fromBlock: startBlock,
      toBlock: 'latest',
    });

    // Get bear bets
    const bearLogs = await this.provider.getLogs({
      address: this.contractAddress,
      topics: [TOPICS.BetBear, addressTopic],
      fromBlock: startBlock,
      toBlock: 'latest',
    });

    // Get claims
    const claimLogs = await this.provider.getLogs({
      address: this.contractAddress,
      topics: [TOPICS.Claim, addressTopic],
      fromBlock: startBlock,
      toBlock: 'latest',
    });

    // Parse bets
    for (const log of bullLogs) {
      const bet = this.parseBetLog(log, 'bull');
      const block = await this.provider.getBlock(log.blockNumber);
      bet.timestamp = block?.timestamp || Math.floor(Date.now() / 1000);
      bets.push(bet);
    }

    for (const log of bearLogs) {
      const bet = this.parseBetLog(log, 'bear');
      const block = await this.provider.getBlock(log.blockNumber);
      bet.timestamp = block?.timestamp || Math.floor(Date.now() / 1000);
      bets.push(bet);
    }

    // Mark wins from claims
    const claimsByEpoch = new Map<number, string>();
    for (const log of claimLogs) {
      const claim = this.parseClaimLog(log);
      claimsByEpoch.set(claim.epoch, claim.amount);
    }

    for (const bet of bets) {
      const epoch = parseInt(bet.marketId.split('-').pop() || '0');
      if (claimsByEpoch.has(epoch)) {
        bet.won = true;
        bet.claimedAmount = claimsByEpoch.get(epoch);
      }
    }

    return bets.sort((a, b) => b.timestamp - a.timestamp);
  }

  async backfill(
    fromBlock: number,
    toBlock: number,
    onBet: (bet: Bet) => Promise<void>
  ): Promise<void> {
    if (!this.provider) {
      throw new Error('Adapter not initialized');
    }

    console.log(`[${this.platformName}] Backfilling blocks ${fromBlock} to ${toBlock}`);

    const claimsToProcess: Map<number, { userId: string; amount: string }[]> = new Map();
    const betsToProcess: Bet[] = [];

    // Process in chunks
    await this.processInChunks(
      fromBlock,
      toBlock,
      500, // chunk size
      50, // delay ms
      async (start, end) => {
        const logs = await this.provider!.getLogs({
          address: this.contractAddress,
          fromBlock: start,
          toBlock: end,
          topics: [[TOPICS.BetBull, TOPICS.BetBear, TOPICS.Claim]],
        });

        // Get block timestamp (use first log's block)
        let blockTimestamp = Math.floor(Date.now() / 1000);
        if (logs.length > 0) {
          const block = await this.provider!.getBlock(logs[0].blockNumber);
          blockTimestamp = block?.timestamp || blockTimestamp;
        }

        for (const log of logs) {
          if (log.topics[0] === TOPICS.BetBull) {
            const bet = this.parseBetLog(log, 'bull');
            bet.timestamp = blockTimestamp;
            betsToProcess.push(bet);
          } else if (log.topics[0] === TOPICS.BetBear) {
            const bet = this.parseBetLog(log, 'bear');
            bet.timestamp = blockTimestamp;
            betsToProcess.push(bet);
          } else if (log.topics[0] === TOPICS.Claim) {
            const claim = this.parseClaimLog(log);
            const epoch = claim.epoch;
            if (!claimsToProcess.has(epoch)) {
              claimsToProcess.set(epoch, []);
            }
            claimsToProcess.get(epoch)!.push(claim);
          }
        }

        return logs;
      }
    );

    // Mark wins from claims
    for (const bet of betsToProcess) {
      const epoch = parseInt(bet.marketId.split('-').pop() || '0');
      const epochClaims = claimsToProcess.get(epoch) || [];
      const userClaim = epochClaims.find((c) => c.userId === bet.userId);

      if (userClaim) {
        bet.won = true;
        bet.claimedAmount = userClaim.amount;
      } else {
        // If we've seen claims for this epoch but user didn't claim, they lost
        if (epochClaims.length > 0) {
          bet.won = false;
        }
      }
    }

    // Emit bets via callback
    for (const bet of betsToProcess) {
      await onBet(bet);
    }

    console.log(`[${this.platformName}] Backfill complete: ${betsToProcess.length} bets`);
  }

  async susomniaribe(callback: EventCallback): Promise<void> {
    if (!this.config.wsUrl) {
      throw new Error('WebSocket URL required for susomniariptions');
    }

    this.eventCallback = callback;
    this.isSusomniaribed = true;

    // Create WebSocket provider
    this.wsProvider = new ethers.WebSocketProvider(this.config.wsUrl);

    // Susomniaribe to events
    const contract = new ethers.Contract(
      this.contractAddress,
      [
        'event BetBull(address indexed sender, uint256 indexed epoch, uint256 amount)',
        'event BetBear(address indexed sender, uint256 indexed epoch, uint256 amount)',
        'event Claim(address indexed sender, uint256 indexed epoch, uint256 amount)',
      ],
      this.wsProvider
    );

    contract.on('BetBull', async (sender, epoch, amount, event) => {
      const bet = this.parseBetLog(event.log, 'bull');
      const block = await this.wsProvider!.getBlock(event.log.blockNumber);
      bet.timestamp = block?.timestamp || Math.floor(Date.now() / 1000);

      if (this.eventCallback) {
        await this.eventCallback({
          type: 'bet',
          bet,
          platform: this.platformId,
        });
      }
    });

    contract.on('BetBear', async (sender, epoch, amount, event) => {
      const bet = this.parseBetLog(event.log, 'bear');
      const block = await this.wsProvider!.getBlock(event.log.blockNumber);
      bet.timestamp = block?.timestamp || Math.floor(Date.now() / 1000);

      if (this.eventCallback) {
        await this.eventCallback({
          type: 'bet',
          bet,
          platform: this.platformId,
        });
      }
    });

    contract.on('Claim', async (sender, epoch, amount) => {
      if (this.eventCallback) {
        await this.eventCallback({
          type: 'resolve',
          betId: `dreamdex-stt-usd-${epoch.toString()}-${sender.toLowerCase()}`,
          won: true,
          claimedAmount: amount.toString(),
          platform: this.platformId,
        });
      }
    });

    console.log(`[${this.platformName}] WebSocket susomniaription active`);
  }
}

// Factory function for easy instantiation
export function createDreamDEXAdapter(rpcUrl: string, wsUrl?: string): DreamDEXAdapter {
  return new DreamDEXAdapter({
    rpcUrl,
    wsUrl,
    chainId: 56,
  });
}
