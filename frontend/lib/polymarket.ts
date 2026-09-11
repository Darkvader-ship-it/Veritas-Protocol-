/**
 * Polymarket Gamma API Integration
 *
 * This service provides access to Polymarket's Gamma API for fetching
 * market data, events, and predictions.
 */

// Base configuration
export const POLYMARKET_CONFIG = {
  GAMMA_API_URL: 'https://gamma-api.polymarket.com',
  ENDPOINTS: {
    MARKETS: '/markets',
    EVENTS: '/events',
  },
  CACHE_DURATION: 60 * 1000, // 1 minute
} as const;

// TypeScript Types
export interface PolymarketMarket {
  id: string;
  question: string;
  description?: string;
  outcomes: string[];
  outcomePrices: string[];
  volume: string;
  active: boolean;
  closed: boolean;
  archived: boolean;
  marketSlug: string;
  endDate: string | null;
  gameStartTime: string | null;
  questionID: string;
  clobTokenIds: string[];
  conditionId: string;
  enableOrderBook: boolean;
  orderPriceMinTickSize: number;
  orderMinSize: number;
  volumeNum: number;
  liquidityNum: number;
  acceptingOrders: boolean;
  negRisk: boolean;
  tags?: string[];
  events?: PolymarketEventRef[];
}

export interface PolymarketEventRef {
  id: string;
  ticker: string;
  slug: string;
  title: string;
  startDate: string | null;
  creationDate: string;
  endDate: string | null;
  image: string;
  icon: string;
  active: boolean;
  closed: boolean;
  archived: boolean;
  new: boolean;
  featured: boolean;
  restricted: boolean;
  liquidity: string;
  volume: string;
  createdAt: string;
  updatedAt: string;
  enableOrderBook: boolean;
  markets?: PolymarketMarket[];
}

export interface PolymarketEvent extends PolymarketEventRef {
  markets: PolymarketMarket[];
}

export interface MarketQueryParams {
  limit?: number;
  offset?: number;
  active?: boolean;
  closed?: boolean;
  archived?: boolean;
  enableOrderBook?: boolean;
  tag?: string;
}

export interface EventQueryParams {
  limit?: number;
  offset?: number;
  active?: boolean;
  closed?: boolean;
  archived?: boolean;
  tag?: string;
}

export interface PolymarketPosition {
  marketId: string;
  outcome: string;
  shares: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
}

export interface PolymarketPrediction {
  marketId: string;
  marketQuestion: string;
  outcome: string;
  shares: number;
  entryPrice: number;
  exitPrice?: number;
  timestamp: number;
  isCorrect?: boolean;
  profit?: number;
  status: 'open' | 'won' | 'lost' | 'pending';
}

// Cache implementation
class MarketCache {
  private cache = new Map<string, { data: any; timestamp: number }>();

  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;

    const isExpired = Date.now() - item.timestamp > POLYMARKET_CONFIG.CACHE_DURATION;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  set(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

const marketCache = new MarketCache();

/**
 * Polymarket API Service
 */
export class PolymarketService {
  private baseUrl: string;

  constructor(baseUrl: string = POLYMARKET_CONFIG.GAMMA_API_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Build query string from parameters
   */
  private buildQueryString(params: Record<string, any>): string {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, value.toString());
      }
    });

