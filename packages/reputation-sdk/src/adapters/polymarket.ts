import { ethers } from 'ethers';
import { BaseAdapter } from '../core/BaseAdapter.js';
import type { Bet, AdapterConfig, EventCallback } from '../types/index.js';

/**
 * Polymarket Adapter
 *
 * Indexes prediction market data from Polymarket on Polygon.
 * Polymarket uses a CLOB (Central Limit Order Book) system with ERC-1155 outcome tokens.
 *
 * Key Contracts on Polygon:
 * - CTF Exchange: 0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E
 * - Conditional Tokens: 0x4D97DCd97eC945f40cF65F87097ACe5EA0476045
 *
 * Polymarket also has a public API for market data.
 */

const POLYMARKET_CTF_EXCHANGE = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E';
const POLYMARKET_CONDITIONAL_TOKENS = '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045';
const POLYMARKET_API = 'https://clob.polymarket.com';
const POLYMARKET_GAMMA_API = 'https://gamma-api.polymarket.com';

// Event topic hashes for CTF Exchange
const TOPICS = {
  // OrderFilled(bytes32 orderHash, address maker, address taker, uint256 makerAssetId, uint256 takerAssetId, uint256 makerAmountFilled, uint256 takerAmountFilled)
  OrderFilled: ethers.id(
    'OrderFilled(bytes32,address,address,uint256,uint256,uint256,uint256)'
  ),
  // Transfer of conditional tokens
  TransferSingle: ethers.id(
    'TransferSingle(address,address,address,uint256,uint256)'
  ),
};

export interface PolymarketConfig extends AdapterConfig {
  apiKey?: string;
}

export class PolymarketAdapter extends BaseAdapter {
  readonly platformId = 'polymarket';
  readonly platformName = 'Polymarket';
  readonly chainId = 137; // Polygon Mainnet
  readonly nativeToken = 'MATIC';

  private apiKey?: string;

  constructor(config: PolymarketConfig) {
    super({
      ...config,
      chainId: 137,
    });
    this.apiKey = config.apiKey;
  }

  /**
   * Fetch user positions from Polymarket API
   */
  private async fetchUserPositions(walletAddress: string): Promise<any[]> {
    try {
      const response = await fetch(
        `${POLYMARKET_GAMMA_API}/users/${walletAddress}/positions`,
        {
          headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {},
        }
      );

      if (!response.ok) {
        console.warn(`[${this.platformName}] API returned ${response.status}`);
        return [];
      }

      return (await response.json()) as any[];
    } catch (error) {
      console.error(`[${this.platformName}] API error:`, error);
      return [];
    }
  }

  /**
   * Fetch user trade history from Polymarket API
   */
  private async fetchUserTrades(walletAddress: string): Promise<any[]> {
    try {
      const response = await fetch(
        `${POLYMARKET_GAMMA_API}/users/${walletAddress}/trades`,
        {
          headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {},
        }
      );

      if (!response.ok) {
        console.warn(`[${this.platformName}] API returned ${response.status}`);
        return [];
      }

      return (await response.json()) as any[];
    } catch (error) {
      console.error(`[${this.platformName}] API error:`, error);
      return [];
    }
  }

