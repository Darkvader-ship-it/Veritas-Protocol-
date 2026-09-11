/**
 * Manifold Markets Full Fetcher with Pagination
 *
 * Fetches ALL markets from Manifold Markets
 * Uses cursor-based pagination with beforeId
 */

import {
  BasePlatformFetcher,
  PaginatedResult,
  UnifiedMarket,
  registerPlatformFetcher,
  normalizeMarketId,
} from '../market-fetcher';

const MANIFOLD_API = 'https://api.manifold.markets/v0';
const PAGE_SIZE = 500; // Manifold allows up to 1000

export class ManifoldFetcher extends BasePlatformFetcher {
  platform = 'manifold';

  async fetchPage(cursor?: string, limit?: number): Promise<PaginatedResult<UnifiedMarket>> {
    const pageSize = Math.min(limit || PAGE_SIZE, 1000);
    let url = `${MANIFOLD_API}/markets?limit=${pageSize}`;

    if (cursor) {
      url += `&before=${cursor}`;
    }

    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`Manifold API error: ${response.status}`);
    }

    const rawMarkets = await response.json();

    const markets: UnifiedMarket[] = rawMarkets
      .filter((m: any) => !m.isResolved && m.outcomeType === 'BINARY')
      .map((m: any) => this.transformMarket(m));

    const hasMore = rawMarkets.length === pageSize;
    // Use the last market's ID as cursor for next page
    const nextCursor = hasMore && rawMarkets.length > 0
      ? rawMarkets[rawMarkets.length - 1].id
      : undefined;

    return {
      data: markets,
      hasMore,
      nextCursor,
    };
  }

  private transformMarket(m: any): UnifiedMarket {
    const prob = m.probability || 0.5;

    return {
      id: normalizeMarketId(this.platform, m.id),
      platform: this.platform,
      externalId: m.id,
      title: m.question,
      question: m.question,
      description: m.description?.slice(0, 500),
      category: m.groupSlugs?.[0] || 'General',
      outcomes: [
        { id: 'yes', name: 'Yes', probability: prob * 100, odds: prob > 0.01 ? 1 / prob : 100 },
        { id: 'no', name: 'No', probability: (1 - prob) * 100, odds: (1 - prob) > 0.01 ? 1 / (1 - prob) : 100 },
      ],
      status: m.isResolved ? 'resolved' : 'open',
      yesPrice: prob,
      noPrice: 1 - prob,
      volume: m.volume || 0,
      liquidity: m.totalLiquidity || 0,
      closesAt: m.closeTime,
      metadata: {
        slug: m.slug,
        creatorUsername: m.creatorUsername,
        url: m.url || `https://manifold.markets/${m.creatorUsername}/${m.slug}`,
        outcomeType: m.outcomeType,
      },
      chain: 'Off-chain',
      currency: 'Mana',
      fetchedAt: Date.now(),
    };
  }
}

registerPlatformFetcher(new ManifoldFetcher());
export const manifoldFetcher = new ManifoldFetcher();
