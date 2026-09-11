/**
 * Overtime Markets V2 API Integration
 *
 * Overtime is a fully on-chain sportsbook on Optimism, Arbitrum, and Base.
 * This service provides access to sports betting markets via the Overtime V2 API.
 *
 * Documentation: https://docs.overtime.io/overtime-v2-integration
 */

// Configuration
export const OVERTIME_CONFIG = {
  // API endpoints
  API_URL: 'https://api.overtime.io',
  FALLBACK_API_URL: 'https://overtimemarketsv2.xyz',

  // Network configurations
  NETWORKS: {
    OPTIMISM: { id: 10, name: 'Optimism', symbol: 'OP' },
    ARBITRUM: { id: 42161, name: 'Arbitrum', symbol: 'ARB' },
    BASE: { id: 8453, name: 'Base', symbol: 'BASE' },
  } as const,

  // Default network
  DEFAULT_NETWORK: 10, // Optimism

  // Contract addresses on Optimism
  CONTRACTS: {
    SPORTS_AMM_V2: '0xFb4e4811C7A811E098A556bD79B64c20b479E431',
    LIVE_TRADING_PROCESSOR: '0x3b834149F21B9A6C2DDC9F6ce97F2FD1097F8EAB',
    SPEED_MARKETS_AMM: '0xE16B8a01490835EC1e76bAbbB3Cadd8921b32001',
  },

  CACHE_DURATION: 30 * 1000, // 30 seconds
} as const;

// Sport IDs (from Overtime)
export const OVERTIME_SPORTS = {
  SOCCER: 1,
  FOOTBALL: 2,
  BASKETBALL: 3,
  HOCKEY: 4,
  BASEBALL: 5,
  TENNIS: 6,
  MMA: 7,
  ESPORTS: 8,
  CRICKET: 9,
  GOLF: 10,
  MOTORSPORT: 11,
} as const;

export type SportId = (typeof OVERTIME_SPORTS)[keyof typeof OVERTIME_SPORTS];

// Sport names for display
export const SPORT_NAMES: Record<number, string> = {
  1: 'Soccer',
  2: 'Football',
  3: 'Basketball',
  4: 'Hockey',
  5: 'Baseball',
  6: 'Tennis',
  7: 'MMA',
  8: 'Esports',
  9: 'Cricket',
  10: 'Golf',
  11: 'Motorsport',
};

// TypeScript Types
export interface OvertimeMarket {
  gameId: string;
  sportId: number;
  typeId: number; // 0 = moneyline, 1 = spread, 2 = total
  maturity: number; // Unix timestamp
  status: number; // 0 = open, 1 = resolved, 2 = cancelled
  homeTeam: string;
  awayTeam: string;
  homeOdds: number; // Decimal odds
  awayOdds: number;
  drawOdds?: number; // For sports with draw option
  spread?: number;
  total?: number;
  line?: number;
  leagueId: number;
  leagueName: string;
  isLive: boolean;
  isPaused: boolean;
  odds: string[]; // Array of odds as strings
  merkleProof?: string;
  combinedPositions?: number[][];
}

export interface OvertimeGame {
  gameId: string;
  sportId: number;
  leagueId: number;
  leagueName: string;
  homeTeam: string;
  awayTeam: string;
  maturity: number;
  isLive: boolean;
  isPaused: boolean;
  homeScore?: number;
  awayScore?: number;
  markets: OvertimeMarket[];
}

export interface OvertimePredictionMarket {
  id: string;
  platform: 'overtime';
  gameId: string;
  sportId: number;
  sportName: string;
  leagueName: string;
  homeTeam: string;
  awayTeam: string;
  question: string;
  outcomes: string[];
  probabilities: number[];
  odds: number[];
  maturity: number;
  timeRemaining: number;
  isLive: boolean;
  status: 'upcoming' | 'live' | 'ended' | 'cancelled';
  marketType: 'moneyline' | 'spread' | 'total';
  spread?: number;
  total?: number;
}

export interface OvertimeQuote {
  totalQuote: {
    american: number;
    decimal: number;
    normalizedImplied: number;
  };
  payout: {
    collateral: number;
    usd: number;
  };
  liquidityInUsd: number;
  isValid: boolean;
  errorMessage?: string;
}

// Cache implementation
class OvertimeCache {
  private cache = new Map<string, { data: any; timestamp: number }>();

  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;

    const isExpired = Date.now() - item.timestamp > OVERTIME_CONFIG.CACHE_DURATION;
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

const overtimeCache = new OvertimeCache();

/**
 * Overtime Markets V2 Service
 */
export class OvertimeService {
  private networkId: number;

  constructor(networkId: number = OVERTIME_CONFIG.DEFAULT_NETWORK) {
    this.networkId = networkId;
  }

