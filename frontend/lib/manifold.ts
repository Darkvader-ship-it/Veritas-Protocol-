/**
 * Manifold Markets Fetcher
 *
 * Manifold is a play-money prediction market platform.
 * Uses "Mana" (M$) as currency. Markets resolve based on real events.
 *
 * API Endpoint: https://api.manifold.markets/v0
 */

export interface ManifoldPredictionMarket {
  id: string;
  slug: string;
  question: string;
  description?: string;
  category: string;
  outcomeType: 'BINARY' | 'MULTIPLE_CHOICE' | 'FREE_RESPONSE' | 'NUMERIC';
  outcomes: {
    id: string;
    name: string;
    odds: number;
    probability: number;
  }[];
  status: 'open' | 'resolved';
  probability?: number;
  volume: number;
  liquidity: number;
  closeTime?: number;
  resolution?: string;
  creatorUsername: string;
  url: string;
}

export async function fetchManifoldMarkets(): Promise<{
  markets: ManifoldPredictionMarket[];
  isMock: boolean;
}> {
  try {
    const response = await fetch('/api/manifold?limit=100');

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !data.data || data.data.length === 0) {
      return { markets: [], isMock: false };
    }

    const markets: ManifoldPredictionMarket[] = data.data.map((m: any) => {
      const prob = m.probability || 0.5;
      return {
        id: m.id,
        slug: m.slug,
        question: m.question || m.title,
        description: m.description,
        category: m.category || m.groupSlugs?.[0] || 'General',
        outcomeType: m.outcomeType || 'BINARY',
        outcomes: m.outcomes || [
          { id: 'YES', name: 'Yes', odds: 1 / prob, probability: prob },
          { id: 'NO', name: 'No', odds: 1 / (1 - prob), probability: 1 - prob },
        ],
        status: m.status || (m.isResolved ? 'resolved' : 'open'),
        probability: prob,
        volume: m.volume || 0,
        liquidity: m.liquidity || m.totalLiquidity || 0,
        closeTime: m.closeTime,
        resolution: m.resolution,
        creatorUsername: m.creatorUsername,
        url: m.url || `https://manifold.markets/${m.creatorUsername}/${m.slug}`,
      };
    });

    return { markets, isMock: data.isMock || false };
  } catch (error) {
    console.error('Error fetching Manifold markets:', error);
    return { markets: [], isMock: false };
  }
}
