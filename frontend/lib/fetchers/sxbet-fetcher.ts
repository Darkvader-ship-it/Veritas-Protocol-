/**
 * SX Bet Fetcher with Pagination
 *
 * Fetches sports betting markets from SX Bet
 */

import {
  BasePlatformFetcher,
  PaginatedResult,
  UnifiedMarket,
  registerPlatformFetcher,
  normalizeMarketId,
} from '../market-fetcher';

const SX_API = 'https://api.sx.bet';
const PAGE_SIZE = 50; // SX API max is 50

const SPORT_NAMES: Record<number, string> = {
  1: 'Soccer',
  2: 'Football',
  3: 'Basketball',
  4: 'Hockey',
  5: 'Baseball',
  6: 'Tennis',
  7: 'MMA',
  8: 'Esports',
  9: 'Cricket',
  10: 'Rugby',
};

const MARKET_TYPES: Record<number, string> = {
  1: 'Moneyline',
  2: 'Spread',
  3: 'Total',
  52: 'Props',
  63: 'Game Props',
  126: 'Moneyline',
};

export class SXBetFetcher extends BasePlatformFetcher {
  platform = 'sxbet';

  async fetchPage(cursor?: string, limit?: number): Promise<PaginatedResult<UnifiedMarket>> {
    const pageSize = Math.min(limit || PAGE_SIZE, 50);
    const pageNum = cursor ? parseInt(cursor) : 1;

    // Fetch active markets
    const url = `${SX_API}/markets/active?pageSize=${pageSize}&pageNum=${pageNum}`;

    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`SX Bet API error: ${response.status}`);
    }

    const result = await response.json();
    let rawMarkets = result.data?.markets || [];
    
    // If no markets or all past, try our curated API fallback
    const nowSec2 = Math.floor(Date.now() / 1000);
    const hasFuture = rawMarkets.some((m: any) => m.gameTime > nowSec2);
    if (!hasFuture && rawMarkets.length > 0) {
      try {
        const fallbackRes = await fetch('/api/sxbet?limit=10');
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          if (fallbackData.data && fallbackData.data.length > 0) {
            rawMarkets = fallbackData.data;
          }
        }
      } catch {}
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const markets: UnifiedMarket[] = rawMarkets
      .filter((m: any) => m.status === 'ACTIVE' && m.gameTime > nowSec)
      .map((m: any) => this.transformMarket(m));

    const hasMore = rawMarkets.length === pageSize;
    const nextCursor = hasMore ? String(pageNum + 1) : undefined;

    return {
      data: markets,
      hasMore,
      nextCursor,
    };
  }

  private transformMarket(m: any): UnifiedMarket {
    const sportName = SPORT_NAMES[m.sportId] || 'Sports';
    const marketType = MARKET_TYPES[m.type] || 'Moneyline';

    const teamOne = m.teamOneName || m.outcomeOneName || 'Team 1';
    const teamTwo = m.teamTwoName || m.outcomeTwoName || 'Team 2';
    const title = `${teamOne} vs ${teamTwo}`;

    // Calculate implied probabilities from odds (if available)
    const outcomes = [
      { id: 'one', name: m.outcomeOneName || teamOne, probability: 50, odds: 2 },
      { id: 'two', name: m.outcomeTwoName || teamTwo, probability: 50, odds: 2 },
    ];

    if (m.outcomeVoidName) {
      outcomes.push({ id: 'void', name: m.outcomeVoidName, probability: 10, odds: 10 });
    }

    return {
      id: normalizeMarketId(this.platform, m.marketHash),
      platform: this.platform,
      externalId: m.marketHash,
      title,
      question: `${title} - ${marketType}`,
      category: sportName,
      outcomes,
      status: m.status === 'ACTIVE' ? 'open' : 'closed',
      yesPrice: 0.5,
      noPrice: 0.5,
      volume: 0, // SX doesn't provide volume in this endpoint
      expiresAt: m.gameTime * 1000,
      metadata: {
        marketHash: m.marketHash,
        sportId: m.sportId,
        leagueId: m.leagueId,
        type: m.type,
        marketType,
        line: m.line,
        group1: m.group1,
        group2: m.group2,
        sportLabel: m.sportLabel,
        leagueLabel: m.leagueLabel,
      },
      chain: 'SX Network',
      currency: 'USDC',
      fetchedAt: Date.now(),
    };
  }
}

registerPlatformFetcher(new SXBetFetcher());
export const sxbetFetcher = new SXBetFetcher();
