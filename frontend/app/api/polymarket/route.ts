import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const POLYMARKET_API = 'https://gamma-api.polymarket.com';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(100, parseInt(searchParams.get('limit') || '50'));

  try {
    // Fetch active, open markets with highest volume
    const response = await fetch(
      `${POLYMARKET_API}/markets?active=true&closed=false&limit=${limit}&order=volume24hr&ascending=false`,
      {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!response.ok) throw new Error(`Polymarket error: ${response.status}`);

    const rawMarkets = await response.json();
    
    const markets = rawMarkets
      .filter((m: any) => m.active && !m.closed && m.question)
      .map((m: any) => {
        const prices = JSON.parse(m.outcomePrices || '["0.5","0.5"]');
        const outcomes = JSON.parse(m.outcomes || '["Yes","No"]');
        const yesPrice = parseFloat(prices[0]) || 0.5;
        const noPrice = parseFloat(prices[1]) || 0.5;
        
        return {
          id: `poly-${m.id}`,
          conditionId: m.conditionId,
          slug: m.slug,
          question: m.question,
          title: m.question,
          description: m.description?.slice(0, 200),
          category: m.events?.[0]?.category || 'General',
          outcomes: outcomes.map((name: string, i: number) => ({
            id: name.toLowerCase(),
            name: name,
            odds: parseFloat(prices[i]) > 0.01 ? 1 / parseFloat(prices[i]) : 100,
            probability: parseFloat(prices[i]) || 0.5,
          })),
          status: m.closed ? 'closed' : 'open',
          yesPrice,
          noPrice,
          volume: m.volumeNum || 0,
          volume24h: m.volume24hr || 0,
          liquidity: m.liquidityNum || 0,
          endDate: m.endDate,
          image: m.image,
        };
      });

    return NextResponse.json({
      success: true,
      data: markets,
      count: markets.length,
      isMock: false,
      platform: 'Polymarket',
      chain: 'Polygon',
      currency: 'USDC',
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('Polymarket API error:', error.message);
    return NextResponse.json({
      success: false,
      data: [],
      count: 0,
      isMock: false,
      platform: 'Polymarket',
      error: error.message,
      timestamp: Date.now(),
    }, { status: 503 });
  }
}
