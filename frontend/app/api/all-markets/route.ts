import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export const dynamic = 'force-dynamic';

/**
 * GET /api/all-markets
 * Get all markets from database (fast cached access)
 *
 * Query params:
 * - platform: Filter by platform (polymarket, limitless, etc.)
 * - status: Filter by status (open, closed, resolved)
 * - category: Filter by category
 * - limit: Max results (default 100)
 * - offset: Pagination offset
 * - search: Search in title/question
 * - sort: Sort field (volume, volume24h, liquidity, expiresAt)
 * - order: Sort order (asc, desc)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const platform = searchParams.get('platform');
  const status = searchParams.get('status') || 'open';
  const category = searchParams.get('category');
  const limit = Math.min(500, parseInt(searchParams.get('limit') || '100'));
  const offset = parseInt(searchParams.get('offset') || '0');
  const search = searchParams.get('search');
  const sort = searchParams.get('sort') || 'volume';
  const order = searchParams.get('order') === 'asc' ? true : false;

  try {
    let query = supabase
      .from('unified_markets')
      .select('*', { count: 'exact' });

    // Apply filters
    if (platform) {
      query = query.eq('platform', platform);
    }
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (category) {
      query = query.eq('category', category);
    }
    if (search) {
      query = query.or(`title.ilike.%${search}%,question.ilike.%${search}%`);
    }

    // Apply sorting
    const sortField = ['volume', 'volume_24h', 'liquidity', 'expires_at', 'fetched_at'].includes(sort)
      ? sort
      : 'volume';
    query = query.order(sortField, { ascending: order, nullsFirst: false });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    // Transform data to match frontend expectations
    const markets = (data || []).map(row => ({
      id: row.id,
      platform: row.platform,
      externalId: row.external_id,
      title: row.title,
      question: row.question,
      description: row.description,
      category: row.category,
      outcomes: row.outcomes,
      status: row.status,
      yesPrice: row.yes_price,
      noPrice: row.no_price,
      volume: row.volume,
      volume24h: row.volume_24h,
      liquidity: row.liquidity,
      expiresAt: row.expires_at ? new Date(row.expires_at).getTime() : undefined,
      closesAt: row.closes_at ? new Date(row.closes_at).getTime() : undefined,
      metadata: row.metadata,
      chain: row.chain,
      currency: row.currency,
      fetchedAt: row.fetched_at ? new Date(row.fetched_at).getTime() : undefined,
    }));

    return NextResponse.json({
      success: true,
      data: markets,
      count: markets.length,
      total: count || 0,
      hasMore: offset + markets.length < (count || 0),
      filters: { platform, status, category, search },
      pagination: { limit, offset },
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('All markets API error:', error);

    // Check if table doesn't exist
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      return NextResponse.json({
        success: false,
        data: [],
        count: 0,
        total: 0,
        error: 'Markets table not initialized. Run /api/setup-tables first.',
        timestamp: Date.now(),
      }, { status: 503 });
    }

    return NextResponse.json({
      success: false,
      data: [],
      count: 0,
      error: error.message,
      timestamp: Date.now(),
    }, { status: 500 });
  }
}

/**
 * GET /api/all-markets/stats
 * Get market statistics by platform
 */
export async function POST(request: NextRequest) {
  try {
    const { data, error } = await supabase
      .from('unified_markets')
      .select('platform, volume, status');

    if (error) throw error;

    const stats: Record<string, {
      total: number;
      open: number;
      closed: number;
      resolved: number;
      totalVolume: number;
    }> = {};

    for (const row of data || []) {
      if (!stats[row.platform]) {
        stats[row.platform] = { total: 0, open: 0, closed: 0, resolved: 0, totalVolume: 0 };
      }
      stats[row.platform].total++;
      stats[row.platform][row.status as 'open' | 'closed' | 'resolved']++;
      stats[row.platform].totalVolume += row.volume || 0;
    }

    // Get sync status
    const { data: syncStatus } = await supabase
      .from('market_sync_status')
      .select('*');

    return NextResponse.json({
      success: true,
      stats,
      syncStatus: syncStatus || [],
      timestamp: Date.now(),
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: Date.now(),
    }, { status: 500 });
  }
}
