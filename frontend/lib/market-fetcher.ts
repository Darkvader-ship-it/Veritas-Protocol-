/**
 * Unified Market Fetcher System
 *
 * Provides:
 * - Paginated fetching for all platforms
 * - Aggressive caching (memory + database)
 * - Rate limit handling with exponential backoff
 * - Database storage for fast access
 */

import { createClient } from '@supabase/supabase-js';

// Supabase client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// ============================================
// TYPES
// ============================================

export interface UnifiedMarket {
  id: string;
  platform: string;
  externalId: string;
  title: string;
  question?: string;
  description?: string;
  category: string;
  outcomes: MarketOutcome[];
  status: 'open' | 'closed' | 'resolved' | 'cancelled';
  yesPrice?: number;
  noPrice?: number;
  volume: number;
  volume24h?: number;
  liquidity?: number;
  expiresAt?: number;
  closesAt?: number;
  resolvedAt?: number;
  winningOutcome?: string;
  metadata?: Record<string, any>;
  fetchedAt: number;
  chain?: string;
  currency?: string;
}

export interface MarketOutcome {
  id: string;
  name: string;
  probability: number;
  odds: number;
}

export interface FetchOptions {
  forceRefresh?: boolean;
  includeResolved?: boolean;
  limit?: number;
  cursor?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  nextCursor?: string;
  hasMore: boolean;
  totalCount?: number;
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  retryAttempts: number;
  backoffMultiplier: number;
}

// ============================================
// IN-MEMORY CACHE
// ============================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly defaultTTL = 60 * 1000; // 1 minute default

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Clear expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

export const memoryCache = new MemoryCache();

// ============================================
// RATE LIMITER WITH RETRY
// ============================================

interface RateLimitState {
  requests: number[];
  blocked: boolean;
  blockedUntil: number;
}

class RateLimiter {
  private limits = new Map<string, RateLimitState>();
  private configs = new Map<string, RateLimitConfig>();

  setConfig(platform: string, config: RateLimitConfig): void {
    this.configs.set(platform, config);
  }

  private getState(platform: string): RateLimitState {
    if (!this.limits.has(platform)) {
      this.limits.set(platform, { requests: [], blocked: false, blockedUntil: 0 });
    }
    return this.limits.get(platform)!;
  }

  private getConfig(platform: string): RateLimitConfig {
    return this.configs.get(platform) || {
      maxRequests: 10,
      windowMs: 60000,
      retryAttempts: 3,
      backoffMultiplier: 2,
    };
  }

  canMakeRequest(platform: string): boolean {
    const state = this.getState(platform);
    const config = this.getConfig(platform);
    const now = Date.now();

    // Check if blocked
    if (state.blocked && now < state.blockedUntil) {
      return false;
    }
    state.blocked = false;

    // Clean old requests
    state.requests = state.requests.filter(t => now - t < config.windowMs);

    return state.requests.length < config.maxRequests;
  }

  recordRequest(platform: string): void {
    const state = this.getState(platform);
    state.requests.push(Date.now());
  }

  recordRateLimit(platform: string, retryAfterMs?: number): void {
    const state = this.getState(platform);
    const config = this.getConfig(platform);

    state.blocked = true;
    state.blockedUntil = Date.now() + (retryAfterMs || config.windowMs);
  }

  async waitForSlot(platform: string): Promise<void> {
    const state = this.getState(platform);
    const config = this.getConfig(platform);

    while (!this.canMakeRequest(platform)) {
      const waitTime = state.blocked
        ? Math.max(0, state.blockedUntil - Date.now())
        : 1000;
      await sleep(Math.min(waitTime, 5000));
    }
  }

  async executeWithRetry<T>(
    platform: string,
    fn: () => Promise<T>,
    attempt: number = 1
  ): Promise<T> {
    const config = this.getConfig(platform);

    await this.waitForSlot(platform);
    this.recordRequest(platform);

    try {
      return await fn();
    } catch (error: any) {
      const isRateLimit = error.status === 429 || error.message?.includes('rate limit');

      if (isRateLimit) {
        const retryAfter = parseInt(error.headers?.get?.('retry-after') || '60') * 1000;
        this.recordRateLimit(platform, retryAfter);
      }

      if (attempt < config.retryAttempts) {
        const backoffMs = Math.pow(config.backoffMultiplier, attempt) * 1000;
        console.log(`[${platform}] Retry ${attempt}/${config.retryAttempts} after ${backoffMs}ms`);
        await sleep(backoffMs);
        return this.executeWithRetry(platform, fn, attempt + 1);
      }

      throw error;
    }
  }
}

export const rateLimiter = new RateLimiter();

