import { ethers } from 'ethers';
import { BaseAdapter } from '../core/BaseAdapter.js';
import type { Bet, AdapterConfig, EventCallback } from '../types/index.js';

/**
 * DreamDEX Event Contracts Adapter — Real Shannon Testnet 50312
 *
 * Indexes Somnia Shannon DreamDEX Event Contracts (Binary CLOB, ERC6909)
 * via OutcomeToken6909 Transfer (mint) + BinarySettlement Redeemed logs.
 *
 * Contracts (CREATE3 testnet=mainnet):
 * - BinaryMarketsModule 0x3ecC694Cef705358864a646142ac17A90E29e388
 * - OutcomeToken6909 0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9
 * - BinarySettlement 0xbF4a49e0Dfd092e5FBE8E5761064C49533e6Ed23
 * - Collateral tUSDC 0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E (6dec)
 *
 * Topics:
 * - Transfer(address indexed caller, address indexed sender, address indexed receiver, uint256 indexed id, uint256 amount)
 * - Redeemed(address indexed user, bytes32 indexed marketId, uint8 indexed outcome, uint256 amount)
 */

const DREAMDEX_ADDRESSES = {
  outcomeToken6909: '0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9',
  binarySettlement: '0xbF4a49e0Dfd092e5FBE8E5761064C49533e6Ed23',
  binaryMarketsModule: '0x3ecC694Cef705358864a646142ac17A90E29e388',
  collateralTUSDC: '0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E',
} as const;

// ERC6909 Transfer(address indexed caller, address indexed sender, address indexed receiver, uint256 indexed id, uint256 amount)
// Note: ERC6909 has 4 indexed params, but ethers topic handling for >3 indexed is via data? In practice DreamDEX may emit Transfer with (caller, sender, receiver, id)
// We'll use generic Transfer topic from erc6909Abi
const TOPICS = {
  // keccak256("Transfer(address,address,address,uint256,uint256)") — approximate; we derive via ethers.id
  Transfer: ethers.id('Transfer(address,address,address,uint256,uint256)'),
  // Fallback for standard ERC6909: Transfer(address indexed sender, address indexed receiver, uint256 indexed id, uint256 amount) with caller non-indexed
  TransferAlt: ethers.id('Transfer(address,address,uint256,uint256)'),
  OperatorSet: ethers.id('OperatorSet(address,address,bool)'),
  Redeemed: ethers.id('Redeemed(address,bytes32,uint8,uint256)'),
  MarketCreated: ethers.id('MarketCreated(bytes32,address,bytes32,address,uint64,uint64)'),
};

export interface DreamDEXConfig extends AdapterConfig {
  outcomeToken?: string;
  binarySettlement?: string;
  venueId?: string; // 0x6797...
}

export class DreamDEXAdapter extends BaseAdapter {
  readonly platformId = 'dreamdex';
  readonly platformName = 'DreamDEX Event Contracts';
  readonly chainId = 50312; // Somnia Shannon
  readonly nativeToken = 'STT';

  private outcomeToken: string;
  private binarySettlement: string;
  private venueId?: string;

  constructor(config: DreamDEXConfig) {
    super({ ...config, chainId: 50312 });
    this.outcomeToken = config.outcomeToken || DREAMDEX_ADDRESSES.outcomeToken6909;
    this.binarySettlement = config.binarySettlement || DREAMDEX_ADDRESSES.binarySettlement;
    this.venueId = config.venueId;
  }

