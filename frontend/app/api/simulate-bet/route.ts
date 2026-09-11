import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { parseEther } from 'viem';
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

/**
 * POST /api/simulate-bet
 *
 * Simulates a DreamDEX prediction bet without requiring real STT.
 * Stores the bet in the database and tracks outcomes.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, epoch, amount, position, asset } = body;

    // Validate inputs
    if (!address || !epoch || !amount || !position) {
      return NextResponse.json(
        { error: 'Missing required fields: address, epoch, amount, position' },
        { status: 400 }
      );
    }

    if (!['bull', 'bear'].includes(position)) {
      return NextResponse.json(
        { error: 'Position must be "bull" or "bear"' },
        { status: 400 }
      );
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json(
        { error: 'Amount must be a positive number' },
        { status: 400 }
      );
    }

    // Convert to wei for storage
    const amountWei = parseEther(amount.toString()).toString();

    // Check if user already bet on this epoch
    const { data: existingBet } = await supabase
      .from('simulated_bets')
      .select('id')
      .eq('user_address', address.toLowerCase())
      .eq('epoch', epoch)
      .single();

    if (existingBet) {
      return NextResponse.json(
        { error: 'You already placed a simulated bet on this round' },
        { status: 400 }
      );
    }

    // Insert simulated bet
    const { data, error } = await supabase
      .from('simulated_bets')
      .insert({
        user_address: address.toLowerCase(),
        epoch: parseInt(epoch),
        amount: amountWei,
        position: position,
        asset: asset || 'STTUSDT',
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting simulated bet:', error);

      // If table doesn't exist, return success anyway (demo mode)
      if (error.code === '42P01') {
        return NextResponse.json({
          success: true,
          message: 'Bet simulated (demo mode - no database)',
          bet: {
            id: `demo-${Date.now()}`,
            epoch,
            amount,
            position,
            status: 'pending',
          },
          demo: true,
        });
      }

      return NextResponse.json(
        { error: 'Failed to place simulated bet' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Simulated bet placed successfully',
      bet: {
        id: data.id,
        epoch: data.epoch,
        amount: amount,
        position: data.position,
        status: data.status,
      },
    });
  } catch (error: any) {
    console.error('Simulate bet error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/simulate-bet
 *
 * Get user's simulated bets and stats
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address')?.toLowerCase();
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!address) {
      return NextResponse.json(
        { error: 'Address is required' },
        { status: 400 }
      );
    }

    // Get user's simulated bets
    const { data: bets, error } = await supabase
      .from('simulated_bets')
      .select('*')
      .eq('user_address', address)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      // Table might not exist - return empty
      if (error.code === '42P01') {
        return NextResponse.json({
          bets: [],
          stats: {
            totalBets: 0,
            wins: 0,
            losses: 0,
            pending: 0,
            winRate: 'N/A',
            totalPnlSTT: '0',
            totalVolumeSTT: '0',
          },
        });
      }
      throw error;
    }

    // Calculate stats
    let wins = 0, losses = 0, pending = 0;
    let totalPnl = BigInt(0);
    let totalVolume = BigInt(0);

    for (const bet of bets || []) {
      totalVolume += BigInt(bet.amount);

      if (bet.status === 'won') {
        wins++;
        totalPnl += BigInt(bet.pnl || '0');
      } else if (bet.status === 'lost') {
        losses++;
        totalPnl -= BigInt(bet.amount); // Lost the bet amount
      } else {
        pending++;
      }
    }

    const resolved = wins + losses;
    const winRate = resolved > 0 ? ((wins / resolved) * 100).toFixed(1) + '%' : 'N/A';

    // Format bets for response
    const formattedBets = (bets || []).map((b) => ({
      id: b.id,
      epoch: b.epoch,
      amount: (Number(b.amount) / 1e18).toFixed(4),
      position: b.position,
      status: b.status,
      pnl: b.pnl ? (Number(b.pnl) / 1e18).toFixed(4) : null,
      createdAt: b.created_at,
      resolvedAt: b.resolved_at,
    }));

    return NextResponse.json({
      bets: formattedBets,
      stats: {
        totalBets: bets?.length || 0,
        wins,
        losses,
        pending,
        winRate,
        totalPnlSTT: (Number(totalPnl) / 1e18).toFixed(4),
        totalVolumeSTT: (Number(totalVolume) / 1e18).toFixed(4),
      },
    });
  } catch (error: any) {
    console.error('Get simulated bets error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch simulated bets' },
      { status: 500 }
    );
  }
}
