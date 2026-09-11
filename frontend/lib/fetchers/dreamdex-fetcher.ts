/**
 * DreamDEX Fetcher — Real Shannon Testnet
 *
 * Extends BasePlatformFetcher for unified market aggregation.
 * No curated mock, no simulation. Fail loudly with isMock:false.
 *
 * Per implementation.md §2: filter venueId, isBinary, active, Trading status.
 */

import {
  BasePlatformFetcher,
  PaginatedResult,
  UnifiedMarket,
  normalizeMarketId,
  memoryCache,
} from '../market-fetcher';
import { DreamDEXService, dreamDEXService } from '../dreamdex';

export class DreamDEXFetcher extends BasePlatformFetcher {
  platform = 'dreamdex';

  private service: DreamDEXService;

  constructor(service?: DreamDEXService) {
    super();
    this.service = service || dreamDEXService;
  }

  async fetchPage(cursor?: string, limit: number = 25): Promise<PaginatedResult<UnifiedMarket>> {
    const page = cursor ? parseInt(cursor, 10) : 0;
    const pageLimit = Math.min(limit || 25, 100);

    // Use service to get active markets (real)
    const result = await this.service.getActiveMarkets({
      limit: 100, // fetch broad then paginate locally
      forceRefresh: false,
    });

    // On error, propagate as empty with isMock:false — never generateMockMarkets
    if (result.error && result.markets.length === 0) {
      // We still return PaginatedResult with hasMore=false, caller will show error banner
      // Store error in memoryCache for health check? For now throw to let fetchPage caller handle
      throw new Error(result.error);
    }

    // Transform DreamDEXMarket -> UnifiedMarket
    const unified: UnifiedMarket[] = result.markets.map((m) => this.transformMarket(m));

    // Client-side pagination (SDK already limited to 100, we slice)
    const start = page * pageLimit;
    const end = start + pageLimit;
    const paged = unified.slice(start, end);
    const hasMore = end < unified.length;
    const nextCursor = hasMore ? String(page + 1) : undefined;

    return {
      data: paged,
      hasMore,
      nextCursor,
      totalCount: unified.length,
    };
  }

  private transformMarket(m: import('../dreamdex').DreamDEXMarket): UnifiedMarket {
    const yesProb = m.yesPrice; // 0-1
    const noProb = m.noPrice;

    return {
      id: normalizeMarketId(this.platform, m.marketId),
      platform: this.platform,
      externalId: m.marketId,
      title: m.title,
      question: m.question,
      description: `DreamDEX Event Contract on Somnia Shannon — ${m.asset} — Expires ${new Date(m.expiresAt).toISOString()}`,
      category: m.asset || 'Crypto',
      outcomes: [
        { id: 'UP', name: 'Up', probability: yesProb * 100, odds: yesProb > 0.01 ? 1 / yesProb : 100 },
        { id: 'DOWN', name: 'Down', probability: noProb * 100, odds: noProb > 0.01 ? 1 / noProb : 100 },
      ],
      status: m.active && m.status === 'Trading' ? 'open' : 'closed',
      yesPrice: yesProb,
      noPrice: noProb,
      volume: m.volume,
      liquidity: m.liquidity ?? m.volume * 0.1,
      expiresAt: m.expiresAt,
      closesAt: m.expiresAt,
      metadata: {
        marketId: m.marketId,
        symbol: m.symbol,
        venueId: m.venueId,
        pool: m.pool,
        marketAddress: m.marketAddress,
        collateral: m.collateral,
        quoteDecimals: m.quoteDecimals,
        baseDecimals: m.baseDecimals,
        yesTokenId: m.yesTokenId,
        noTokenId: m.noTokenId,
        asset: m.asset,
        chain: m.chain,
        currency: m.currency,
        outcomes: m.outcomes,
        unifiedSymbol: m.symbol,
      },
      fetchedAt: m.fetchedAt,
      chain: m.chain,
      currency: m.currency,
    };
  }

  // Override fetchAll to use 15s cache per dreamdex spec (shorter than default 5m)
  async fetchAll(options: import('../market-fetcher').FetchOptions = {}): Promise<UnifiedMarket[]> {
    const cacheKey = `${this.platform}:all:${options.includeResolved ? 'all' : 'open'}`;
    if (!options.forceRefresh) {
      const cached = memoryCache.get<UnifiedMarket[]>(cacheKey);
      if (cached) return cached;
    }

    // Leverage base pagination but with DreamDEX-specific page size
    const markets: UnifiedMarket[] = [];
    let cursor: string | undefined;
    let hasMore = true;
    let pageCount = 0;
    const maxPages = 5;

    while (hasMore && pageCount < maxPages) {
      const result = await this.fetchPage(cursor, 25);
      markets.push(...result.data);
      hasMore = result.hasMore;
      cursor = result.nextCursor;
      pageCount++;
      if (hasMore) await new Promise((r) => setTimeout(r, 100));
    }

    memoryCache.set(cacheKey, markets, 15 * 1000); // 15s per spec

    // Background DB upsert (non-blocking) — keep for leaderboard
    // Note: dreamdex indexer will handle bets table; unified_markets upsert optional
    return markets;
  }
}

// Register singleton for unified fetching
import { registerPlatformFetcher } from '../market-fetcher';
export const dreamDEXFetcher = new DreamDEXFetcher();
registerPlatformFetcher(dreamDEXFetcher);