  private parseTransferLog(log: ethers.Log): Bet | null {
    try {
      // Topics layout for OutcomeToken6909 Transfer:
      // topic0 = keccak(Transfer)
      // topic1 = caller or sender
      // topic2 = sender or receiver
      // topic3 = receiver or id
      // For 4-indexed Transfer, topics length = 5 (0 + 4)
      // We need to extract user (receiver) and amount/id
      // Heuristic: topics[2] is sender, topics[3] is receiver (for mint, sender=0)
      const t = log.topics;
      let userTopic = t[3] || t[2] || t[1];
      if (!userTopic) return null;
      const userId = '0x' + userTopic.slice(26);
      // data contains amount (uint256) and maybe id if not indexed
      // For ERC6909, data = abi.encode(amount) if id indexed, else encode(id,amount)
      // We'll parse amount as last 32 bytes
      const data = log.data;
      if (!data || data === '0x') return null;
      const amountHex = '0x' + data.slice(-64);
      const amount = BigInt(amountHex).toString();
      if (amount === '0') return null;

      // tokenId from topics or data
      let tokenId = '0';
      if (t.length >= 5) {
        // id is topic4
        tokenId = BigInt(t[4]).toString();
      } else if (data.length > 66) {
        // data contains id + amount
        tokenId = BigInt('0x' + data.slice(2, 66)).toString();
      }

      // Derive marketId and outcome from tokenId
      // tokenId = uint256(marketId) for YES, +1 for NO
      // So marketId = bytes32(tokenId & ~1) approx
      const tid = BigInt(tokenId);
      const marketIdNum = tid & ~1n;
      const outcomeIdx = Number(tid & 1n); // 0=YES/Up, 1=NO/Down
      const marketId = '0x' + marketIdNum.toString(16).padStart(64, '0');
      const position = outcomeIdx === 0 ? 'yes' : 'no';

      return {
        id: `${log.transactionHash}-${log.index}`,
        userId: userId.toLowerCase(),
        marketId: `dreamdex-${marketId}`,
        position,
        amount,
        timestamp: 0,
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
        won: null,
      };
    } catch {
      return null;
    }
  }

  private parseRedeemedLog(log: ethers.Log): { userId: string; marketId: string; outcome: number; amount: string } | null {
    try {
      const userId = '0x' + log.topics[1].slice(26);
      const marketIdTopic = log.topics[2];
      const outcomeTopic = log.topics[3];
      const marketId = marketIdTopic;
      const outcome = parseInt(outcomeTopic, 16);
      const amount = BigInt(log.data).toString();
      return {
        userId: userId.toLowerCase(),
        marketId: `dreamdex-${marketId}`,
        outcome,
        amount,
      };
    } catch {
      return null;
    }
  }

  async getBetsForUser(walletAddress: string, fromBlock?: number): Promise<Bet[]> {
    if (!this.provider) throw new Error('Adapter not initialized');
    const address = walletAddress.toLowerCase();
    const addressTopic = '0x' + address.slice(2).padStart(64, '0');
    const startBlock = fromBlock || (await this.getCurrentBlock()) - 50000;

    // Get mints (Transfer to user, from 0x0)
    const transferLogs = await this.provider.getLogs({
      address: this.outcomeToken,
      topics: [TOPICS.Transfer, null, null, addressTopic] as any,
      fromBlock: startBlock,
      toBlock: 'latest',
    }).catch(async () => {
      // Fallback: broader query without topic filtering for alt ABI
      return this.provider!.getLogs({
        address: this.outcomeToken,
        fromBlock: startBlock,
        toBlock: 'latest',
      });
    });

    // Get redeems
    const redeemedLogs = await this.provider.getLogs({
      address: this.binarySettlement,
      topics: [TOPICS.Redeemed, addressTopic] as any,
      fromBlock: startBlock,
      toBlock: 'latest',
    }).catch(() => [] as ethers.Log[]);

    const bets: Bet[] = [];
    for (const log of transferLogs) {
      const bet = this.parseTransferLog(log);
      if (!bet) continue;
      // Only keep mints where user is receiver (exclude burns)
      if (bet.userId !== address) continue;
      const block = await this.provider.getBlock(log.blockNumber).catch(() => null);
      bet.timestamp = block?.timestamp || Math.floor(Date.now() / 1000);
      // Filter by venueId if specified (need market registry — for MVP skip)
      bets.push(bet);
    }

    // Mark wins from Redeemed: if user redeemed, that outcome was winning
    const redeemedByMarket = new Map<string, string>();
    for (const log of redeemedLogs) {
      const r = this.parseRedeemedLog(log);
      if (!r) continue;
      redeemedByMarket.set(r.marketId, r.amount);
    }

    for (const bet of bets) {
      if (redeemedByMarket.has(bet.marketId)) {
        bet.won = true;
        bet.claimedAmount = redeemedByMarket.get(bet.marketId);
        bet.resolvedAt = Math.floor(Date.now() / 1000);
      } else {
        // If we have many redeems for same market but not this user's bet, we can't know loss without checking winningOutcome
        // For MVP, leave unresolved bets as pending; indexer will resolve via settlement contract call
        bet.won = null;
      }
    }

    return bets.sort((a, b) => b.timestamp - a.timestamp);
  }