  /**
   * Fetch market details
   */
  private async fetchMarket(conditionId: string): Promise<any | null> {
    try {
      const response = await fetch(
        `${POLYMARKET_GAMMA_API}/markets/${conditionId}`,
        {
          headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {},
        }
      );

      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }

  async getBetsForUser(walletAddress: string, fromBlock?: number): Promise<Bet[]> {
    const address = walletAddress.toLowerCase();
    const bets: Bet[] = [];

    // Try API first (more reliable and faster)
    const trades = await this.fetchUserTrades(address);

    for (const trade of trades) {
      const bet: Bet = {
        id: trade.id || `${trade.transactionHash}-${trade.tradeIndex}`,
        userId: address,
        marketId: trade.conditionId || trade.marketId,
        position: trade.outcome === 'Yes' || trade.side === 'buy' ? 'yes' : 'no',
        amount: (BigInt(Math.floor((trade.size || 0) * 1e6)) * BigInt(1e12)).toString(), // USDC has 6 decimals
        timestamp: new Date(trade.timestamp || trade.createdAt).getTime() / 1000,
        txHash: trade.transactionHash,
        won: trade.resolved ? trade.outcome === trade.winningOutcome : null,
      };

      if (trade.payout) {
        bet.claimedAmount = (
          BigInt(Math.floor(trade.payout * 1e6)) * BigInt(1e12)
        ).toString();
      }

      bets.push(bet);
    }

    // Fallback: If API fails, try on-chain data
    if (bets.length === 0 && this.provider) {
      console.log(`[${this.platformName}] API returned no trades, trying on-chain...`);
      const onChainBets = await this.getOnChainBets(address, fromBlock);
      bets.push(...onChainBets);
    }

    return bets.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Fallback: Get bets from on-chain events
   */
  private async getOnChainBets(walletAddress: string, fromBlock?: number): Promise<Bet[]> {
    if (!this.provider) return [];

    const bets: Bet[] = [];
    const address = walletAddress.toLowerCase();
    const startBlock = fromBlock || (await this.getCurrentBlock()) - 1000000; // ~5 days on Polygon

    try {
      // Get Transfer events where user received tokens (bought position)
      const addressPadded = '0x' + address.slice(2).padStart(64, '0');

      const transferLogs = await this.provider.getLogs({
        address: POLYMARKET_CONDITIONAL_TOKENS,
        topics: [
          TOPICS.TransferSingle,
          null, // operator
          null, // from
          addressPadded, // to (user received tokens)
        ],
        fromBlock: startBlock,
        toBlock: 'latest',
      });

      for (const log of transferLogs) {
        // Parse ERC-1155 TransferSingle event
        const tokenId = BigInt('0x' + log.data.slice(2, 66));
        const amount = BigInt('0x' + log.data.slice(66, 130));

        const bet: Bet = {
          id: `${log.transactionHash}-${log.index}`,
          userId: address,
          marketId: tokenId.toString(),
          position: 'yes', // Can't determine from transfer alone
          amount: amount.toString(),
          timestamp: 0,
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
          won: null,
        };

        const block = await this.provider.getBlock(log.blockNumber);
        bet.timestamp = block?.timestamp || Math.floor(Date.now() / 1000);

        bets.push(bet);
      }
    } catch (error) {
      console.error(`[${this.platformName}] On-chain query error:`, error);
    }

    return bets;
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
    console.log(`[${this.platformName}] Note: Polymarket uses CLOB, on-chain data is limited`);

    const processedUsers = new Set<string>();

    // Process in chunks
    await this.processInChunks(
      fromBlock,
      toBlock,
      2000, // Larger chunks for Polygon (faster blocks)
      100, // delay ms
      async (start, end) => {
        const logs = await this.provider!.getLogs({
          address: POLYMARKET_CONDITIONAL_TOKENS,
          fromBlock: start,
          toBlock: end,
          topics: [TOPICS.TransferSingle],
        });

        for (const log of logs) {
          // Get receiver address
          const to = '0x' + log.topics[3].slice(26);

          // Track unique users
          if (!processedUsers.has(to)) {
            processedUsers.add(to);
          }

          const tokenId = BigInt('0x' + log.data.slice(2, 66));
          const amount = BigInt('0x' + log.data.slice(66, 130));

          const block = await this.provider!.getBlock(log.blockNumber);

          const bet: Bet = {
            id: `${log.transactionHash}-${log.index}`,
            userId: to.toLowerCase(),
            marketId: tokenId.toString(),
            position: 'yes',
            amount: amount.toString(),
            timestamp: block?.timestamp || Math.floor(Date.now() / 1000),
            txHash: log.transactionHash,
            blockNumber: log.blockNumber,
            won: null,
          };

          await onBet(bet);
        }

        return logs;
      }
    );

    console.log(`[${this.platformName}] Backfill complete`);
    console.log(`[${this.platformName}] Unique users found: ${processedUsers.size}`);
  }

  /**
   * Calculate score with Polymarket-specific adjustments
   */
  calculateScore(stats: import('../types/index.js').UserStats): number {
    const { wins, totalBets, winRate, volume } = stats;

    // Base points from wins
    const winPoints = wins * 100;

    // Win rate bonus (Polymarket markets are binary, so accuracy matters more)
    const winRateBonus = winRate > 50 ? (winRate - 50) * 15 : 0;

    // Volume bonus in USDC (cap at 1000 for whale protection)
    const volumeUSDC = Number(volume) / 1e18;
    const volumeBonus = Math.min(1000, Math.floor(volumeUSDC * 0.1));

    // Participation bonus
    const participationBonus = totalBets >= 100 ? 300 : totalBets >= 50 ? 200 : totalBets >= 20 ? 100 : 0;

    return Math.floor(winPoints + winRateBonus + volumeBonus + participationBonus);
  }

  async susomniaribe(callback: EventCallback): Promise<void> {
    if (!this.config.wsUrl) {
      throw new Error('WebSocket URL required for susomniariptions');
    }

    this.eventCallback = callback;
    this.isSusomniaribed = true;

    this.wsProvider = new ethers.WebSocketProvider(this.config.wsUrl);

    // Susomniaribe to TransferSingle events
    const conditionalTokens = new ethers.Contract(
      POLYMARKET_CONDITIONAL_TOKENS,
      [
        'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)',
      ],
      this.wsProvider
    );

    conditionalTokens.on('TransferSingle', async (operator, from, to, id, value, event) => {
      // Only process if tokens are being minted (from = 0x0) or bought
      if (from === ethers.ZeroAddress) {
        const block = await this.wsProvider!.getBlock(event.log.blockNumber);

        const bet: Bet = {
          id: `${event.log.transactionHash}-${event.log.index}`,
          userId: to.toLowerCase(),
          marketId: id.toString(),
          position: 'yes',
          amount: value.toString(),
          timestamp: block?.timestamp || Math.floor(Date.now() / 1000),
          txHash: event.log.transactionHash,
          blockNumber: event.log.blockNumber,
          won: null,
        };

        if (this.eventCallback) {
          await this.eventCallback({
            type: 'bet',
            bet,
            platform: this.platformId,
          });
        }
      }
    });

    console.log(`[${this.platformName}] WebSocket susomniaription active`);
  }
}

// Factory function
export function createPolymarketAdapter(
  rpcUrl: string,
  wsUrl?: string,
  apiKey?: string
): PolymarketAdapter {
  return new PolymarketAdapter({
    rpcUrl,
    wsUrl,
    chainId: 137,
    apiKey,
  });
}
