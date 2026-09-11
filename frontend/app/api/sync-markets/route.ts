import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Import fetchers to register them
import '@/lib/fetchers';

import {
  fetchAllPlatformMarkets,
  saveMarketsToDatabase,
  getMarketStats,
  getPlatformFetcher,
} from '@/lib/market-fetcher';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60 seconds for full sync

const SUPPORTED_PLATFORMS = [
  'polymarket',
  'limitless',
  'manifold',
  'kalshi',
  'azuro',
  'sxbet',
  'metaculus',
  'overtime',
  'dreamdex',
  'speedmarkets',
  'drift',
  'gnosis',
];

/**
 * GET /api/sync-markets
 * Sync all markets from all platforms to database
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get('platform');
  const forceRefresh = searchParams.get('force') === 'true';

  const startTime = Date.now();
  const results: {
    platform: string;
    count: number;
    volume: number;
    duration: number;
    error?: string;
  }[] = [];

  const platformsToSync = platform
    ? [platform]
    : SUPPORTED_PLATFORMS;

  console.log(`[Sync] Starting sync for: ${platformsToSync.join(', ')}`);

  for (const platformName of platformsToSync) {
    const platformStart = Date.now();

    try {
      // Update sync status to 'syncing'
      await supabase
        .from('market_sync_status')
        .upsert({
          platform: platformName,
          status: 'syncing',
          updated_at: new Date().toISOString(),
        });

      const fetcher = getPlatformFetcher(platformName);

      if (!fetcher) {
        results.push({
          platform: platformName,
          count: 0,
          volume: 0,
          duration: Date.now() - platformStart,
          error: 'No fetcher registered',
        });
        continue;
      }

      // Fetch all markets
      const markets = await fetcher.fetchAll({ forceRefresh });

      // Calculate total volume
      const totalVolume = markets.reduce((sum, m) => sum + (m.volume || 0), 0);

      // Save to database
      await saveMarketsToDatabase(markets);

      // Update sync status
      await supabase
        .from('market_sync_status')
        .upsert({
          platform: platformName,
          last_sync_at: new Date().toISOString(),
          markets_count: markets.length,
          total_volume: totalVolume,
          status: 'success',
          error: null,
          duration_ms: Date.now() - platformStart,
          updated_at: new Date().toISOString(),
        });

      results.push({
        platform: platformName,
        count: markets.length,
        volume: totalVolume,
        duration: Date.now() - platformStart,
      });

      console.log(`[Sync] ${platformName}: ${markets.length} markets, $${totalVolume.toLocaleString()} volume`);
    } catch (error: any) {
      console.error(`[Sync] ${platformName} error:`, error.message);

      // Update sync status with error
      await supabase
        .from('market_sync_status')
        .upsert({
          platform: platformName,
          status: 'error',
          error: error.message,
          duration_ms: Date.now() - platformStart,
          updated_at: new Date().toISOString(),
        });

      results.push({
        platform: platformName,
        count: 0,
        volume: 0,
        duration: Date.now() - platformStart,
        error: error.message,
      });
    }
  }

  const totalMarkets = results.reduce((sum, r) => sum + r.count, 0);
  const totalVolume = results.reduce((sum, r) => sum + r.volume, 0);
  const totalDuration = Date.now() - startTime;

  console.log(`[Sync] Complete: ${totalMarkets} markets, $${totalVolume.toLocaleString()}, ${totalDuration}ms`);

  return NextResponse.json({
    success: true,
    summary: {
      totalMarkets,
      totalVolume,
      duration: totalDuration,
      platforms: results.length,
    },
    results,
    timestamp: new Date().toISOString(),
  });
}

/**
 * POST /api/sync-markets
 * Sync a specific platform or all platforms
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { platform, force } = body;

  const url = new URL(request.url);
  if (platform) url.searchParams.set('platform', platform);
  if (force) url.searchParams.set('force', 'true');

  const newRequest = new NextRequest(url, { method: 'GET' });
  return GET(newRequest);
}
