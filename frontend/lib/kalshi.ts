/**
 * Kalshi Market Fetcher
 *
 * Kalshi is a CFTC-regulated prediction exchange in the US.
 * Uses centralized order book with binary yes/no contracts.
 *
 * API Endpoint: https://trading-api.kalshi.com/v2
 */

export interface KalshiPredictionMarket {
  id: string;
  ticker: string;
  eventTicker: string;
  title: string;
  subtitle?: string;
  category: string;
  outcomes: {
    id: string;
    name: string;
    odds: number;
    probability: number;
  }[];
  status: 'open' | 'closed' | 'resolved';
  yesPrice: number;
  noPrice: number;
  volume: number;
  openInterest: number;
  closeTime?: number;
  result?: 'yes' | 'no';
}

export async function fetchKalshiMarkets(): Promise<{
  markets: KalshiPredictionMarket[];
  isMock: boolean;
}> {
  try {
    const response = await fetch('/api/kalshi?limit=100');

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !data.data || data.data.length === 0) {
      return { markets: [], isMock: false };
    }

    const markets: KalshiPredictionMarket[] = data.data.map((m: any) => {
      const yesPrice = m.yesPrice || m.yes_price || 0.5;
      return {
        id: m.id,
        ticker: m.ticker,
        eventTicker: m.eventTicker,
        title: m.title,
        subtitle: m.subtitle,
        category: m.category || 'Politics',
        outcomes: m.outcomes || [
          { id: 'yes', name: 'Yes', odds: 1 / yesPrice, probability: yesPrice },
          { id: 'no', name: 'No', odds: 1 / (1 - yesPrice), probability: 1 - yesPrice },
        ],
        status: m.status || 'open',
        yesPrice,
        noPrice: 1 - yesPrice,
        volume: m.volume || 0,
        openInterest: m.openInterest || 0,
        closeTime: m.closeTime,
        result: m.result,
      };
    });

    return { markets, isMock: data.isMock || false };
  } catch (error) {
    console.error('Error fetching Kalshi markets:', error);
    return { markets: [], isMock: false };
  }
}
