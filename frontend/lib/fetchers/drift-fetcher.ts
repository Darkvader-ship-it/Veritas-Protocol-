/**
 * Drift Protocol Fetcher
 *
 * Generates prediction-style markets from Drift perpetual prices on Solana
 * Uses the DLOB API for live oracle prices
 */

import {
  BasePlatformFetcher,
  PaginatedResult,
  UnifiedMarket,
  registerPlatformFetcher,
  normalizeMarketId,
} from '../market-fetcher';

const DRIFT_DLOB_API = 'https://dlob.drift.trade';

// Prediction market configurations based on Drift perpetuals
const PREDICTION_CONFIGS = [
  { symbol: 'BTC-PERP', title: 'Bitcoin above $100,000', target: 100000, range: 20000 },
  { symbol: 'ETH-PERP', title: 'Ethereum above $4,000', target: 4000, range: 1000 },
  { symbol: 'SOL-PERP', title: 'Solana above $150', target: 150, range: 50 },
  { symbol: 'JUP-PERP', title: 'Jupiter above $2', target: 2, range: 1 },
];

export class DriftFetcher extends BasePlatformFetcher {
  platform = 'drift';

  async fetchPage(cursor?: string, limit?: number): Promise<PaginatedResult<UnifiedMarket>> {
    try {
      const markets: UnifiedMarket[] = [];

      for (const config of PREDICTION_CONFIGS) {
        try {
          // Fetch live oracle price from Drift DLOB
          const response = await fetch(
            `${DRIFT_DLOB_API}/l2?marketName=${config.symbol}&marketType=perp&depth=1`,
            { signal: AbortSignal.timeout(5000) }
          );

          if (!response.ok) continue;

          const data = await response.json();
          const oraclePrice = data.oracle ? Number(data.oracle) : null;

          if (oraclePrice) {
            // Convert price to probability based on distance from target
            const prob = Math.min(Math.max((oraclePrice - (config.target - config.range)) / (config.range * 2), 0.05), 0.95);

            markets.push(this.createMarket(config, oraclePrice, prob));
          }
        } catch (e) {
          // Skip this market if fetch fails
        }
      }

      console.log(`[Drift] Fetched ${markets.length} prediction markets`);

      return {
        data: markets,
        hasMore: false,
        nextCursor: undefined,
      };
    } catch (error: any) {
      console.error('[Drift] Fetch error:', error.message);
      return { data: [], hasMore: false };
    }
  }

  private createMarket(config: typeof PREDICTION_CONFIGS[0], oraclePrice: number, probability: number): UnifiedMarket {
    const yesProb = probability * 100;
    const noProb = 100 - yesProb;

    return {
      id: normalizeMarketId(this.platform, config.symbol),
      platform: this.platform,
      externalId: config.symbol,
      title: config.title,
      question: `Will ${config.title.toLowerCase()}?`,
      category: 'Crypto',
      outcomes: [
        { id: 'yes', name: 'Yes', probability: yesProb, odds: yesProb > 0 ? 100/yesProb : 2 },
        { id: 'no', name: 'No', probability: noProb, odds: noProb > 0 ? 100/noProb : 2 },
      ],
      status: 'open',
      yesPrice: probability,
      noPrice: 1 - probability,
      volume: 0,
      liquidity: 0,
      metadata: {
        symbol: config.symbol,
        oraclePrice,
        target: config.target,
        source: 'drift-dlob',
      },
      chain: 'Solana',
      currency: 'USDC',
      fetchedAt: Date.now(),
    };
  }
}

registerPlatformFetcher(new DriftFetcher());
export const driftFetcher = new DriftFetcher();
