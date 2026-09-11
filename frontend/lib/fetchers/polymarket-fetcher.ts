/**
 * Polymarket Full Fetcher with Pagination
 *
 * Fetches ALL markets from Polymarket, not just top 100
 */

import {
  BasePlatformFetcher,
  PaginatedResult,
  UnifiedMarket,
  registerPlatformFetcher,
  normalizeMarketId,
} from '../market-fetcher';

const POLYMARKET_API = 'https://gamma-api.polymarket.com';
const PAGE_SIZE = 100; // Polymarket max per request

export class PolymarketFetcher extends BasePlatformFetcher {
  platform = 'polymarket';

  async fetchPage(cursor?: string, limit?: number): Promise<PaginatedResult<UnifiedMarket>> {
    const pageSize = Math.min(limit || PAGE_SIZE, PAGE_SIZE);
    const offset = cursor ? parseInt(cursor) : 0;

    const url = `${POLYMARKET_API}/markets?active=true&closed=false&limit=${pageSize}&offset=${offset}&order=volume&ascending=false`;

    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`Polymarket API error: ${response.status}`);
    }

    const rawMarkets = await response.json();

    const markets: UnifiedMarket[] = rawMarkets
      .filter((m: any) => m.active && !m.closed && m.question)
      .map((m: any) => this.transformMarket(m));

    const hasMore = rawMarkets.length === pageSize;
    const nextCursor = hasMore ? String(offset + pageSize) : undefined;

    return {
      data: markets,
      hasMore,
      nextCursor,
    };
  }

  private transformMarket(m: any): UnifiedMarket {
    const prices = JSON.parse(m.outcomePrices || '["0.5","0.5"]');
    const outcomes = JSON.parse(m.outcomes || '["Yes","No"]');
    const yesPrice = parseFloat(prices[0]) || 0.5;
    const noPrice = parseFloat(prices[1]) || 0.5;

    return {
      id: normalizeMarketId(this.platform, m.id || m.conditionId),
      platform: this.platform,
      externalId: m.id || m.conditionId,
      title: m.question,
      question: m.question,
      description: m.description?.slice(0, 500),
      category: m.events?.[0]?.category || 'General',
      outcomes: outcomes.map((name: string, i: number) => ({
        id: name.toLowerCase(),
        name,
        probability: parseFloat(prices[i]) || 0.5,
        odds: parseFloat(prices[i]) > 0.01 ? 1 / parseFloat(prices[i]) : 100,
      })),
      status: m.closed ? 'closed' : 'open',
      yesPrice,
      noPrice,
      volume: m.volumeNum || 0,
      volume24h: m.volume24hr || 0,
      liquidity: m.liquidityNum || 0,
      expiresAt: m.endDate ? new Date(m.endDate).getTime() : undefined,
      metadata: {
        conditionId: m.conditionId,
        slug: m.slug,
        image: m.image,
        clobTokenIds: m.clobTokenIds,
      },
      chain: 'Polygon',
      currency: 'USDC',
      fetchedAt: Date.now(),
    };
  }
}

// Register the fetcher
registerPlatformFetcher(new PolymarketFetcher());

export const polymarketFetcher = new PolymarketFetcher();
