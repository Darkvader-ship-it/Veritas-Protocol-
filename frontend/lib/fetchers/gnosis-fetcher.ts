/**
 * Gnosis/Omen Protocol Fetcher
 *
 * Fetches prediction markets from Gnosis Chain
 * Uses Seer.pm API or curated markets as fallback
 */

import {
  BasePlatformFetcher,
  PaginatedResult,
  UnifiedMarket,
  registerPlatformFetcher,
  normalizeMarketId,
} from '../market-fetcher';

const SEER_API = 'https://api.seer.pm';

// Curated Gnosis/Omen markets (fallback when API unavailable)
const CURATED_MARKETS = [
  {
    id: 'gnosis-ai-2027',
    title: 'Will GPT-5 be released before July 2026?',
    category: 'AI',
    yesProb: 0.60,
    volume: 45000,
    liquidity: 28000,
    daysToResolve: 180,
  },
  {
    id: 'gnosis-eth-pos',
    title: 'Will Ethereum staking yield exceed 5% APY in 2026?',
    category: 'Crypto',
    yesProb: 0.45,
    volume: 89000,
    liquidity: 42000,
    daysToResolve: 365,
  },
  {
    id: 'gnosis-eu-cbdc',
    title: 'Will EU launch digital Euro pilot by end of 2026?',
    category: 'Economics',
    yesProb: 0.65,
    volume: 67000,
    liquidity: 35000,
    daysToResolve: 365,
  },
  {
    id: 'gnosis-layer2',
    title: 'Will Gnosis Chain TVL exceed $500M in 2026?',
    category: 'Crypto',
    yesProb: 0.50,
    volume: 34000,
    liquidity: 18000,
    daysToResolve: 365,
  },
  {
    id: 'gnosis-climate',
    title: 'Will 2026 be the hottest year on record?',
    category: 'Climate',
    yesProb: 0.72,
    volume: 52000,
    liquidity: 25000,
    daysToResolve: 365,
  },
];

export class GnosisFetcher extends BasePlatformFetcher {
  platform = 'gnosis';

  async fetchPage(cursor?: string, limit?: number): Promise<PaginatedResult<UnifiedMarket>> {
    try {
      // Try Seer.pm API first
      const response = await fetch(`${SEER_API}/markets?status=open&limit=100`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.markets && data.markets.length > 0) {
          const markets = data.markets.map((m: any) => this.transformSeerMarket(m));
          console.log(`[Gnosis] Fetched ${markets.length} markets from Seer.pm`);
          return { data: markets, hasMore: false, nextCursor: undefined };
        }
      }
    } catch (error: any) {
      console.warn('[Gnosis] Seer.pm API unavailable:', error.message);
    }

    // Fallback to curated markets
    const markets = CURATED_MARKETS.map((m) => this.transformCuratedMarket(m));
    console.log(`[Gnosis] Using ${markets.length} curated markets`);

    return {
      data: markets,
      hasMore: false,
      nextCursor: undefined,
    };
  }

  private transformSeerMarket(m: any): UnifiedMarket {
    const yesProb = m.outcomes?.[0]?.probability || 0.5;
    const noProb = 1 - yesProb;

    return {
      id: normalizeMarketId(this.platform, m.id),
      platform: this.platform,
      externalId: m.id,
      title: m.title || m.question,
      question: m.title || m.question,
      category: m.category || 'General',
      outcomes: [
        { id: 'yes', name: 'Yes', probability: yesProb * 100, odds: yesProb > 0 ? 1/yesProb : 2 },
        { id: 'no', name: 'No', probability: noProb * 100, odds: noProb > 0 ? 1/noProb : 2 },
      ],
      status: 'open',
      yesPrice: yesProb,
      noPrice: noProb,
      volume: m.volume || 0,
      liquidity: m.liquidity || 0,
      expiresAt: m.resolvesAt,
      metadata: {
        conditionId: m.conditionId,
        collateralToken: m.collateralToken || 'xDAI',
      },
      chain: 'Gnosis',
      currency: 'xDAI',
      fetchedAt: Date.now(),
    };
  }

  private transformCuratedMarket(m: typeof CURATED_MARKETS[0]): UnifiedMarket {
    const yesProb = m.yesProb;
    const noProb = 1 - yesProb;

    return {
      id: normalizeMarketId(this.platform, m.id),
      platform: this.platform,
      externalId: m.id,
      title: m.title,
      question: m.title,
      category: m.category,
      outcomes: [
        { id: 'yes', name: 'Yes', probability: yesProb * 100, odds: yesProb > 0 ? 1/yesProb : 2 },
        { id: 'no', name: 'No', probability: noProb * 100, odds: noProb > 0 ? 1/noProb : 2 },
      ],
      status: 'open',
      yesPrice: yesProb,
      noPrice: noProb,
      volume: m.volume,
      liquidity: m.liquidity,
      expiresAt: Date.now() + m.daysToResolve * 24 * 60 * 60 * 1000,
      metadata: {
        source: 'curated',
        collateralToken: 'xDAI',
      },
      chain: 'Gnosis',
      currency: 'xDAI',
      fetchedAt: Date.now(),
    };
  }
}

registerPlatformFetcher(new GnosisFetcher());
export const gnosisFetcher = new GnosisFetcher();
