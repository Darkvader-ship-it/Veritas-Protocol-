/**
 * Overtime Markets Fetcher
 *
 * Fetches sports betting markets using The Odds API
 * Requires ODDS_API_KEY environment variable
 */

import {
  BasePlatformFetcher,
  PaginatedResult,
  UnifiedMarket,
  registerPlatformFetcher,
  normalizeMarketId,
} from '../market-fetcher';

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';

// Sports to fetch from The Odds API
const SPORTS_TO_FETCH = [
  'basketball_nba',
  'americanfootball_nfl',
  'icehockey_nhl',
  'soccer_epl',
  'mma_mixed_martial_arts',
  'baseball_mlb',
  'soccer_spain_la_liga',
  'soccer_germany_bundesliga',
];

// Map sport keys to categories
const SPORT_CATEGORIES: Record<string, string> = {
  'basketball_nba': 'Basketball',
  'basketball_ncaab': 'Basketball',
  'americanfootball_nfl': 'Football',
  'americanfootball_ncaaf': 'Football',
  'icehockey_nhl': 'Hockey',
  'baseball_mlb': 'Baseball',
  'mma_mixed_martial_arts': 'MMA',
  'soccer_epl': 'Soccer',
  'soccer_spain_la_liga': 'Soccer',
  'soccer_germany_bundesliga': 'Soccer',
  'soccer_italy_serie_a': 'Soccer',
  'soccer_france_ligue_one': 'Soccer',
};

export class OvertimeFetcher extends BasePlatformFetcher {
  platform = 'overtime';

  async fetchPage(cursor?: string, limit?: number): Promise<PaginatedResult<UnifiedMarket>> {
    const apiKey = process.env.ODDS_API_KEY;

    if (!apiKey) {
      console.warn('[Overtime] ODDS_API_KEY not configured - skipping');
      return { data: [], hasMore: false };
    }

    try {
      const allMarkets: UnifiedMarket[] = [];

      // Fetch from multiple sports
      for (const sport of SPORTS_TO_FETCH) {
        try {
          const url = `${ODDS_API_BASE}/sports/${sport}/odds?apiKey=${apiKey}&regions=us&markets=h2h&oddsFormat=decimal`;

          const response = await fetch(url, {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(10000),
          });

          if (!response.ok) {
            if (response.status === 429) {
              console.warn('[Overtime] Rate limit hit, stopping');
              break;
            }
            continue;
          }

          const events = await response.json();

          for (const event of events) {
            const market = this.transformEvent(event, sport);
            if (market) {
              allMarkets.push(market);
            }
          }
        } catch (error: any) {
          console.warn(`[Overtime] Failed to fetch ${sport}:`, error.message);
        }
      }

      console.log(`[Overtime] Fetched ${allMarkets.length} sports markets`);

      return {
        data: allMarkets,
        hasMore: false,
        nextCursor: undefined,
      };
    } catch (error: any) {
      console.error('[Overtime] Fetch error:', error.message);
      return { data: [], hasMore: false };
    }
  }

  private transformEvent(event: any, sportKey: string): UnifiedMarket | null {
    if (!event.home_team || !event.away_team) return null;

    const homeTeam = event.home_team;
    const awayTeam = event.away_team;
    const title = `${homeTeam} vs ${awayTeam}`;

    // Get odds from first bookmaker with h2h market
    let homeOdds = 2.0;
    let awayOdds = 2.0;
    let drawOdds: number | undefined;

    for (const bookmaker of event.bookmakers || []) {
      const h2hMarket = bookmaker.markets?.find((m: any) => m.key === 'h2h');
      if (h2hMarket && h2hMarket.outcomes?.length >= 2) {
        const homeOutcome = h2hMarket.outcomes.find((o: any) => o.name === homeTeam);
        const awayOutcome = h2hMarket.outcomes.find((o: any) => o.name === awayTeam);
        const drawOutcome = h2hMarket.outcomes.find((o: any) => o.name === 'Draw');

        if (homeOutcome) homeOdds = homeOutcome.price;
        if (awayOutcome) awayOdds = awayOutcome.price;
        if (drawOutcome) drawOdds = drawOutcome.price;
        break;
      }
    }

    const outcomes = [
      { id: 'home', name: homeTeam, probability: (1/homeOdds) * 100, odds: homeOdds },
      { id: 'away', name: awayTeam, probability: (1/awayOdds) * 100, odds: awayOdds },
    ];

    if (drawOdds && drawOdds > 0) {
      outcomes.push({ id: 'draw', name: 'Draw', probability: (1/drawOdds) * 100, odds: drawOdds });
    }

    const maturity = event.commence_time ? new Date(event.commence_time).getTime() : Date.now() + 86400000;
    const category = SPORT_CATEGORIES[sportKey] || event.sport_title || 'Sports';

    return {
      id: normalizeMarketId(this.platform, event.id),
      platform: this.platform,
      externalId: event.id,
      title,
      question: title,
      category,
      outcomes,
      status: 'open',
      yesPrice: 1 / homeOdds,
      noPrice: 1 / awayOdds,
      volume: 0,
      expiresAt: maturity,
      metadata: {
        sportKey,
        sportTitle: event.sport_title,
        homeTeam,
        awayTeam,
        bookmakers: event.bookmakers?.length || 0,
      },
      chain: 'Optimism',
      currency: 'sUSD',
      fetchedAt: Date.now(),
    };
  }
}

registerPlatformFetcher(new OvertimeFetcher());
export const overtimeFetcher = new OvertimeFetcher();
