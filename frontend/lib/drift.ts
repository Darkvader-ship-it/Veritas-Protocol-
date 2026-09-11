/**
 * Drift Protocol BET Market Fetcher
 *
 * Drift is a Solana-based perpetuals DEX with prediction markets.
 * For prediction markets, price represents probability (0 to 1).
 *
 * API Endpoints:
 * - Data API: https://data.api.drift.trade
 * - DLOB API: https://dlob.drift.trade
 */

export interface DriftPredictionMarket {
  id: string;
  marketIndex: number;
  symbol: string;
  title: string;
  description?: string;
  category: string;
  outcomes: {
    id: string;
    name: string;
    odds: number;
    probability: number;
  }[];
  status: 'open' | 'resolved';
  oraclePrice: number;
  volume24h: number;
  openInterest: number;
  fundingRate?: number;
  isPredictionMarket: boolean;
}

export async function fetchDriftMarkets(): Promise<{
  markets: DriftPredictionMarket[];
  isMock: boolean;
}> {
  try {
    const response = await fetch('/api/drift?limit=100');

    if (!response.ok) {
      if (response.status === 503 || response.status === 429) return { markets: [], isMock: false };
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !data.data || data.data.length === 0) {
      return { markets: [], isMock: false };
    }

    const markets: DriftPredictionMarket[] = data.data.map((m: any) => ({
      id: m.id,
      marketIndex: m.marketIndex,
      symbol: m.symbol,
      title: m.title,
      description: m.description,
      category: m.category || 'Crypto',
      outcomes: m.outcomes || [
        { id: 'yes', name: 'Yes', odds: 2, probability: 0.5 },
        { id: 'no', name: 'No', odds: 2, probability: 0.5 },
      ],
      status: m.status || 'open',
      oraclePrice: m.oraclePrice || 0.5,
      volume24h: m.volume24h || 0,
      openInterest: m.openInterest || 0,
      fundingRate: m.fundingRate,
      isPredictionMarket: m.isPredictionMarket || false,
    }));

    return { markets, isMock: data.isMock || false };
  } catch (error) {
    // 503 is expected when Drift DLOB is unavailable - don't spam console
    if (String(error).includes('503')) return { markets: [], isMock: false };
    console.warn('Drift markets unavailable:', (error as any)?.message);
    return { markets: [], isMock: false };
  }
}
