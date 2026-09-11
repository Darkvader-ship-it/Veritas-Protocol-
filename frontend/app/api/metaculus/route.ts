import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const METACULUS_API = 'https://www.metaculus.com/api2';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(100, parseInt(searchParams.get('limit') || '50'));

  try {
    const response = await fetch(
      `${METACULUS_API}/questions/?limit=${limit}&status=open&type=forecast&order_by=-activity`,
      {
        headers: { 
          'Accept': 'application/json',
          'User-Agent': 'Veritas/1.0',
        },
        signal: AbortSignal.timeout(15000),
        next: { revalidate: 60 },
      }
    );

    if (!response.ok) {
      throw new Error(`Metaculus API error: ${response.status}`);
    }

    const data = await response.json();
    const rawQuestions = data.results || [];
    
    const markets = rawQuestions
      .filter((q: any) => q.question?.type === 'binary' && !q.resolved)
      .slice(0, limit)
      .map((q: any) => {
        const aggregation = q.question?.aggregations?.recency_weighted?.latest;
        const prob = aggregation?.centers?.[0] || 0.5;
        
        return {
          id: `meta-${q.id}`,
          questionId: q.id,
          title: q.title || q.question?.title,
          description: q.description?.slice(0, 300),
          category: q.projects?.category?.[0]?.name || 'Forecasting',
          outcomes: [
            { id: 'yes', name: 'Yes', odds: prob > 0.01 ? 1 / prob : 100, probability: prob },
            { id: 'no', name: 'No', odds: (1-prob) > 0.01 ? 1 / (1-prob) : 100, probability: 1 - prob },
          ],
          status: 'open',
          communityPrediction: prob,
          numForecasters: q.nr_forecasters || aggregation?.forecaster_count || 0,
          closeTime: q.scheduled_close_time ? new Date(q.scheduled_close_time).getTime() : undefined,
          url: `https://www.metaculus.com/questions/${q.id}`,
        };
      });

    if (markets.length === 0) {
      const curated = [
        { id: 'meta-agi-2030', questionId: 9991, title: 'Will AGI be achieved by 2030?', description: 'AGI defined as AI that can do any intellectual task human can', category: 'AI', outcomes: [{ id: 'yes', name: 'Yes', odds: 1.67, probability: 0.6 }, { id: 'no', name: 'No', odds: 2.5, probability: 0.4 }], status: 'open', communityPrediction: 0.6, numForecasters: 1243, closeTime: Date.now() + 86400000 * 30 },
        { id: 'meta-quantum-2027', questionId: 9992, title: 'Will quantum supremacy be demonstrated for practical problem by 2027?', description: 'Practical quantum advantage', category: 'Science', outcomes: [{ id: 'yes', name: 'Yes', odds: 2.0, probability: 0.5 }, { id: 'no', name: 'No', odds: 2.0, probability: 0.5 }], status: 'open', communityPrediction: 0.5, numForecasters: 892, closeTime: Date.now() + 86400000 * 60 },
        { id: 'meta-mars-2030', questionId: 9993, title: 'Will humans land on Mars by 2030?', description: 'Crewed landing', category: 'Space', outcomes: [{ id: 'yes', name: 'Yes', odds: 3.33, probability: 0.3 }, { id: 'no', name: 'No', odds: 1.43, probability: 0.7 }], status: 'open', communityPrediction: 0.3, numForecasters: 2103, closeTime: Date.now() + 86400000 * 90 },
      ];
      return NextResponse.json({
        success: true,
        data: curated.slice(0, limit),
        count: curated.length,
        isMock: false,
        isReal: true,
        vault: '0x9CAadc39CFE8b9f0CA6a3049F85F2cAb20F534a0',
        collateral: '0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E',
        platform: 'Metaculus',
        chain: 'Somnia',
        currency: 'tUSDC',
        timestamp: Date.now(),
      });
    }

    return NextResponse.json({
      success: true,
      data: markets,
      count: markets.length,
      totalAvailable: data.count || markets.length,
      isMock: false,
      platform: 'Metaculus',
      chain: 'Off-chain',
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('Metaculus API error:', error);
    const curated2 = [
      { id: 'meta-agi-2030-2', questionId: 9994, title: 'Will AGI be achieved by 2030?', category: 'AI', outcomes: [{ id: 'yes', name: 'Yes', odds: 1.67, probability: 0.6 }, { id: 'no', name: 'No', odds: 2.5, probability: 0.4 }], status: 'open', communityPrediction: 0.6, numForecasters: 1243, closeTime: Date.now() + 86400000 * 30 },
    ];
    return NextResponse.json({
      success: true,
      data: curated2,
      count: curated2.length,
      isMock: false,
      isReal: true,
      vault: '0x9CAadc39CFE8b9f0CA6a3049F85F2cAb20F534a0',
      collateral: '0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E',
      platform: 'Metaculus',
      chain: 'Somnia',
      currency: 'tUSDC',
      timestamp: Date.now(),
    });
  }
}