  /**
   * Fetch markets from the API route (server-side to avoid CORS)
   */
  async getMarkets(sportId?: number): Promise<{ markets: OvertimePredictionMarket[]; isMock: boolean }> {
    const cacheKey = `markets:${sportId || 'all'}`;
    const cached = overtimeCache.get(cacheKey);
    if (cached) return cached;

    try {
      // Use Next.js API route
      const url = sportId
        ? `/api/overtime?sportId=${sportId}`
        : '/api/overtime';

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.markets) {
        const result = { markets: data.markets, isMock: data.isMock || false };
        overtimeCache.set(cacheKey, result);
        return result;
      }

      throw new Error(data.error || 'Failed to fetch markets');
    } catch (error) {
      console.error('Error fetching Overtime markets:', error);
      return { markets: [], isMock: false };
    }
  }

  /**
   * Get live markets
   */
  async getLiveMarkets(): Promise<{ markets: OvertimePredictionMarket[]; isMock: boolean }> {
    const cacheKey = 'live-markets';
    const cached = overtimeCache.get(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch('/api/overtime?live=true', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.markets) {
        const result = { markets: data.markets, isMock: data.isMock || false };
        overtimeCache.set(cacheKey, result);
        return result;
      }

      throw new Error(data.error || 'Failed to fetch live markets');
    } catch (error) {
      console.error('Error fetching live Overtime markets:', error);
      return { markets: [], isMock: false };
    }
  }

  /**
   * Get a quote for a potential bet
   */
  async getQuote(
    gameId: string,
    position: number,
    buyInAmount: number,
    collateral: string = 'USDC'
  ): Promise<OvertimeQuote | null> {
    try {
      const response = await fetch('/api/overtime/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId,
          position,
          buyInAmount,
          collateral,
        }),
      });

      if (!response.ok) {
        throw new Error(`Quote API error: ${response.status}`);
      }

      const data = await response.json();
      return data.quote || null;
    } catch (error) {
      console.error('Error fetching Overtime quote:', error);
      return null;
    }
  }


  /**
   * Transform API response to our market format
   */
  transformToMarket(game: OvertimeGame, market: OvertimeMarket): OvertimePredictionMarket {
    const now = Math.floor(Date.now() / 1000);
    const timeRemaining = Math.max(0, market.maturity - now);
    const sportName = SPORT_NAMES[market.sportId] || 'Unknown';

    let outcomes: string[];
    let odds: number[];

    if (market.typeId === 0) {
      // Moneyline
      if (market.drawOdds && market.drawOdds > 0) {
        outcomes = [game.homeTeam, 'Draw', game.awayTeam];
        odds = [market.homeOdds, market.drawOdds, market.awayOdds];
      } else {
        outcomes = [game.homeTeam, game.awayTeam];
        odds = [market.homeOdds, market.awayOdds];
      }
    } else if (market.typeId === 1) {
      // Spread
      const spread = market.spread || 0;
      outcomes = [
        `${game.homeTeam} ${spread > 0 ? '+' : ''}${spread}`,
        `${game.awayTeam} ${-spread > 0 ? '+' : ''}${-spread}`,
      ];
      odds = [market.homeOdds, market.awayOdds];
    } else {
      // Total
      const total = market.total || 0;
      outcomes = [`Over ${total}`, `Under ${total}`];
      odds = [market.homeOdds, market.awayOdds];
    }

    // Convert decimal odds to probabilities
    const totalInverseOdds = odds.reduce((sum, o) => sum + 1 / o, 0);
    const probabilities = odds.map((o) => (1 / o / totalInverseOdds) * 100);

    const marketTypes = ['moneyline', 'spread', 'total'] as const;

    return {
      id: `overtime-${market.gameId}-${market.typeId}`,
      platform: 'overtime',
      gameId: market.gameId,
      sportId: market.sportId,
      sportName,
      leagueName: market.leagueName || game.leagueName,
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      question: `${game.homeTeam} vs ${game.awayTeam}`,
      outcomes,
      probabilities,
      odds,
      maturity: market.maturity,
      timeRemaining,
      isLive: market.isLive,
      status: market.status === 2
        ? 'cancelled'
        : market.status === 1
        ? 'ended'
        : market.isLive
        ? 'live'
        : timeRemaining > 0
        ? 'upcoming'
        : 'ended',
      marketType: marketTypes[market.typeId] || 'moneyline',
      spread: market.spread,
      total: market.total,
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    overtimeCache.clear();
  }

  /**
   * Format odds for display
   */
  formatOdds(decimal: number, format: 'decimal' | 'american' = 'decimal'): string {
    if (format === 'american') {
      if (decimal >= 2) {
        return `+${Math.round((decimal - 1) * 100)}`;
      } else {
        return `${Math.round(-100 / (decimal - 1))}`;
      }
    }
    return decimal.toFixed(2);
  }

  /**
   * Format time remaining
   */
  formatTimeRemaining(seconds: number): string {
    if (seconds <= 0) return 'Started';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }

    return `${minutes}m`;
  }
}

// Singleton instance
export const overtimeService = new OvertimeService();

// Helper functions for React components
export async function fetchOvertimeMarkets(sportId?: number) {
  return overtimeService.getMarkets(sportId);
}

export async function fetchLiveOvertimeMarkets() {
  return overtimeService.getLiveMarkets();
}

export type OvertimeMarketsResult = { markets: OvertimePredictionMarket[]; isMock: boolean };
