import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const dynamic = 'force-dynamic';

/**
 * GET /api/traders/search
 * Search traders by name, email, Twitter username, or wallet address
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!query || query.length < 2) {
      return NextResponse.json({
        success: false,
        error: 'Query must be at least 2 characters',
      }, { status: 400 });
    }

    const searchQuery = `%${query.toLowerCase()}%`;

    // Search across multiple fields in traders table
    const { data: traders, error } = await supabase
      .from('traders')
      .select(`
        wallet_address,
        username,
        email,
        twitter_username,
        total_score,
        win_rate,
        total_bets,
        wins,
        losses,
        total_volume,
        rank,
        created_at
      `)
      .or(`
        wallet_address.ilike.${searchQuery},
        username.ilike.${searchQuery},
        email.ilike.${searchQuery},
        twitter_username.ilike.${searchQuery}
      `)
      .order('total_score', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Search error:', error);
      return NextResponse.json({
        success: false,
        error: 'Search failed',
      }, { status: 500 });
    }

    // Format results
    const results = (traders || []).map((trader) => ({
      address: trader.wallet_address,
      username: trader.username,
      email: trader.email,
      twitter: trader.twitter_username,
      veritasScore: trader.total_score || 0,
      winRate: trader.win_rate || 0,
      totalBets: trader.total_bets || 0,
      wins: trader.wins || 0,
      losses: trader.losses || 0,
      volume: trader.total_volume || '0',
      rank: trader.rank,
      joinedAt: trader.created_at,
    }));

    return NextResponse.json({
      success: true,
      query,
      results,
      count: results.length,
    });
  } catch (error: any) {
    console.error('Search API error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error',
    }, { status: 500 });
  }
}
