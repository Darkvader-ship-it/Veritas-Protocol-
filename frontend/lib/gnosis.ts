/**
 * Gnosis/Omen Protocol Market Fetcher
 *
 * Omen is a prediction market on Gnosis Chain using conditional tokens.
 * Markets resolve via Reality.eth oracle with arbitration by Kleros.
 */

export interface GnosisPredictionMarket {
  id: string;
  conditionId: string;
  questionId: string;
  title: string;
  category: string;
  outcomes: {
    id: string;
    name: string;
    odds: number;
    probability: number;
  }[];
  status: 'open' | 'pending' | 'resolved';
  volume: number;
  liquidity: number;
  resolvesAt?: number;
  resolvedOutcome?: string;
  creator: string;
  collateralToken: string;
}

export async function fetchGnosisMarkets(): Promise<{
  markets: GnosisPredictionMarket[];
  isMock: boolean;
}> {
  try {
    const response = await fetch('/api/gnosis?limit=100');

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !data.data || data.data.length === 0) {
      return { markets: [], isMock: false };
    }

    const markets: GnosisPredictionMarket[] = data.data.map((m: any) => ({
      id: m.id,
      conditionId: m.conditionId,
      questionId: m.questionId,
      title: m.title,
      category: m.category || 'General',
      outcomes: m.outcomes || [],
      status: m.status || 'open',
      volume: m.volume || 0,
      liquidity: m.liquidity || 0,
      resolvesAt: m.resolvesAt,
      resolvedOutcome: m.resolvedOutcome,
      creator: m.creator,
      collateralToken: m.collateralToken,
    }));

    return { markets, isMock: data.isMock || false };
  } catch (error) {
    console.error('Error fetching Gnosis/Omen markets:', error);
    return { markets: [], isMock: false };
  }
}
