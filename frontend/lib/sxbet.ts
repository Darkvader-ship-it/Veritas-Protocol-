/**
 * SX Bet Market Fetcher
 */

export interface SXBetMarket {
  id: string;
  marketHash: string;
  type: string;
  sport: string;
  league: string;
  teamOne: string;
  teamTwo: string;
  outcomeOne: string;
  outcomeTwo: string;
  line?: number;
  gameTime: number;
  status: string;
}

export async function fetchSXBetMarkets(): Promise<{
  markets: SXBetMarket[];
  isMock: boolean;
}> {
  try {
    // Fetch more markets (up to 100)
    const response = await fetch('/api/sxbet?limit=100');

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !data.data || data.data.length === 0) {
      return { markets: [], isMock: false };
    }

    const markets: SXBetMarket[] = data.data.map((m: any) => ({
      id: m.id,
      marketHash: m.marketHash,
      type: m.type,
      sport: m.sport,
      league: m.league,
      teamOne: m.teamOne,
      teamTwo: m.teamTwo,
      outcomeOne: m.outcomeOne,
      outcomeTwo: m.outcomeTwo,
      line: m.line,
      gameTime: m.gameTime,
      status: m.status,
    }));

    return { markets, isMock: data.isMock || false };
  } catch (error) {
    console.error('Error fetching SX Bet markets:', error);
    return { markets: [], isMock: false };
  }
}
