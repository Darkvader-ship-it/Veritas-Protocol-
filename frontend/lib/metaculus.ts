/**
 * Metaculus Forecasting Platform Fetcher
 *
 * Metaculus is a forecasting platform where users make predictions
 * on real-world events. Uses reputation-based scoring, not money.
 *
 * API Endpoint: https://www.metaculus.com/api2
 */

export interface MetaculusPredictionMarket {
  id: string;
  questionId: number;
  title: string;
  description?: string;
  category: string;
  type: 'binary' | 'numeric' | 'date' | 'multiple_choice';
  outcomes: {
    id: string;
    name: string;
    odds: number;
    probability: number;
  }[];
  status: 'open' | 'resolved' | 'closed';
  communityPrediction?: number;
  numPredictions: number;
  numForecasters: number;
  resolveTime?: number;
  resolution?: string | number;
  url: string;
}

export async function fetchMetaculusMarkets(): Promise<{
  markets: MetaculusPredictionMarket[];
  isMock: boolean;
}> {
  try {
    const response = await fetch('/api/metaculus?limit=100');

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !data.data || data.data.length === 0) {
      return { markets: [], isMock: false };
    }

    const markets: MetaculusPredictionMarket[] = data.data.map((m: any) => {
      const prob = m.communityPrediction || 0.5;
      return {
        id: m.id,
        questionId: m.questionId,
        title: m.title,
        description: m.description,
        category: m.category || 'Forecasting',
        type: m.type || 'binary',
        outcomes: m.outcomes || [
          { id: 'yes', name: 'Yes', odds: prob > 0 ? 1 / prob : 2, probability: prob },
          { id: 'no', name: 'No', odds: (1 - prob) > 0 ? 1 / (1 - prob) : 2, probability: 1 - prob },
        ],
        status: m.status || 'open',
        communityPrediction: prob,
        numPredictions: m.numPredictions || 0,
        numForecasters: m.numForecasters || 0,
        resolveTime: m.resolveTime,
        resolution: m.resolution,
        url: m.url || `https://www.metaculus.com/questions/${m.questionId}`,
      };
    });

    return { markets, isMock: data.isMock || false };
  } catch (error) {
    console.error('Error fetching Metaculus questions:', error);
    return { markets: [], isMock: false };
  }
}