    const query = searchParams.toString();
    return query ? `?${query}` : '';
  }

  /**
   * Fetch markets from Polymarket
   */
  async getMarkets(params: MarketQueryParams = {}): Promise<PolymarketMarket[]> {
    const cacheKey = `markets:${JSON.stringify(params)}`;
    const cached = marketCache.get(cacheKey);
    if (cached) return cached;

    const queryString = this.buildQueryString(params);

    try {
      const response = await fetch(`/api/polymarket?endpoint=markets&${queryString.slice(1)}`);

      if (!response.ok) {
        throw new Error(`Polymarket API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      marketCache.set(cacheKey, data);
      return data;
    } catch (error) {
      console.error('Error fetching Polymarket markets:', error);
      throw error;
    }
  }

  /**
   * Get a specific market by ID
   */
  async getMarket(marketId: string): Promise<PolymarketMarket | null> {
    const cacheKey = `market:${marketId}`;
    const cached = marketCache.get(cacheKey);
    if (cached) return cached;

    const url = `${this.baseUrl}${POLYMARKET_CONFIG.ENDPOINTS.MARKETS}/${marketId}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Polymarket API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      marketCache.set(cacheKey, data);
      return data;
    } catch (error) {
      console.error(`Error fetching market ${marketId}:`, error);
      throw error;
    }
  }

  /**
   * Fetch events from Polymarket
   */
  async getEvents(params: EventQueryParams = {}): Promise<PolymarketEvent[]> {
    const cacheKey = `events:${JSON.stringify(params)}`;
    const cached = marketCache.get(cacheKey);
    if (cached) return cached;

    const queryString = this.buildQueryString(params);
    const url = `${this.baseUrl}${POLYMARKET_CONFIG.ENDPOINTS.EVENTS}${queryString}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Polymarket API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      marketCache.set(cacheKey, data);
      return data;
    } catch (error) {
      console.error('Error fetching Polymarket events:', error);
      throw error;
    }
  }

  /**
   * Get a specific event by slug
   */
  async getEvent(slug: string): Promise<PolymarketEvent | null> {
    const cacheKey = `event:${slug}`;
    const cached = marketCache.get(cacheKey);
    if (cached) return cached;

    const url = `${this.baseUrl}${POLYMARKET_CONFIG.ENDPOINTS.EVENTS}/${slug}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Polymarket API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      marketCache.set(cacheKey, data);
      return data;
    } catch (error) {
      console.error(`Error fetching event ${slug}:`, error);
      throw error;
    }
  }

  /**
   * Get trending markets (from events, sorted by 24h volume)
   */
  async getTrendingMarkets(limit: number = 10): Promise<PolymarketMarket[]> {
    const cacheKey = `trending:${limit}`;
    const cached = marketCache.get(cacheKey);
    if (cached) return cached;

    try {
      // Fetch trending events (these have the hot markets)
      const eventsRes = await fetch(`/api/polymarket?endpoint=events&closed=false&limit=50`);
      if (!eventsRes.ok) throw new Error('Failed to fetch events');

      const events = await eventsRes.json();

      // Flatten markets from events and add event context
      const allMarkets: PolymarketMarket[] = [];

      for (const event of events) {
        if (event.markets && Array.isArray(event.markets)) {
          for (const market of event.markets) {
            if (!market.closed && market.active) {
              // Add 24h volume from event if market doesn't have it
              if (!market.volume24hr && event.volume24hr) {
                market.volume24hr = event.volume24hr / event.markets.length;
              }
              allMarkets.push(market);
            }
          }
        }
      }

      // Also get some individual markets for variety
      const marketsRes = await fetch(`/api/polymarket?endpoint=markets&closed=false&limit=30`);
      if (marketsRes.ok) {
        const markets = await marketsRes.json();
        for (const market of markets) {
          if (!market.closed && market.active) {
            // Avoid duplicates
            if (!allMarkets.some(m => m.conditionId === market.conditionId)) {
              allMarkets.push(market);
            }
          }
        }
      }

      // Sort by 24h volume (most active), fallback to total volume
      const sorted = allMarkets.sort((a, b) => {
        const aVol = a.volume24hr || a.volumeNum || 0;
        const bVol = b.volume24hr || b.volumeNum || 0;
        return bVol - aVol;
      });

      const result = sorted.slice(0, limit);
      marketCache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error fetching trending markets:', error);
      // Fallback to regular markets
      return this.getActiveMarkets(limit);
    }
  }

  /**
   * Get active markets (sorted by 24h volume for freshness)
   */
  async getActiveMarkets(limit: number = 100): Promise<PolymarketMarket[]> {
    const markets = await this.getMarkets({
      active: true,
      closed: false,
      archived: false,
      limit: 200,
    });

    // Sort by 24h volume first (most active today), then by total volume
    return markets
      .filter(market => market.active && !market.closed)
      .sort((a, b) => {
        const aVol24 = (a as any).volume24hr || 0;
        const bVol24 = (b as any).volume24hr || 0;
        if (aVol24 !== bVol24) return bVol24 - aVol24;
        return b.volumeNum - a.volumeNum;
      })
      .slice(0, limit);
  }

  /**
   * Search markets by keyword (searches both events and markets)
   */
  async searchMarkets(query: string, limit: number = 10): Promise<PolymarketMarket[]> {
    const lowerQuery = query.toLowerCase();
    const results: PolymarketMarket[] = [];

    try {
      // Search in events first (has the trending stuff)
      const eventsRes = await fetch(`/api/polymarket?endpoint=events&closed=false&limit=100`);
      if (eventsRes.ok) {
        const events = await eventsRes.json();
        for (const event of events) {
          // Check if event title matches
          const eventMatches = event.title?.toLowerCase().includes(lowerQuery) ||
                              event.description?.toLowerCase().includes(lowerQuery);

          if (event.markets && Array.isArray(event.markets)) {
            for (const market of event.markets) {
              if (!market.closed && market.active) {
                const marketMatches = market.question?.toLowerCase().includes(lowerQuery) ||
                                     market.description?.toLowerCase().includes(lowerQuery);

                if (eventMatches || marketMatches) {
                  if (!results.some(m => m.conditionId === market.conditionId)) {
                    results.push(market);
                  }
                }
              }
            }
          }
        }
      }

      // Also search regular markets
      const markets = await this.getActiveMarkets(100);
      for (const market of markets) {
        if (market.question?.toLowerCase().includes(lowerQuery) ||
            market.description?.toLowerCase().includes(lowerQuery)) {
          if (!results.some(m => m.conditionId === market.conditionId)) {
            results.push(market);
          }
        }
      }
    } catch (error) {
      console.error('Error searching markets:', error);
    }

    // Sort by 24h volume
    return results
      .sort((a, b) => ((b as any).volume24hr || b.volumeNum || 0) - ((a as any).volume24hr || a.volumeNum || 0))
      .slice(0, limit);
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    marketCache.clear();
  }

  /**
   * Calculate potential profit
   */
  calculatePotentialProfit(shares: number, buyPrice: number, currentPrice: number): number {
    return shares * (currentPrice - buyPrice);
  }

  /**
   * Calculate probability from price
   */
  getProbability(price: string): number {
    return parseFloat(price) * 100;
  }

  /**
   * Format market for display
   */
  formatMarket(market: PolymarketMarket): {
    question: string;
    outcomes: string[];
    probabilities: number[];
    volume: number;
    status: 'active' | 'closed' | 'archived';
  } {
    return {
      question: market.question,
      outcomes: market.outcomes,
      probabilities: market.outcomePrices.map(price => this.getProbability(price)),
      volume: market.volumeNum,
      status: market.archived ? 'archived' : market.closed ? 'closed' : 'active',
    };
  }
}

// Singleton instance
export const polymarketService = new PolymarketService();

// Helper functions for React components
export async function fetchTrendingMarkets(limit?: number) {
  return polymarketService.getTrendingMarkets(limit);
}

export async function fetchActiveMarkets(limit?: number) {
  return polymarketService.getActiveMarkets(limit);
}

export async function searchPolymarkets(query: string, limit?: number) {
  return polymarketService.searchMarkets(query, limit);
}

export async function fetchMarketById(id: string) {
  return polymarketService.getMarket(id);
}

export async function fetchEventBySlug(slug: string) {
  return polymarketService.getEvent(slug);
}
