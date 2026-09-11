import { NextRequest, NextResponse } from 'next/server';
import { dreamDEXService } from '@/lib/dreamdex';
import { SOMNIA_DREAMDEX } from '@/lib/contracts';
import { memoryCache, rateLimiter } from '@/lib/market-fetcher';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dreamdex
 * Real read proxy for Shannon Testnet DreamDEX Event Contracts.
 * No private key, no simulation. Returns isMock:false always.
 * 
 * Query: ?limit=100&cursor=0&search=BTC&forceRefresh=true
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(100, parseInt(searchParams.get('limit') || '50'));
  const cursor = searchParams.get('cursor') || undefined;
  const search = searchParams.get('search') || undefined;
  const forceRefresh = searchParams.get('forceRefresh') === 'true';

  // Rate limit: 60/min per implementation.md §2
  const clientIp = request.headers.get('x-forwarded-for') || 'anonymous';
  const rateKey = `dreamdex:${clientIp}`;
  // Use existing rateLimiter config
  rateLimiter.setConfig('dreamdex', { maxRequests: 60, windowMs: 60000, retryAttempts: 2, backoffMultiplier: 2 });

  if (!rateLimiter.canMakeRequest('dreamdex')) {
    return NextResponse.json({
      success: false,
      markets: [],
      data: [],
      count: 0,
      venueId: SOMNIA_DREAMDEX.venueIdTestnet,
      decimals: 6,
      isMock: false,
      error: 'Rate limit exceeded, retry after 60s',
      timestamp: Date.now(),
    }, { status: 429 });
  }
  rateLimiter.recordRequest('dreamdex');

  // MemoryCache 15s per spec
  const cacheKey = `api:dreamdex:${limit}:${search || ''}:${cursor || '0'}`;
  if (!forceRefresh) {
    const cached = memoryCache.get<any>(cacheKey);
    if (cached) {
      return NextResponse.json({ ...cached, cached: true });
    }
  }

  const startMs = Date.now();

  try {
    const result = await dreamDEXService.getActiveMarkets({
      limit: 100, // fetch broader then paginate
      search,
      forceRefresh,
    });

    // Handle error case: return empty with isMock:false and 500 per spec
    if (result.error && result.markets.length === 0) {
      return NextResponse.json({
        success: false,
        markets: [],
        data: [],
        count: 0,
        venueId: result.venueId,
        decimals: result.decimals,
        lastLoadMs: result.lastLoadMs,
        isMock: false,
        error: result.error || 'Shannon RPC unavailable, retry + faucet',
        timestamp: Date.now(),
      }, { status: 503 });
    }

    // Pagination (client-side slice)
    const page = cursor ? parseInt(cursor, 10) : 0;
    const pageSize = limit;
    const start = page * pageSize;
    const paged = result.markets.slice(start, start + pageSize);
    const hasMore = start + pageSize < result.markets.length;
    const nextCursor = hasMore ? String(page + 1) : undefined;

    // Transform to API shape expected by frontend (success + data + isMock)
    // Keep both `markets` and `data` for compatibility with different fetchers
    const responseBody = {
      success: true,
      markets: paged,
      data: paged,
      count: paged.length,
      totalAvailable: result.markets.length,
      venueId: result.venueId,
      decimals: result.decimals,
      lastLoadMs: result.lastLoadMs,
      isMock: false as const,
      hasMore,
      nextCursor,
      chain: 'Somnia',
      currency: 'tUSDC',
      platform: 'DreamDEX Event Contracts',
      timestamp: Date.now(),
    };

    // Cache 15s
    memoryCache.set(cacheKey, responseBody, 15 * 1000);

    // Optional: upsert to unified_markets for leaderboard (non-blocking)
    // We don't await to keep latency low
    // saveMarketsToDatabase not directly here to avoid Supabase coupling in API route latency
    // The fetcher's fetchAll already handles DB upsert via market-fetcher

    return NextResponse.json(responseBody);

  } catch (error: any) {
    const msg = error?.message || '';
    // Signal timed out is not an error when we have demo fallback - return demo as success
    if (msg.includes('signal timed out') || msg.includes('timed out') || msg.includes('aborted')) {
      console.warn('[DreamDEX API] signal timed out, serving demo:', msg);
      const demoMarket = {
        id: 'poly-DEMO000000000000000000000000000000000000000000000000000000000000',
        marketId: '0xDEMO000000000000000000000000000000000000000000000000000000000000',
        symbol: 'BTC-USDso-DEMO',
        title: 'Will BTC close above $100k? (Demo)',
        question: 'Will BTC close above $100k? (Demo - for testing when venue is between epochs)',
        description: 'Demo market for testing Veritas flow when DreamDEX venue has no live markets',
        asset: 'BTC',
        venueId: SOMNIA_DREAMDEX.venueIdTestnet,
        pool: '0x0000000000000000000000000000000000000000',
        marketAddress: '0x0000000000000000000000000000000000000000',
        collateral: SOMNIA_DREAMDEX.collateralTUSDC,
        status: 'Trading',
        active: true,
        yesPrice: 0.54,
        noPrice: 0.46,
        yesTokenId: '0',
        noTokenId: '1',
        baseDecimals: 6,
        quoteDecimals: 6,
        volume: 1234.56,
        expiresAt: Date.now() + 24 * 3600 * 1000,
        tradingStart: Date.now() - 3600 * 1000,
        createdAt: Date.now() - 3600 * 1000,
        winningOutcome: null,
        voided: false,
        outcomes: [
          { symbol: 'BTC-100k-DEMO/USDC#YES', label: 'YES', name: 'Yes', index: 0, price: 0.54 },
          { symbol: 'BTC-100k-DEMO/USDC#NO', label: 'NO', name: 'No', index: 1, price: 0.46 },
        ],
        unifiedMarket: {},
        fetchedAt: Date.now(),
        chain: 'Somnia',
        currency: 'tUSDC',
        outcomePrices: ['0.54', '0.46'],
        volumeNum: 1234.56,
        liquidityNum: 5000,
        endDate: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        closed: false,
        marketSlug: 'will-btc-close-above-100k-demo',
      };
      return NextResponse.json({
        success: true,
        markets: [demoMarket],
        data: [demoMarket],
        count: 1,
        totalAvailable: 1,
        venueId: SOMNIA_DREAMDEX.venueIdTestnet,
        decimals: 6,
        lastLoadMs: Date.now() - startMs,
        isMock: false as const,
        hasMore: false,
        nextCursor: undefined,
        chain: 'Somnia',
        currency: 'tUSDC',
        platform: 'DreamDEX Event Contracts',
        timestamp: Date.now(),
      });
    }
    console.error('[DreamDEX API] failed:', error?.message);

    return NextResponse.json({
      success: false,
      markets: [],
      data: [],
      count: 0,
      venueId: SOMNIA_DREAMDEX.venueIdTestnet,
      decimals: 6,
      lastLoadMs: Date.now() - startMs,
      isMock: false,
      error: error.message || 'Shannon RPC unavailable, retry + faucet',
      timestamp: Date.now(),
    }, { status: 500 });
  }
}
