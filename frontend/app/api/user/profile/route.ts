import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const dynamic = 'force-dynamic';

/**
 * GET /api/user/profile?address=0x...
 * Get user profile information including email
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json({
        success: false,
        error: 'Wallet address is required',
      }, { status: 400 });
    }

    const { data: trader, error } = await supabase
      .from('traders')
      .select('wallet_address, username, email, twitter_username, created_at')
      .eq('wallet_address', address.toLowerCase())
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Profile fetch error:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch profile',
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      profile: trader || null,
    });
  } catch (error: any) {
    console.error('Profile API error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error',
    }, { status: 500 });
  }
}

/**
 * POST /api/user/profile
 * Update user profile (email, username, twitter)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, email, username, twitter } = body;

    if (!address) {
      return NextResponse.json({
        success: false,
        error: 'Wallet address is required',
      }, { status: 400 });
    }

    // Validate email format if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid email format',
      }, { status: 400 });
    }

    // Check if trader exists
    const { data: existing } = await supabase
      .from('traders')
      .select('wallet_address')
      .eq('wallet_address', address.toLowerCase())
      .single();

    const updates: any = {
      wallet_address: address.toLowerCase(),
    };

    if (email !== undefined) updates.email = email;
    if (username !== undefined) updates.username = username;
    if (twitter !== undefined) updates.twitter_username = twitter;

    let result;

    if (existing) {
      // Update existing trader
      result = await supabase
        .from('traders')
        .update(updates)
        .eq('wallet_address', address.toLowerCase())
        .select()
        .single();
    } else {
      // Create new trader profile
      result = await supabase
        .from('traders')
        .insert([updates])
        .select()
        .single();
    }

    if (result.error) {
      // Check for unique constraint violations
      if (result.error.code === '23505') {
        if (result.error.message.includes('email')) {
          return NextResponse.json({
            success: false,
            error: 'Email is already registered to another account',
          }, { status: 409 });
        }
        if (result.error.message.includes('username')) {
          return NextResponse.json({
            success: false,
            error: 'Username is already taken',
          }, { status: 409 });
        }
      }

      console.error('Profile update error:', result.error);
      return NextResponse.json({
        success: false,
        error: 'Failed to update profile',
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      profile: result.data,
    });
  } catch (error: any) {
    console.error('Profile update API error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error',
    }, { status: 500 });
  }
}