// Configure rate limits for each platform
rateLimiter.setConfig('polymarket', { maxRequests: 30, windowMs: 60000, retryAttempts: 3, backoffMultiplier: 2 });
rateLimiter.setConfig('limitless', { maxRequests: 20, windowMs: 60000, retryAttempts: 3, backoffMultiplier: 2 });
rateLimiter.setConfig('manifold', { maxRequests: 100, windowMs: 60000, retryAttempts: 3, backoffMultiplier: 2 });
rateLimiter.setConfig('kalshi', { maxRequests: 10, windowMs: 60000, retryAttempts: 3, backoffMultiplier: 2 });
rateLimiter.setConfig('azuro', { maxRequests: 30, windowMs: 60000, retryAttempts: 3, backoffMultiplier: 2 });
rateLimiter.setConfig('sxbet', { maxRequests: 30, windowMs: 60000, retryAttempts: 3, backoffMultiplier: 2 });
rateLimiter.setConfig('overtime', { maxRequests: 5, windowMs: 60000, retryAttempts: 2, backoffMultiplier: 3 }); // The Odds API is limited
rateLimiter.setConfig('gnosis', { maxRequests: 30, windowMs: 60000, retryAttempts: 3, backoffMultiplier: 2 });
rateLimiter.setConfig('drift', { maxRequests: 30, windowMs: 60000, retryAttempts: 3, backoffMultiplier: 2 });
rateLimiter.setConfig('metaculus', { maxRequests: 30, windowMs: 60000, retryAttempts: 3, backoffMultiplier: 2 });

// ============================================
// DATABASE STORAGE
// ============================================

export async function saveMarketsToDatabase(markets: UnifiedMarket[]): Promise<void> {
  if (markets.length === 0) return;

  const rows = markets.map(m => ({
    id: m.id,
    platform: m.platform,
    external_id: m.externalId,
    title: m.title,
    question: m.question,
    description: m.description,
    category: m.category,
    outcomes: m.outcomes,
    status: m.status,
    yes_price: m.yesPrice,
    no_price: m.noPrice,
    volume: m.volume,
    volume_24h: m.volume24h,
    liquidity: m.liquidity,
    expires_at: m.expiresAt ? new Date(m.expiresAt).toISOString() : null,
    closes_at: m.closesAt ? new Date(m.closesAt).toISOString() : null,
    resolved_at: m.resolvedAt ? new Date(m.resolvedAt).toISOString() : null,
    winning_outcome: m.winningOutcome,
    metadata: m.metadata,
    chain: m.chain,
    currency: m.currency,
    fetched_at: new Date(m.fetchedAt).toISOString(),
    updated_at: new Date().toISOString(),
  }));

  // Upsert in batches of 100
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const { error } = await supabase
      .from('unified_markets')
      .upsert(batch, { onConflict: 'id' });

    if (error) {
      console.error('Error saving markets to database:', error);
    }
  }
}

export async function getMarketsFromDatabase(
  platform?: string,
  options: { limit?: number; status?: string; category?: string } = {}
): Promise<UnifiedMarket[]> {
  let query = supabase
    .from('unified_markets')
    .select('*')
    .order('volume', { ascending: false });

  if (platform) {
    query = query.eq('platform', platform);
  }
  if (options.status) {
    query = query.eq('status', options.status);
  }
  if (options.category) {
    query = query.eq('category', options.category);
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching markets from database:', error);
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    platform: row.platform,
    externalId: row.external_id,
    title: row.title,
    question: row.question,
    description: row.description,
    category: row.category,
    outcomes: row.outcomes,
    status: row.status,
    yesPrice: row.yes_price,
    noPrice: row.no_price,
    volume: row.volume,
    volume24h: row.volume_24h,
    liquidity: row.liquidity,
    expiresAt: row.expires_at ? new Date(row.expires_at).getTime() : undefined,
    closesAt: row.closes_at ? new Date(row.closes_at).getTime() : undefined,
    resolvedAt: row.resolved_at ? new Date(row.resolved_at).getTime() : undefined,
    winningOutcome: row.winning_outcome,
    metadata: row.metadata,
    chain: row.chain,
    currency: row.currency,
    fetchedAt: new Date(row.fetched_at).getTime(),
  }));
}

