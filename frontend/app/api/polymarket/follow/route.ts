import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

/**
 * GET /api/polymarket/follow
 * Get followed Polymarket leaders for a user
 *
 * Query params:
 * - follower: Wallet address of the follower
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const follower = searchParams.get('follower')?.toLowerCase();

    if (!follower) {
      return NextResponse.json({ error: 'Follower address required' }, { status: 400 });
    }

    const { data: follows, error } = await supabase
      .from('polymarket_follows')
      .select('*')
      .eq('follower', follower)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching Polymarket follows:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      follows: follows || [],
      count: follows?.length || 0,
    });
  } catch (error: any) {
    console.error('Error in Polymarket follow GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/polymarket/follow
 * Follow a Polymarket leader
 *
 * Body:
 * - follower: Wallet address of the follower
 * - leader: Polymarket proxy wallet of the leader
 * - leaderUsername: Optional username
 * - allocationUsd: Max USD per trade (default 10)
 * - autoCopy: Whether to auto-copy trades (default false)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      follower,
      leader,
      leaderUsername,
      allocationUsd = 10,
      autoCopy = false,
    } = body;

    if (!follower || !leader) {
      return NextResponse.json(
        { error: 'Follower and leader addresses required' },
        { status: 400 }
      );
    }

    const followerLower = follower.toLowerCase();
    const leaderLower = leader.toLowerCase();

    // Check if already following
    const { data: existing } = await supabase
      .from('polymarket_follows')
      .select('id, is_active')
      .eq('follower', followerLower)
      .eq('leader', leaderLower)
      .single();

    if (existing) {
      // Reactivate if inactive
      if (!existing.is_active) {
        const { error: updateError } = await supabase
          .from('polymarket_follows')
          .update({
            is_active: true,
            allocation_usd: allocationUsd,
            auto_copy: autoCopy,
            leader_username: leaderUsername,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (updateError) {
          return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          message: 'Reactivated follow',
          followId: existing.id,
        });
      }

      return NextResponse.json({
        success: false,
        message: 'Already following this leader',
      });
    }

    // Create new follow
    const { data: newFollow, error: insertError } = await supabase
      .from('polymarket_follows')
      .insert({
        follower: followerLower,
        leader: leaderLower,
        leader_username: leaderUsername,
        allocation_usd: allocationUsd,
        auto_copy: autoCopy,
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating Polymarket follow:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully followed leader',
      follow: newFollow,
    });
  } catch (error: any) {
    console.error('Error in Polymarket follow POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/polymarket/follow
 * Unfollow a Polymarket leader
 *
 * Body:
 * - follower: Wallet address of the follower
 * - leader: Polymarket proxy wallet of the leader
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { follower, leader } = body;

    if (!follower || !leader) {
      return NextResponse.json(
        { error: 'Follower and leader addresses required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('polymarket_follows')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('follower', follower.toLowerCase())
      .eq('leader', leader.toLowerCase());

    if (error) {
      console.error('Error unfollowing Polymarket leader:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully unfollowed leader',
    });
  } catch (error: any) {
    console.error('Error in Polymarket follow DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
