import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const LIMITLESS_API = 'https://api.limitless.exchange';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  // Limitless API has a max limit of 25
  const limit = Math.min(25, parseInt(searchParams.get('limit') || '20'));

  try {
    const response = await fetch(
      `${LIMITLESS_API}/markets/active?limit=${limit}&sortBy=high_value`,
      {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!response.ok) throw new Error(`Limitless error: ${response.status}`);

    const result = await response.json();
    const rawMarkets = result.data || [];

    const now = Date.now();
    const markets = rawMarkets
      .filter((m: any) => !m.expired && m.status === 'FUNDED')
      .map((m: any) => {
        const rawYes = m.prices?.[0] || 0.5;
        const rawNo = m.prices?.[1] || 0.5;
        // Normalize: if value > 1 it's already a percentage, otherwise multiply by 100
        const yesPercent = rawYes > 1 ? rawYes : rawYes * 100;
        const noPercent = rawNo > 1 ? rawNo : rawNo * 100;
        // Store decimal prices for trade calculations
        const yesPrice = rawYes > 1 ? rawYes / 100 : rawYes;
        const noPrice = rawNo > 1 ? rawNo / 100 : rawNo;
        const volume = parseFloat(m.volumeFormatted || '0');
        const expiresAtMs = m.expirationTimestamp || (m.expirationDate ? new Date(m.expirationDate).getTime() : now + 86400000);
        const expiresAt = Math.floor(expiresAtMs / 1000);
        const timeRemaining = Math.max(0, Math.floor((expiresAtMs - now) / 1000));

        return {
          id: `limitless-${m.id}`,
          platform: 'limitless' as const,
          conditionId: m.conditionId,
          slug: m.slug,
          title: m.title,
          question: m.title,
          description: m.description?.slice(0, 200),
          category: m.categories?.[0] || 'General',
          outcomes: ['Yes', 'No'],
          probabilities: [yesPercent, noPercent], // Component expects percentages (0-100)
          status: 'active' as const, // Component expects 'active' not 'open'
          yesPrice,
          noPrice,
          volume,
          liquidity: volume * 0.1, // Estimate liquidity as 10% of volume
          expirationDate: m.expirationDate,
          expiresAt,
          timeRemaining, // Component needs this for countdown
          tags: m.tags || [],
        };
      });

    return NextResponse.json({
      success: true,
      data: markets,
      count: markets.length,
      totalAvailable: result.totalMarketsCount || markets.length,
      isMock: false,
      platform: 'Limitless',
      chain: 'Base',
      currency: 'USDC',
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('Limitless API error:', error.message);
    return NextResponse.json({
      success: false,
      data: [],
      count: 0,
      isMock: false,
      platform: 'Limitless',
      error: error.message,
      timestamp: Date.now(),
    }, { status: 503 });
  }
}
