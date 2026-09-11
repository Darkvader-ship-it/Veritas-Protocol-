import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      followerAddress,
      traderAddress,
      allocationPercentage,
      maxBetAmount,
      platforms,
    } = body;

    // Validation
    if (!followerAddress || !traderAddress) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (followerAddress.toLowerCase() === traderAddress.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: 'Cannot copy your own trades' },
        { status: 400 }
      );
    }

    if (allocationPercentage < 1 || allocationPercentage > 100) {
      return NextResponse.json(
        { success: false, error: 'Allocation must be between 1-100%' },
        { status: 400 }
      );
    }

    // Get or create users in database
    const { data: followerUser, error: followerError } = await supabase
      .from('users')
      .upsert({ wallet_address: followerAddress.toLowerCase() }, { onConflict: 'wallet_address' })
      .select()
      .single();

    const { data: traderUser, error: traderError } = await supabase
      .from('users')
      .upsert({ wallet_address: traderAddress.toLowerCase() }, { onConflict: 'wallet_address' })
      .select()
      .single();

    if (followerError || traderError) {
      console.error('User creation error:', followerError || traderError);
      return NextResponse.json(
        { success: false, error: 'Failed to create user records' },
        { status: 500 }
      );
    }

    // Get platform IDs if platforms specified (for now, support all platforms if empty)
    let platformId = null;
    if (platforms && platforms.length === 1) {
      const { data: platform } = await supabase
        .from('platforms')
        .select('id')
        .eq('name', platforms[0])
        .single();

      platformId = platform?.id || null;
    }

    // Check if already following
    const { data: existingFollow } = await supabase
      .from('copy_follows')
      .select('*')
      .eq('follower_id', followerUser.id)
      .eq('trader_id', traderUser.id)
      .eq('platform_id', platformId)
      .single();

    if (existingFollow) {
      // Update existing follow
      const { data: updated, error: updateError } = await supabase
        .from('copy_follows')
        .update({
          allocation_percentage: allocationPercentage,
          max_bet_amount: maxBetAmount,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingFollow.id)
        .select()
        .single();

      if (updateError) {
        console.error('Update error:', updateError);
        return NextResponse.json(
          { success: false, error: 'Failed to update copy trading settings' },
          { status: 500 }
        );
      }

      console.log(`✅ Copy trading updated: ${followerAddress.slice(0, 6)}... → ${traderAddress.slice(0, 6)}...`);

      return NextResponse.json({
        success: true,
        message: 'Copy trading settings updated',
        follow: updated,
      });
    }

    // Create new follow
    const { data: newFollow, error: insertError } = await supabase
      .from('copy_follows')
      .insert({
        follower_id: followerUser.id,
        trader_id: traderUser.id,
        platform_id: platformId,
        allocation_percentage: allocationPercentage,
        max_bet_amount: maxBetAmount,
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return NextResponse.json(
        { success: false, error: 'Failed to activate copy trading' },
        { status: 500 }
      );
    }

    console.log(`✅ Copy trading activated: ${followerAddress.slice(0, 6)}... → ${traderAddress.slice(0, 6)}...`);
    console.log(`   Allocation: ${allocationPercentage}%, Max: ${maxBetAmount}, Platforms: ${platforms?.join(', ') || 'All'}`);

    return NextResponse.json({
      success: true,
      message: 'Copy trading activated successfully',
      follow: newFollow,
    });
  } catch (error: any) {
    console.error('Copy trade follow error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const followerAddress = searchParams.get('follower') || searchParams.get('address');
    const traderAddress = searchParams.get('trader');

    let query = supabase
      .from('copy_follows')
      .select(`
        *,
        follower:follower_id(wallet_address, username),
        trader:trader_id(
          wallet_address,
          username
        ),
        platform:platform_id(name)
      `);

    if (followerAddress) {
      // Get follower user ID first
      const { data: followerUser } = await supabase
        .from('users')
        .select('id')
        .eq('wallet_address', followerAddress.toLowerCase())
        .single();

      if (followerUser) {
        query = query.eq('follower_id', followerUser.id);
      }
    }

    if (traderAddress) {
      // Get trader user ID first
      const { data: traderUser } = await supabase
        .from('users')
        .select('id')
        .eq('wallet_address', traderAddress.toLowerCase())
        .single();

      if (traderUser) {
        query = query.eq('trader_id', traderUser.id);
      }
    }

    const { data: follows, error } = await query;

    if (error) {
      console.error('Query error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch copy follows' },
        { status: 500 }
      );
    }

    // Enrich follows with trader stats from leaderboard_view
    const enrichedFollows = await Promise.all(
      (follows || []).map(async (follow: any) => {
        const { data: stats } = await supabase
          .from('leaderboard_view')
          .select('total_bets, wins, win_rate, total_score, total_volume')
          .eq('wallet_address', follow.trader.wallet_address)
          .single();

        return {
          ...follow,
          trader: {
            ...follow.trader,
            stats: stats || {
              total_bets: 0,
              wins: 0,
              win_rate: 0,
              total_score: 0,
              total_volume: '0',
            },
          },
        };
      })
    );

    return NextResponse.json({
      success: true,
      follows: enrichedFollows,
      count: enrichedFollows.length,
    });
  } catch (error: any) {
    console.error('Copy trade GET error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const followId = searchParams.get('followId') || searchParams.get('id');

    if (!followId) {
      return NextResponse.json(
        { success: false, error: 'Follow ID required' },
        { status: 400 }
      );
    }

    // Soft delete by setting is_active to false
    const { data: deleted, error } = await supabase
      .from('copy_follows')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', followId)
      .select(`
        *,
        follower:follower_id(wallet_address),
        trader:trader_id(wallet_address)
      `)
      .single();

    if (error) {
      console.error('Delete error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to stop copy trading' },
        { status: 500 }
      );
    }

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Follow not found' },
        { status: 404 }
      );
    }

    console.log(`🛑 Copy trading stopped: ${deleted.follower?.wallet_address?.slice(0, 6)}... → ${deleted.trader?.wallet_address?.slice(0, 6)}...`);

    return NextResponse.json({
      success: true,
      message: 'Copy trading stopped',
      deleted,
    });
  } catch (error: any) {
    console.error('Copy trade delete error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { followId, isActive } = body;

    if (!followId || isActive === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const { data: updated, error } = await supabase
      .from('copy_follows')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', followId)
      .select()
      .single();

    if (error) {
      console.error('Update error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to update follow status' },
        { status: 500 }
      );
    }

    console.log(`✅ Copy trading ${isActive ? 'resumed' : 'paused'}: ${followId}`);

    return NextResponse.json({
      success: true,
      message: `Copy trading ${isActive ? 'resumed' : 'paused'}`,
      follow: updated,
    });
  } catch (error: any) {
    console.error('Copy trade PATCH error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
