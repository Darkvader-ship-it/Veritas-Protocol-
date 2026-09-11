/**
 * Limitless Exchange API Integration
 *
 * Limitless is a prediction market platform on Base chain with hourly/daily
 * markets for crypto and stock price predictions.
 *
 * Documentation: https://api.limitless.exchange/api-v1
 */

// Configuration
export const LIMITLESS_CONFIG = {
  // Correct API URL - no /api-v1 prefix for market endpoints
  API_URL: 'https://api.limitless.exchange',
  CHAIN: {
    id: 8453,
    name: 'Base',
    symbol: 'ETH',
  },
  CACHE_DURATION: 30 * 1000, // 30 seconds
} as const;

// TypeScript Types
export interface LimitlessMarket {
  id: string;
  address: string;
  slug: string;
  title: string;
  description?: string;
  category: string;
  status: 'active' | 'resolved' | 'cancelled';
  createdAt: string;
  expiresAt: string;
  resolutionTime?: string;
  yesTokenId: string;
  noTokenId: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  liquidity: number;
  outcomes: string[];
  winningOutcome?: string;
  tags?: string[];
}

export interface LimitlessMarketGroup {
  id: string;
  slug: string;
  title: string;
  description?: string;
  markets: LimitlessMarket[];
}

export interface LimitlessPredictionMarket {
  id: string;
  platform: 'limitless';
  slug: string;
  question: string;
  description?: string;
  category: string;
  outcomes: string[];
  probabilities: number[];
  volume: number;
  liquidity: number;
  expiresAt: number;
  timeRemaining: number;
  status: 'active' | 'resolved' | 'cancelled';
  yesPrice: number;
  noPrice: number;
}

export interface LimitlessOrderBook {
  bids: { price: number; size: number }[];
  asks: { price: number; size: number }[];
  spread: number;
}

// Cache implementation
class LimitlessCache {
  private cache = new Map<string, { data: any; timestamp: number }>();

  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;

    const isExpired = Date.now() - item.timestamp > LIMITLESS_CONFIG.CACHE_DURATION;
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

const limitlessCache = new LimitlessCache();

/**
 * Limitless Exchange Service
 */
export class LimitlessService {
  /**
   * Get active markets
   */
  async getActiveMarkets(limit: number = 20): Promise<{ markets: LimitlessPredictionMarket[]; isMock: boolean }> {
    const cacheKey = `active-markets:${limit}`;
    const cached = limitlessCache.get(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(`/api/limitless?limit=${limit}`);
      if (response.ok) {
        const data = await response.json();
        // API returns { success, data: [...markets], isMock }
        if (data.success && data.data) {
          const result = { markets: data.data, isMock: data.isMock || false };
          limitlessCache.set(cacheKey, result);
          return result;
        }
      }
      throw new Error('API failed');
    } catch (error) {
      console.error('Error fetching Limitless markets:', error);
      return { markets: [], isMock: false };
    }
  }

  /**
   * Get a specific market by slug
   */
  async getMarket(slug: string): Promise<LimitlessPredictionMarket | null> {
    const cacheKey = `market:${slug}`;
    const cached = limitlessCache.get(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(`/api/limitless/market?slug=${slug}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.market) {
          limitlessCache.set(cacheKey, data.market);
          return data.market;
        }
      }
      return null;
    } catch (error) {
      console.error('Error fetching Limitless market:', error);
      return null;
    }
  }

  /**
   * Search markets
   */
  async searchMarkets(query: string, limit: number = 10): Promise<LimitlessPredictionMarket[]> {
    try {
      const response = await fetch(`/api/limitless/search?q=${encodeURIComponent(query)}&limit=${limit}`);
      if (response.ok) {
        const data = await response.json();
        return data.markets || [];
      }
      return [];
    } catch (error) {
      console.error('Error searching Limitless markets:', error);
      return [];
    }
  }


  /**
   * Format volume for display
   */
  formatVolume(volume: number): string {
    if (volume >= 1000000) return `$${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `$${(volume / 1000).toFixed(0)}K`;
    return `$${volume.toFixed(0)}`;
  }

  /**
   * Format time remaining
   */
  formatTimeRemaining(seconds: number): string {
    if (seconds <= 0) return 'Expired';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d`;
    }

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }

    return `${minutes}m`;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    limitlessCache.clear();
  }
}

// Singleton instance
export const limitlessService = new LimitlessService();

// Helper functions for React components
export async function fetchLimitlessMarkets(limit?: number) {
  return limitlessService.getActiveMarkets(limit);
}

export async function searchLimitlessMarkets(query: string, limit?: number) {
  return limitlessService.searchMarkets(query, limit);
}

export type LimitlessMarketsResult = { markets: LimitlessPredictionMarket[]; isMock: boolean };
