import { NextRequest, NextResponse } from 'next/server';

const POLYMARKET_API = 'https://gamma-api.polymarket.com';

export const dynamic = 'force-dynamic';

// In-memory cache for all markets (refreshed every 30 seconds - reduced from 5 minutes)
let marketCache: any[] = [];
let cacheTimestamp = 0;
let lastFetchError: string | null = null;
const CACHE_DURATION = 30 * 1000; // 30 seconds (reduced from 5 minutes)
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// Helper function to delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Fetch with retry logic
async function fetchWithRetry(url: string, retries = MAX_RETRIES): Promise<Response | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000) // 10 second timeout per request
      });
      if (res.ok) return res;

      console.warn(`[Polymarket] Attempt ${attempt}/${retries} failed with status ${res.status}`);
      if (attempt < retries) await delay(RETRY_DELAY * attempt);
    } catch (err) {
      console.warn(`[Polymarket] Attempt ${attempt}/${retries} error:`, err);
      if (attempt < retries) await delay(RETRY_DELAY * attempt);
    }
  }
  return null;
}

async function fetchAllMarkets(): Promise<{ markets: any[], error: string | null }> {
  // Return cached if fresh AND we have markets
  if (marketCache.length > 0 && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return { markets: marketCache, error: null };
  }

  console.log('[Polymarket] Fetching all markets...');
  const allMarkets: any[] = [];
  let offset = 0;
  const batchSize = 500;
  let fetchError: string | null = null;
  let consecutiveFailures = 0;

  while (offset < 10000) { // Safety limit
    const res = await fetchWithRetry(
      `${POLYMARKET_API}/events?closed=false&limit=${batchSize}&offset=${offset}`
    );

    if (!res) {
      consecutiveFailures++;
      // If we have some markets and hit 2 consecutive failures, stop but keep what we have
      if (allMarkets.length > 0 && consecutiveFailures >= 2) {
        console.warn(`[Polymarket] Stopping fetch after ${consecutiveFailures} consecutive failures, keeping ${allMarkets.length} markets`);
        break;
      }
      // If we have no markets at all after failures, record the error
      if (allMarkets.length === 0) {
        fetchError = `Failed to fetch from Polymarket API after ${MAX_RETRIES} retries`;
      }
      offset += batchSize; // Skip this batch and try next
      continue;
    }

    consecutiveFailures = 0; // Reset on success

    try {
      const events = await res.json();
      if (!events || events.length === 0) break;

      for (const event of events) {
        if (event.markets && Array.isArray(event.markets)) {
          for (const market of event.markets) {
            if (market.closed || !market.active) continue;

            // Parse prices
            let prices = [0.5, 0.5];
            try {
              if (typeof market.outcomePrices === 'string') {
                prices = JSON.parse(market.outcomePrices).map((p: string) => parseFloat(p));
              }
            } catch (e) {}

            allMarkets.push({
              id: market.conditionId || market.id,
              question: market.question,
              eventTitle: event.title,
              eventSlug: event.slug,
              outcomes: ['Yes', 'No'],
              prices,
              volume: market.volumeNum || 0,
              volume24hr: market.volume24hr || event.volume24hr || 0,
              liquidity: market.liquidityNum || 0,
              endDate: market.endDateIso || market.endDate,
              image: market.image || event.image,
              slug: market.slug,
              description: market.description,
            });
          }
        }
      }

      offset += batchSize;

      // If we got less than batch size, we're done
      if (events.length < batchSize) break;
    } catch (err) {
      console.error('[Polymarket] Parse error at offset', offset, err);
      consecutiveFailures++;
      offset += batchSize;
    }
  }

  // Sort by 24h volume
  allMarkets.sort((a, b) => (b.volume24hr || 0) - (a.volume24hr || 0));

  // Only update cache if we got markets (don't cache empty results from errors)
  if (allMarkets.length > 0) {
    marketCache = allMarkets;
    cacheTimestamp = Date.now();
    lastFetchError = null;
    console.log(`[Polymarket] Cached ${allMarkets.length} markets`);
  } else if (fetchError) {
    lastFetchError = fetchError;
    console.error(`[Polymarket] No markets fetched: ${fetchError}`);
  }

  return { markets: allMarkets, error: fetchError };
}

/**
 * GET /api/polymarket/search
 * Search all Polymarket events and markets (34,000+)
 *
 * Query params:
 * - q: Search query
 * - limit: Max results (default 50)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.toLowerCase() || '';
  const limit = parseInt(searchParams.get('limit') || '50');

  try {
    // Get all markets (cached)
    const { markets: allMarkets, error: fetchError } = await fetchAllMarkets();

    // If we have no markets and there was an error, return 503
    if (allMarkets.length === 0 && (fetchError || lastFetchError)) {
      return NextResponse.json({
        success: false,
        query,
        total: 0,
        cached: 0,
        markets: [],
        error: fetchError || lastFetchError || 'Failed to fetch markets from Polymarket API',
      }, { status: 503 });
    }

    // Filter by search query
    let results = allMarkets;
    if (query) {
      results = allMarkets.filter(market =>
        market.question?.toLowerCase().includes(query) ||
        market.eventTitle?.toLowerCase().includes(query) ||
        market.description?.toLowerCase().includes(query)
      );
    }

    return NextResponse.json({
      success: true,
      query,
      total: results.length,
      cached: marketCache.length,
      markets: results.slice(0, limit),
    });
  } catch (error: any) {
    console.error('Polymarket search error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Search failed',
        markets: [],
      },
      { status: 500 }
    );
  }
}
