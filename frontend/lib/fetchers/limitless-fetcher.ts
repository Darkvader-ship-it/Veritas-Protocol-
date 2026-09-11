/**
 * Limitless Fetcher with Pagination
 *
 * Fetches markets from Limitless Exchange
 * Uses page-based pagination (page=1, page=2, etc.)
 */

import {
  BasePlatformFetcher,
  PaginatedResult,
  UnifiedMarket,
  registerPlatformFetcher,
  normalizeMarketId,
} from '../market-fetcher';

const LIMITLESS_API = 'https://api.limitless.exchange';
const PAGE_SIZE = 25; // Limitless API max per page

export class LimitlessFetcher extends BasePlatformFetcher {
  platform = 'limitless';

  async fetchPage(cursor?: string, limit?: number): Promise<PaginatedResult<UnifiedMarket>> {
    const pageSize = Math.min(limit || PAGE_SIZE, PAGE_SIZE);
    const pageNum = cursor ? parseInt(cursor) : 1;

    const url = `${LIMITLESS_API}/markets/active?limit=${pageSize}&page=${pageNum}`;

    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`Limitless API error: ${response.status}`);
    }

    const result = await response.json();
    const rawMarkets = result.data || [];
    const totalCount = result.totalMarketsCount || 0;

    const markets: UnifiedMarket[] = rawMarkets
      .filter((m: any) => !m.expired && m.status === 'FUNDED')
      .map((m: any) => this.transformMarket(m));

    // Calculate if there are more pages
    const totalFetched = (pageNum - 1) * pageSize + rawMarkets.length;
    const hasMore = totalFetched < totalCount && rawMarkets.length === pageSize;
    const nextCursor = hasMore ? String(pageNum + 1) : undefined;

    return {
      data: markets,
      hasMore,
      nextCursor,
      totalCount,
    };
  }

  private transformMarket(m: any): UnifiedMarket {
    const rawYes = m.prices?.[0] || 0.5;
    const rawNo = m.prices?.[1] || 0.5;
    // Normalize: if value > 1 it's already a percentage
    const yesPercent = rawYes > 1 ? rawYes : rawYes * 100;
    const noPercent = rawNo > 1 ? rawNo : rawNo * 100;
    const yesPrice = rawYes > 1 ? rawYes / 100 : rawYes;
    const noPrice = rawNo > 1 ? rawNo / 100 : rawNo;
    const volume = parseFloat(m.volumeFormatted || '0');

    const expiresAtMs = m.expirationTimestamp ||
      (m.expirationDate ? new Date(m.expirationDate).getTime() : undefined);

    return {
      id: normalizeMarketId(this.platform, String(m.id)),
      platform: this.platform,
      externalId: String(m.id),
      title: m.title,
      question: m.title,
      description: m.description?.slice(0, 500),
      category: m.categories?.[0] || 'General',
      outcomes: [
        { id: 'yes', name: 'Yes', probability: yesPercent, odds: yesPrice > 0.01 ? 1 / yesPrice : 100 },
        { id: 'no', name: 'No', probability: noPercent, odds: noPrice > 0.01 ? 1 / noPrice : 100 },
      ],
      status: 'open',
      yesPrice,
      noPrice,
      volume,
      liquidity: volume * 0.1, // Estimate
      expiresAt: expiresAtMs,
      metadata: {
        conditionId: m.conditionId,
        slug: m.slug,
        tags: m.tags,
        expirationDate: m.expirationDate,
      },
      chain: 'Base',
      currency: 'USDC',
      fetchedAt: Date.now(),
    };
  }
}

// Register the fetcher
registerPlatformFetcher(new LimitlessFetcher());

export const limitlessFetcher = new LimitlessFetcher();
