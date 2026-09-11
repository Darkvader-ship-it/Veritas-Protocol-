/**
 * Azuro Protocol Market Fetcher
 */

export interface AzuroPredictionMarket {
  id: string;
  gameId: string;
  conditionId: string;
  sport: string;
  league: string;
  title: string;
  participants: string[];
  startsAt: number;
  status: string;
  outcomes: {
    id: string;
    name: string;
    odds: number;
  }[];
  network: string;
}

export async function fetchAzuroMarkets(): Promise<{
  markets: AzuroPredictionMarket[];
  isMock: boolean;
}> {
  try {
    // Fetch from all networks with higher limit
    const response = await fetch('/api/azuro?limit=100');

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !data.data || data.data.length === 0) {
      return { markets: [], isMock: false };
    }

    const markets: AzuroPredictionMarket[] = data.data.map((m: any) => ({
      id: m.id,
      gameId: m.gameId,
      conditionId: m.conditionId,
      sport: m.sport,
      league: m.league,
      title: m.title,
      participants: m.participants || [],
      startsAt: m.startsAt,
      status: m.status,
      outcomes: m.outcomes || [],
      network: m.network,
    }));

    return { markets, isMock: data.isMock || false };
  } catch (error) {
    console.error('Error fetching Azuro markets:', error);
    return { markets: [], isMock: false };
  }
}