export async function getMarketStats(): Promise<Record<string, { count: number; volume: number }>> {
  const { data, error } = await supabase
    .from('unified_markets')
    .select('platform, volume')
    .eq('status', 'open');

  if (error || !data) return {};

  const stats: Record<string, { count: number; volume: number }> = {};
  for (const row of data) {
    if (!stats[row.platform]) {
      stats[row.platform] = { count: 0, volume: 0 };
    }
    stats[row.platform].count++;
    stats[row.platform].volume += row.volume || 0;
  }

  return stats;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function normalizeMarketId(platform: string, externalId: string): string {
  return `${platform}-${externalId}`;
}

// ============================================
// PLATFORM-SPECIFIC FETCHERS
// ============================================

export interface PlatformFetcher {
  platform: string;
  fetchPage(cursor?: string, limit?: number): Promise<PaginatedResult<UnifiedMarket>>;
  fetchAll(options?: FetchOptions): Promise<UnifiedMarket[]>;
}

// Base class for platform fetchers
export abstract class BasePlatformFetcher implements PlatformFetcher {
  abstract platform: string;
  abstract fetchPage(cursor?: string, limit?: number): Promise<PaginatedResult<UnifiedMarket>>;

  async fetchAll(options: FetchOptions = {}): Promise<UnifiedMarket[]> {
    const cacheKey = `${this.platform}:all:${options.includeResolved ? 'all' : 'open'}`;

    // Check memory cache first
    if (!options.forceRefresh) {
      const cached = memoryCache.get<UnifiedMarket[]>(cacheKey);
      if (cached) {
        console.log(`[${this.platform}] Returning ${cached.length} markets from cache`);
        return cached;
      }
    }

    const allMarkets: UnifiedMarket[] = [];
    let cursor: string | undefined;
    let pageCount = 0;
    const maxPages = 50; // Safety limit

    console.log(`[${this.platform}] Starting full fetch...`);

    while (pageCount < maxPages) {
      try {
        const result = await rateLimiter.executeWithRetry(
          this.platform,
          () => this.fetchPage(cursor, options.limit)
        );

        allMarkets.push(...result.data);
        pageCount++;

        console.log(`[${this.platform}] Page ${pageCount}: fetched ${result.data.length} markets (total: ${allMarkets.length})`);

        if (!result.hasMore || !result.nextCursor) {
          break;
        }

        cursor = result.nextCursor;

        // Small delay between pages to be nice to APIs
        await sleep(100);
      } catch (error) {
        console.error(`[${this.platform}] Error fetching page ${pageCount + 1}:`, error);
        break;
      }
    }

    console.log(`[${this.platform}] Completed: ${allMarkets.length} total markets`);

    // Cache results
    memoryCache.set(cacheKey, allMarkets, 5 * 60 * 1000); // 5 minute cache

    // Save to database in background
    saveMarketsToDatabase(allMarkets).catch(err =>
      console.error(`[${this.platform}] Error saving to database:`, err)
    );

    return allMarkets;
  }
}

// ============================================
// UNIFIED FETCH FUNCTION
// ============================================

export async function fetchAllPlatformMarkets(
  platforms: string[],
  options: FetchOptions = {}
): Promise<{ platform: string; markets: UnifiedMarket[]; error?: string }[]> {
  const results = await Promise.allSettled(
    platforms.map(async platform => {
      try {
        // Import the platform-specific fetcher dynamically
        const fetcher = await getPlatformFetcher(platform);
        if (!fetcher) {
          return { platform, markets: [], error: 'Unknown platform' };
        }

        const markets = await fetcher.fetchAll(options);
        return { platform, markets };
      } catch (error: any) {
        return { platform, markets: [], error: error.message };
      }
    })
  );

  return results.map((result, i) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    return { platform: platforms[i], markets: [], error: result.reason?.message };
  });
}

// Platform fetcher registry
const fetcherRegistry = new Map<string, PlatformFetcher>();

export function registerPlatformFetcher(fetcher: PlatformFetcher): void {
  fetcherRegistry.set(fetcher.platform, fetcher);
}

export function getPlatformFetcher(platform: string): PlatformFetcher | undefined {
  return fetcherRegistry.get(platform);
}

// ============================================
// BACKGROUND SYNC
// ============================================

let syncInterval: NodeJS.Timeout | null = null;

export function startBackgroundSync(intervalMs: number = 5 * 60 * 1000): void {
  if (syncInterval) return;

  console.log('[MarketFetcher] Starting background sync...');

  syncInterval = setInterval(async () => {
    const platforms = Array.from(fetcherRegistry.keys());
    console.log(`[MarketFetcher] Syncing ${platforms.length} platforms...`);

    const results = await fetchAllPlatformMarkets(platforms, { forceRefresh: true });

    let totalMarkets = 0;
    for (const result of results) {
      if (result.error) {
        console.error(`[MarketFetcher] ${result.platform} sync failed: ${result.error}`);
      } else {
        totalMarkets += result.markets.length;
      }
    }

    console.log(`[MarketFetcher] Sync complete: ${totalMarkets} total markets`);
  }, intervalMs);
}

export function stopBackgroundSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}
