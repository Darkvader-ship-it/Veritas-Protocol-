import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { calculateVeritasScore, VERITASSCORE_CONFIG } from '@/lib/veritasScore';

/**
 * Score Recalculation API
 *
 * This endpoint recalculates all VeritasScores using the unified VeritasScore v2.0 system.
 * It should be run:
 * - Daily via Vercel cron to catch any drift
 * - After any scoring formula changes
 * - If score anomalies are detected
 *
 * Uses unified VeritasScore v2.0 system with Wilson Score for binary markets
 * and ROI-based scoring for odds markets.
 */

// Lazy-initialized Supabase client (avoids build-time errors when env vars aren't set)
let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error('Supabase credentials not configured');
    }
    supabase = createClient(url, key);
  }
  return supabase;
}

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Calculate score using unified VeritasScore system
 * Uses binary scoring for DreamDEX (the main indexed platform)
 */
function calculateScore(wins: number, totalBets: number, volume: string): number {
  // Use unified VeritasScore system (binary market for DreamDEX)
  const result = calculateVeritasScore({
    wins,
    losses: totalBets - wins,
    totalBets,
    platform: 'DreamDEX',
    lastTradeAt: new Date(),
  });
  return result.totalScore;
}

export async function GET() {
  const startTime = Date.now();
  console.log('[recalc-scores] Starting score recalculation at', new Date().toISOString());

  try {
    // Get all user platform stats
    const { data: stats, error: fetchError } = await getSupabase()
      .from('user_platform_stats')
      .select('id, user_id, platform_id, total_bets, wins, volume, score');

    if (fetchError) {
      throw fetchError;
    }

    if (!stats || stats.length === 0) {
      return NextResponse.json({
        recalculated: 0,
        message: 'No stats found',
        duration: Date.now() - startTime,
      });
    }

    let updated = 0;
    let anomalies = 0;
    const anomalyDetails: any[] = [];

    for (const stat of stats) {
      // Calculate correct score
      const correctScore = calculateScore(stat.wins, stat.total_bets, stat.volume || '0');

      // Check for anomaly (score differs by more than 10%)
      const scoreDiff = Math.abs(stat.score - correctScore);
      const isAnomaly = stat.score > 0 && scoreDiff > stat.score * 0.1;

      if (isAnomaly) {
        anomalies++;
        if (anomalyDetails.length < 10) {
          anomalyDetails.push({
            id: stat.id,
            oldScore: stat.score,
            newScore: correctScore,
            diff: scoreDiff,
          });
        }
      }

      // Update if score is different
      if (stat.score !== correctScore) {
        const { error: updateError } = await getSupabase()
          .from('user_platform_stats')
          .update({ score: correctScore })
          .eq('id', stat.id);

        if (!updateError) {
          updated++;
        }
      }

      // Timeout protection
      if (Date.now() - startTime > 55000) {
        console.log('[recalc-scores] Approaching timeout, stopping early');
        break;
      }
    }

    const result = {
      total: stats.length,
      recalculated: updated,
      anomalies,
      anomalyDetails: anomalies > 0 ? anomalyDetails : undefined,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };

    console.log('[recalc-scores] Complete:', JSON.stringify(result));

    // Log warning if anomalies detected
    if (anomalies > 0) {
      console.warn(`[recalc-scores] WARNING: ${anomalies} score anomalies detected and fixed!`);
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[recalc-scores] Error:', error);
    return NextResponse.json({
      error: error.message,
      duration: Date.now() - startTime,
    }, { status: 500 });
  }
}