  async backfill(fromBlock: number, toBlock: number, onBet: (bet: Bet) => Promise<void>): Promise<void> {
    if (!this.provider) throw new Error('Adapter not initialized');
    console.log(`[${this.platformName}] Backfilling blocks ${fromBlock} to ${toBlock}`);

    const redeemedMap = new Map<string, { amount: string }>();

    await this.processInChunks(
      fromBlock,
      toBlock,
      500, // 10k batch per implementation.md but we use 500 for RPC limits
      50,
      async (start, end) => {
        const logs = await this.provider!.getLogs({
          address: this.outcomeToken,
          fromBlock: start,
          toBlock: end,
          topics: [[TOPICS.Transfer, TOPICS.TransferAlt]] as any,
        }).catch(() => [] as ethers.Log[]);

        // Also fetch redeems for this chunk
        const redeems = await this.provider!.getLogs({
          address: this.binarySettlement,
          fromBlock: start,
          toBlock: end,
          topics: [TOPICS.Redeemed] as any,
        }).catch(() => [] as ethers.Log[]);

        for (const log of redeems) {
          const r = this.parseRedeemedLog(log);
          if (r) redeemedMap.set(r.marketId + r.userId, { amount: r.amount });
        }

        let blockTimestamp = Math.floor(Date.now() / 1000);
        if (logs.length > 0) {
          const block = await this.provider!.getBlock(logs[0].blockNumber).catch(() => null);
          blockTimestamp = block?.timestamp || blockTimestamp;
        }

        const batchBets: Bet[] = [];
        for (const log of logs) {
          const bet = this.parseTransferLog(log);
          if (!bet) continue;
          bet.timestamp = blockTimestamp;
          // Enrich with redeem if known
          const key = bet.marketId + bet.userId;
          if (redeemedMap.has(key)) {
            bet.won = true;
            bet.claimedAmount = redeemedMap.get(key)!.amount;
          }
          batchBets.push(bet);
          await onBet(bet);
        }

        return batchBets;
      }
    );

    console.log(`[${this.platformName}] Backfill complete`);
  }

  async susomniaribe(callback: EventCallback): Promise<void> {
    if (!this.config.wsUrl) throw new Error('WebSocket URL required');
    this.eventCallback = callback;
    this.isSusomniaribed = true;
    this.wsProvider = new ethers.WebSocketProvider(this.config.wsUrl);

    const outcomeAbi = [
      'event Transfer(address indexed caller, address indexed sender, address indexed receiver, uint256 indexed id, uint256 amount)',
      'event Redeemed(address indexed user, bytes32 indexed marketId, uint8 indexed outcome, uint256 amount)',
    ];

    const outcomeContract = new ethers.Contract(this.outcomeToken, outcomeAbi, this.wsProvider);
    const settlementContract = new ethers.Contract(this.binarySettlement, outcomeAbi, this.wsProvider);

    outcomeContract.on('Transfer', async (caller: string, sender: string, receiver: string, id: bigint, amount: bigint, event: any) => {
      if (receiver === ethers.ZeroAddress) return; // burn
      const bet = this.parseTransferLog(event.log);
      if (!bet || !this.eventCallback) return;
      const block = await this.wsProvider!.getBlock(event.log.blockNumber).catch(() => null);
      bet.timestamp = block?.timestamp || Math.floor(Date.now() / 1000);
      await this.eventCallback({ type: 'bet', bet, platform: this.platformId });
    });

    settlementContract.on('Redeemed', async (user: string, marketId: string, outcome: number, amount: bigint, event: any) => {
      if (!this.eventCallback) return;
      const marketKey = `dreamdex-${marketId}`;
      const userId = user.toLowerCase();
      // Emit resolve for all bets of this user/market — simplified
      await this.eventCallback({
        type: 'resolve',
        betId: `${marketKey}-${userId}`,
        won: true,
        claimedAmount: amount.toString(),
        platform: this.platformId,
      });
    });

    console.log(`[${this.platformName}] WebSocket susomniaription active`);
  }

  // BINARY market scoring — use base calculateScore which handles binary via VeritasScore
  calculateScore(stats: import('../types/index.js').UserStats): number {
    // For DreamDEX high-frequency 15m CLOB, keep MIN_BETS_BINARY 30 but confidence scale tuned
    return super.calculateScore(stats);
  }
}

export function createDreamDEXAdapter(rpcUrl: string, wsUrl?: string, venueId?: string): DreamDEXAdapter {
  return new DreamDEXAdapter({
    rpcUrl,
    wsUrl,
    chainId: 50312,
    venueId,
  });
}
