import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/resolve-all
 * Resolves pending simulated trades across ALL platforms
 *
 * This endpoint calls each platform's resolve route and aggregates results.
 * Useful for cron jobs that need to resolve all platforms at once.
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const baseUrl = request.nextUrl.origin;

  const results: Record<string, any> = {};
  let totalResolved = 0;
  let totalPending = 0;
  const errors: string[] = [];

  // List of platform resolve endpoints (12 platforms)
  const platforms = [
    { name: 'dreamdex', path: '/api/dreamdex/resolve' },
    { name: 'polymarket', path: '/api/polymarket/resolve' },
    { name: 'overtime', path: '/api/overtime/resolve' },
    { name: 'limitless', path: '/api/limitless/resolve' },
    { name: 'speedmarkets', path: '/api/speedmarkets/resolve' },
    { name: 'azuro', path: '/api/azuro/resolve' },
    { name: 'sxbet', path: '/api/sxbet/resolve' },
    { name: 'gnosis', path: '/api/gnosis/resolve' },
    { name: 'drift', path: '/api/drift/resolve' },
    { name: 'kalshi', path: '/api/kalshi/resolve' },
    { name: 'manifold', path: '/api/manifold/resolve' },
    { name: 'metaculus', path: '/api/metaculus/resolve' },
  ];

  // Call each platform's resolve endpoint
  for (const platform of platforms) {
    // Check for timeout
    if (Date.now() - startTime > 50000) {
      errors.push(`Timeout: skipped ${platform.name} and remaining platforms`);
      break;
    }

    try {
      const response = await fetch(`${baseUrl}${platform.path}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(15000),
      });

      if (response.ok) {
        const data = await response.json();
        results[platform.name] = {
          resolved: data.resolved || 0,
          pending: data.pending || 0,
          wins: data.wins || 0,
          losses: data.losses || 0,
          winRate: data.winRate || 'N/A',
          duration: data.duration || 0,
        };
        totalResolved += data.resolved || 0;
        totalPending += data.pending || 0;
      } else {
        const errorText = await response.text().catch(() => 'Unknown error');
        results[platform.name] = { error: `HTTP ${response.status}` };
        errors.push(`${platform.name}: ${response.status}`);
      }
    } catch (error: any) {
      results[platform.name] = { error: error.message };
      errors.push(`${platform.name}: ${error.message}`);
    }
  }

  return NextResponse.json({
    success: errors.length === 0,
    totalResolved,
    totalPending,
    platforms: results,
    errors: errors.length > 0 ? errors : undefined,
    duration: Date.now() - startTime,
    timestamp: new Date().toISOString(),
  });
}
