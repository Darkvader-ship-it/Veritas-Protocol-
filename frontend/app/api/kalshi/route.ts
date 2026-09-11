import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const KALSHI_API = 'https://api.elections.kalshi.com/trade-api/v2';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(100, parseInt(searchParams.get('limit') || '50'));

  try {
    // Get events first for cleaner data
    const eventsRes = await fetch(`${KALSHI_API}/events?status=open&limit=${limit}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000),
    });

    if (!eventsRes.ok) throw new Error(`Kalshi events error: ${eventsRes.status}`);
    
    const eventsData = await eventsRes.json();
    const events = eventsData.events || [];

    // Get markets for each event
    const markets = [];
    
    for (const event of events.slice(0, Math.min(limit, 20))) {
      try {
        const marketsRes = await fetch(
          `${KALSHI_API}/markets?event_ticker=${event.event_ticker}&status=open&limit=5`,
          { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(5000) }
        );
        
        if (marketsRes.ok) {
          const marketsData = await marketsRes.json();
          for (const m of (marketsData.markets || []).slice(0, 2)) {
            const yesAsk = m.yes_ask || 50;
            const yesBid = m.yes_bid || 50;
            const yesPrice = Math.max(0.01, Math.min(0.99, ((yesAsk + yesBid) / 2) / 100));
            
            markets.push({
              id: `kalshi-${m.ticker}`,
              ticker: m.ticker,
              eventTicker: event.event_ticker,
              title: event.title,
              subtitle: event.sub_title || m.subtitle,
              category: event.category || 'Events',
              outcomes: [
                { id: 'yes', name: 'Yes', odds: 1 / yesPrice, probability: yesPrice },
                { id: 'no', name: 'No', odds: 1 / (1 - yesPrice), probability: 1 - yesPrice },
              ],
              status: 'open',
              yesPrice,
              noPrice: 1 - yesPrice,
              volume: m.volume || 0,
              volume24h: m.volume_24h || 0,
              openInterest: m.open_interest || 0,
              closeTime: m.close_time ? new Date(m.close_time).getTime() : undefined,
            });
          }
        }
      } catch (e) {
        // Skip this event
      }
      
      if (markets.length >= limit) break;
    }

    return NextResponse.json({
      success: true,
      data: markets.slice(0, limit),
      count: markets.length,
      isMock: false,
      platform: 'Kalshi',
      chain: 'Off-chain (CFTC Regulated)',
      currency: 'USD',
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('Kalshi API error:', error.message);
    return NextResponse.json({
      success: false, data: [], count: 0, isMock: false,
      platform: 'Kalshi', error: error.message, timestamp: Date.now(),
    }, { status: 503 });
  }
}
