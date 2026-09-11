import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const MANIFOLD_API = 'https://api.manifold.markets/v0';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(200, parseInt(searchParams.get('limit') || '50'));

  try {
    const response = await fetch(`${MANIFOLD_API}/markets?limit=${limit}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) throw new Error(`Manifold API error: ${response.status}`);

    const rawMarkets = await response.json();
    
    const markets = rawMarkets
      .filter((m: any) => !m.isResolved)
      .map((m: any) => {
        const prob = m.probability || 0.5;
        let outcomes;
        if (m.outcomeType === 'BINARY') {
          outcomes = [
            { id: 'YES', name: 'Yes', odds: prob > 0.01 ? 1 / prob : 100, probability: prob },
            { id: 'NO', name: 'No', odds: (1-prob) > 0.01 ? 1 / (1-prob) : 100, probability: 1 - prob },
          ];
        } else if (m.answers && Array.isArray(m.answers)) {
          outcomes = m.answers.slice(0, 6).map((a: any) => ({
            id: a.id, name: a.text?.slice(0, 50) || 'Option',
            probability: a.prob || 0.2, odds: a.prob > 0.01 ? 1 / a.prob : 100,
          }));
        } else {
          outcomes = [{ id: 'YES', name: 'Yes', odds: 2, probability: 0.5 }, { id: 'NO', name: 'No', odds: 2, probability: 0.5 }];
        }
        return {
          id: `mf-${m.id}`, slug: m.slug, question: m.question, title: m.question, category: 'General',
          outcomeType: m.outcomeType, outcomes, status: 'open', probability: prob,
          volume: m.volume || 0, liquidity: m.totalLiquidity || 0, closeTime: m.closeTime,
          creatorUsername: m.creatorUsername, url: m.url || `https://manifold.markets/${m.creatorUsername}/${m.slug}`,
        };
      });

    return NextResponse.json({
      success: true, data: markets, count: markets.length, isMock: false,
      platform: 'Manifold Markets', chain: 'Off-chain', currency: 'Mana (play money)', timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('Manifold API error:', error.message);
    return NextResponse.json({
      success: false, data: [], count: 0, isMock: false, platform: 'Manifold Markets',
      error: error.message, timestamp: Date.now(),
    }, { status: 503 });
  }
}
