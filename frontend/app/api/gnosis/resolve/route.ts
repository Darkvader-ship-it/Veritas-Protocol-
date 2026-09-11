import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export const dynamic = 'force-dynamic';

/**
 * Gnosis/Omen Trade Resolution
 *
 * Resolves pending simulated trades by querying Omen subgraph.
 * Currently a stub - will be implemented when betting is enabled.
 */

const OMEN_SUBGRAPH = 'https://api.thegraph.com/subgraphs/name/protofire/omen-xdai';

export async function GET() {
  const startTime = Date.now();

  try {
    // Check if we have a trades table
    const { data: pendingTrades, error: fetchError } = await supabase
      .from('gnosis_simulated_trades')
      .select('id')
      .eq('outcome', 'pending')
      .limit(1);

    if (fetchError) {
      // Table doesn't exist yet - that's fine
      if (fetchError.code === '42P01' || fetchError.message?.includes('does not exist')) {
        return NextResponse.json({
          success: true,
          resolved: 0,
          pending: 0,
          message: 'Gnosis/Omen simulated trades table not configured',
          duration: Date.now() - startTime,
        });
      }
      throw fetchError;
    }

    // No trades to resolve
    return NextResponse.json({
      success: true,
      resolved: 0,
      pending: pendingTrades?.length || 0,
      message: 'Gnosis/Omen resolution ready - betting coming soon',
      duration: Date.now() - startTime,
    });
  } catch (error: any) {
    console.error('Gnosis resolve error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Resolution failed',
      resolved: 0,
      pending: 0,
      duration: Date.now() - startTime,
    }, { status: 500 });
  }
}
