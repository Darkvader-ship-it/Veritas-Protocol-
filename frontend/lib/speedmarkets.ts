/**
 * Thales Speed Markets API Integration
 *
 * Speed Markets allow users to predict if BTC/ETH price will go UP or DOWN
 * within a specified time frame (5 min to 24 hours) on Optimism.
 *
 * Documentation: https://docs.thales.io/thales-speed-markets/speed-markets-integration
 */

// Configuration
export const SPEED_MARKETS_CONFIG = {
  API_URL: 'https://overtimemarketsv2.xyz',
  NETWORKS: {
    OPTIMISM: { id: 10, name: 'Optimism', symbol: 'OP' },
    ARBITRUM: { id: 42161, name: 'Arbitrum', symbol: 'ARB' },
    BASE: { id: 8453, name: 'Base', symbol: 'BASE' },
  } as const,
  DEFAULT_NETWORK: 10, // Optimism
  CONTRACTS: {
    SPEED_MARKETS_AMM: '0xE16B8a01490835EC1e76bAbbB3Cadd8921b32001',
  },
  // Supported assets
  ASSETS: ['BTC', 'ETH'] as const,
  // Time frames in seconds
  TIME_FRAMES: [
    { label: '5 min', seconds: 300 },
    { label: '10 min', seconds: 600 },
    { label: '30 min', seconds: 1800 },
    { label: '1 hour', seconds: 3600 },
    { label: '4 hours', seconds: 14400 },
    { label: '24 hours', seconds: 86400 },
  ] as const,
  MIN_BUYIN: 5, // $5 USD
  MAX_BUYIN: 200, // $200 USD
  CACHE_DURATION: 15 * 1000, // 15 seconds
} as const;

export type SpeedAsset = (typeof SPEED_MARKETS_CONFIG.ASSETS)[number];
export type Direction = 'UP' | 'DOWN';

// TypeScript Types
export interface SpeedMarketParams {
  asset: SpeedAsset;
  direction: Direction;
  buyIn: number; // USD amount
  deltaTimeSec: number; // Time to maturity in seconds
  collateral?: string; // Default sUSD
}

export interface SpeedMarketQuote {
  payout: number;
  fees: number;
  strikePrice: number;
  maturity: number;
  skewImpact: number;
}

export interface SpeedMarket {
  id: string;
  user: string;
  asset: SpeedAsset;
  direction: Direction;
  strikePrice: number;
  finalPrice?: number;
  buyIn: number;
  payout: number;
  createdAt: number;
  maturity: number;
  isResolved: boolean;
  isWinning?: boolean;
}

export interface SpeedMarketDisplay {
  id: string;
  platform: 'speed-markets';
  asset: SpeedAsset;
  assetIcon: string;
  question: string;
  currentPrice: number;
  priceChange24h: number;
  availableTimeFrames: typeof SPEED_MARKETS_CONFIG.TIME_FRAMES;
  minBuyIn: number;
  maxBuyIn: number;
  estimatedPayout: number; // Multiplier (e.g., 1.9x)
}

// Cache implementation
class SpeedMarketsCache {
  private cache = new Map<string, { data: any; timestamp: number }>();

  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;

    const isExpired = Date.now() - item.timestamp > SPEED_MARKETS_CONFIG.CACHE_DURATION;
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

const speedCache = new SpeedMarketsCache();

/**
 * Thales Speed Markets Service
 */
export class SpeedMarketsService {
  private networkId: number;

  constructor(networkId: number = SPEED_MARKETS_CONFIG.DEFAULT_NETWORK) {
    this.networkId = networkId;
  }

  /**
   * Get available Speed Markets for display
   */
  async getAvailableMarkets(): Promise<{ markets: SpeedMarketDisplay[]; isMock: boolean }> {
    const cacheKey = 'available-markets';
    const cached = speedCache.get(cacheKey);
    if (cached) return cached;

    try {
      // Try to get live price data
      const response = await fetch('/api/speedmarkets');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.markets) {
          speedCache.set(cacheKey, { markets: data.markets, isMock: data.isMock || false });
          return { markets: data.markets, isMock: data.isMock || false };
        }
      }
      throw new Error('API failed');
    } catch (error) {
      console.error('Error fetching Speed Markets:', error);
      return { markets: [], isMock: false };
    }
  }

  /**
   * Get a quote for a Speed Market position
   */
  async getQuote(params: SpeedMarketParams): Promise<SpeedMarketQuote | null> {
    try {
      const response = await fetch('/api/speedmarkets/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (response.ok) {
        const data = await response.json();
        return data.quote || null;
      }
      return null;
    } catch (error) {
      console.error('Error getting Speed Market quote:', error);
      return null;
    }
  }


  /**
   * Format price for display
   */
  formatPrice(price: number, asset: SpeedAsset): string {
    if (asset === 'BTC') {
      return `$${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    }
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  /**
   * Format time frame for display
   */
  formatTimeFrame(seconds: number): string {
    if (seconds < 3600) {
      return `${Math.floor(seconds / 60)} min`;
    }
    if (seconds < 86400) {
      return `${Math.floor(seconds / 3600)} hour${seconds >= 7200 ? 's' : ''}`;
    }
    return '24 hours';
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    speedCache.clear();
  }
}

// Singleton instance
export const speedMarketsService = new SpeedMarketsService();

// Helper functions for React components
export async function fetchSpeedMarkets() {
  return speedMarketsService.getAvailableMarkets();
}

export type SpeedMarketsResult = { markets: SpeedMarketDisplay[]; isMock: boolean };
