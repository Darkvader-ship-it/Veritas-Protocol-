/**
 * Kalshi Fetcher with Pagination
 *
 * Fetches markets from Kalshi (CFTC-regulated prediction exchange)
 * Uses cursor-based pagination
 */

import {
  BasePlatformFetcher,
  PaginatedResult,
  UnifiedMarket,
  registerPlatformFetcher,
  normalizeMarketId,
} from '../market-fetcher';

const KALSHI_API = 'https://api.elections.kalshi.com/trade-api/v2';
const PAGE_SIZE = 100;

export class KalshiFetcher extends BasePlatformFetcher {
  platform = 'kalshi';

  async fetchPage(cursor?: string, limit?: number): Promise<PaginatedResult<UnifiedMarket>> {
    const pageSize = Math.min(limit || PAGE_SIZE, 200);

    let url = `${KALSHI_API}/markets?status=open&limit=${pageSize}`;
    if (cursor) {
      url += `&cursor=${cursor}`;
    }

    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`Kalshi API error: ${response.status}`);
    }

    const result = await response.json();
    const rawMarkets = result.markets || [];
    const nextCursor = result.cursor;

    // API already filters by status=open, no need to filter again
    const markets: UnifiedMarket[] = rawMarkets
      .map((m: any) => this.transformMarket(m));

    return {
      data: markets,
      hasMore: !!nextCursor,
      nextCursor,
    };
  }

  private transformMarket(m: any): UnifiedMarket {
    const yesAsk = m.yes_ask || 50;
    const yesBid = m.yes_bid || 50;
    const yesPrice = Math.max(0.01, Math.min(0.99, ((yesAsk + yesBid) / 2) / 100));
    const noPrice = 1 - yesPrice;

    return {
      id: normalizeMarketId(this.platform, m.ticker),
      platform: this.platform,
      externalId: m.ticker,
      title: m.title || m.subtitle,
      question: m.title,
      description: m.rules_primary?.slice(0, 500),
      category: m.category || 'Events',
      outcomes: [
        { id: 'yes', name: 'Yes', probability: yesPrice * 100, odds: 1 / yesPrice },
        { id: 'no', name: 'No', probability: noPrice * 100, odds: 1 / noPrice },
      ],
      status: m.status === 'open' ? 'open' : 'closed',
      yesPrice,
      noPrice,
      volume: m.volume || 0,
      volume24h: m.volume_24h || 0,
      liquidity: m.open_interest || 0,
      closesAt: m.close_time ? new Date(m.close_time).getTime() : undefined,
      metadata: {
        eventTicker: m.event_ticker,
        ticker: m.ticker,
        subtitle: m.subtitle,
      },
      chain: 'Off-chain',
      currency: 'USD',
      fetchedAt: Date.now(),
    };
  }
}

registerPlatformFetcher(new KalshiFetcher());
export const kalshiFetcher = new KalshiFetcher();
