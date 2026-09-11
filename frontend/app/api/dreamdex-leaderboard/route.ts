import { NextRequest, NextResponse } from 'next/server';
import { calculateVeritasScore, VERITASSCORE_CONFIG } from '@/lib/veritasScore';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dreamdex-leaderboard
 * Real leaderboard aggregating bets where platform='dreamdex'.
 * Computes VeritasScore via calculateVeritasScore (binary).
 * No simulated-leaderboard pattern — uses real bets table.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || supabaseAnonKey;

function getSupabase() {
  if (!supabaseUrl || supabaseUrl.includes('placeholder')) return null;
  return createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);
}

interface LeaderboardEntry {
  rank: number;
  address: string;
  username?: string;
  veritasScore: number;
  winRate: number;
  totalBets: number;
  wins: number;
  losses: number;
  totalVolume: string;
  pnl: number;
  platforms: string[];
  network: string;
  lastTradeAt?: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(100, parseInt(searchParams.get('limit') || '50'));
  const search = searchParams.get('search')?.toLowerCase();
  const sortBy = searchParams.get('sortBy') || 'veritasScore';

  const supabase = getSupabase();

  // If no Supabase configured, return empty real leaderboard (not mock)
  if (!supabase) {
    return NextResponse.json({
      success: true,
      data: [],
      count: 0,
      isMock: false,
      platform: 'DreamDEX',
      chain: 'Somnia Shannon',
      currency: 'tUSDC',
      network: 'Somnia Shannon',
      message: 'Configure Supabase to enable DreamDEX leaderboard. Place real trades via DreamDEX Terminal.',
      timestamp: Date.now(),
    });
  }

  try {
    // Try to query user_platform_stats where platform = dreamdex
    // Fallback to bets table aggregation if needed
    // First attempt: query bets table for dreamdex platform

    // Resolve platform_id for dreamdex
    let platformId: number | null = null;
    try {
      const { data: plat } = await supabase.from('platforms').select('id').eq('name', 'dreamdex').maybeSingle();
      if (plat) platformId = (plat as any).id;
      else {
        const { data: plat2 } = await supabase.from('platforms').select('id').ilike('name', '%dreamdex%').maybeSingle();
        if (plat2) platformId = (plat2 as any).id;
      }
    } catch {}

    // If platforms table has no dreamdex entry, fallback to string-based bets query (if bets has platform column string)
    let leaderboard: LeaderboardEntry[] = [];

    if (platformId !== null) {
      // Aggregate from user_platform_stats
      const { data: stats, error: statsErr } = await supabase
        .from('user_platform_stats')
        .select('*')
        .eq('platform_id', platformId)
        .order('score', { ascending: false })
        .limit(limit * 2);

      if (!statsErr && stats && stats.length > 0) {
        // Join with users table to get wallet_address
        const userIds = stats.map((s: any) => s.user_id);
        const { data: users } = await supabase.from('users').select('id, wallet_address, username').in('id', userIds);
        const userMap = new Map<string, any>();
        (users || []).forEach((u: any) => userMap.set(u.id, u));

        leaderboard = stats.map((s: any, idx: number) => {
          const user = userMap.get(s.user_id);
          const totalBets = s.total_bets || 0;
          const wins = s.wins || 0;
          const losses = s.losses || totalBets - wins;
          const winRate = s.win_rate || (totalBets > 0 ? (wins / totalBets) * 100 : 0);
          const volume = s.volume || '0';
          const pnl = parseFloat(s.pnl || '0');

          // Recalculate VeritasScore for consistency (binary)
          const scoreResult = calculateVeritasScore({
            wins,
            losses,
            totalBets,
            platform: 'dreamdex',
            lastTradeAt: s.last_updated ? new Date(s.last_updated) : new Date(),
          });

          return {
            rank: idx + 1,
            address: user?.wallet_address || s.user_id,
            username: user?.username,
            veritasScore: scoreResult.totalScore,
            winRate: Math.round(winRate * 100) / 100,
            totalBets,
            wins,
            losses,
            totalVolume: typeof volume === 'string' ? volume : String(volume),
            pnl,
            platforms: ['dreamdex'],
            network: 'Somnia Shannon',
            lastTradeAt: s.last_updated,
          };
        });
      } else {
        // Try aggregation from bets table directly
        const { data: bets, error: betsErr } = await supabase
          .from('bets')
          .select('user_id, won, amount, claimed_amount, timestamp')
          .eq('platform_id', platformId)
          .limit(5000);

        if (!betsErr && bets && bets.length > 0) {
          // Group by user_id
          const grouped = new Map<string, { totalBets: number; wins: number; losses: number; volume: number; pnl: number; lastTradeAt?: string }>();
          for (const b of bets as any[]) {
            const uid = b.user_id;
            if (!grouped.has(uid)) grouped.set(uid, { totalBets: 0, wins: 0, losses: 0, volume: 0, pnl: 0 });
            const g = grouped.get(uid)!;
            g.totalBets++;
            const amount = parseFloat(b.amount || '0');
            g.volume += amount;
            if (b.won === true) {
              g.wins++;
              const claimed = parseFloat(b.claimed_amount || '0');
              g.pnl += claimed - amount;
            } else if (b.won === false) {
              g.losses++;
              g.pnl -= amount;
            }
            if (b.timestamp && (!g.lastTradeAt || b.timestamp > g.lastTradeAt)) g.lastTradeAt = b.timestamp;
          }

          const userIds = Array.from(grouped.keys());
          const { data: users } = await supabase.from('users').select('id, wallet_address, username').in('id', userIds);
          const userMap = new Map<string, any>();
          (users || []).forEach((u: any) => userMap.set(u.id, u));

          leaderboard = Array.from(grouped.entries()).map(([userId, g], idx) => {
            const user = userMap.get(userId);
            const winRate = g.totalBets > 0 ? (g.wins / g.totalBets) * 100 : 0;
            const scoreResult = calculateVeritasScore({
              wins: g.wins,
              losses: g.losses,
              totalBets: g.totalBets,
              platform: 'dreamdex',
              lastTradeAt: g.lastTradeAt ? new Date(g.lastTradeAt) : undefined,
            });
            return {
              rank: idx + 1,
              address: user?.wallet_address || userId,
              username: user?.username,
              veritasScore: scoreResult.totalScore,
              winRate: Math.round(winRate * 100) / 100,
              totalBets: g.totalBets,
              wins: g.wins,
              losses: g.losses,
              totalVolume: g.volume.toFixed(2),
              pnl: g.pnl,
              platforms: ['dreamdex'],
              network: 'Somnia Shannon',
              lastTradeAt: g.lastTradeAt,
            };
          });

          leaderboard.sort((a, b) => b.veritasScore - a.veritasScore);
          leaderboard.forEach((e, i) => (e.rank = i + 1));
        }
      }
    } else {
      // No platform_id found — check if bets has platform string column instead?
      // Try generic query where platform column is string 'dreamdex' if exists
      // We'll attempt to query unified leaderboard via bets without platform filter and aggregate
      // For now return empty with guidance
      return NextResponse.json({
        success: true,
        data: [],
        count: 0,
        isMock: false,
        platform: 'DreamDEX',
        chain: 'Somnia Shannon',
        currency: 'tUSDC',
        network: 'Somnia Shannon',
        message: 'No dreamdex platform registered yet. Run dreamdex-indexer to populate bets and register platform.',
        timestamp: Date.now(),
      });
    }

    // Filter qualified (MIN_BETS_BINARY)
    const qualified = leaderboard.filter((e) => e.totalBets >= VERITASSCORE_CONFIG.MIN_BETS_BINARY);

    // Sort by requested
    if (sortBy === 'winRate') qualified.sort((a, b) => b.winRate - a.winRate);
    else if (sortBy === 'volume') qualified.sort((a, b) => parseFloat(b.totalVolume) - parseFloat(a.totalVolume));
    else qualified.sort((a, b) => b.veritasScore - a.veritasScore);

    qualified.forEach((e, i) => (e.rank = i + 1));

    let filtered = qualified;
    if (search) {
      filtered = qualified.filter((e) => e.address.toLowerCase().includes(search) || (e.username && e.username.toLowerCase().includes(search)));
    }

    const paged = filtered.slice(0, limit);

    return NextResponse.json({
      success: true,
      data: paged,
      count: paged.length,
      totalAvailable: filtered.length,
      isMock: false,
      platform: 'DreamDEX Event Contracts',
      chain: 'Somnia Shannon',
      currency: 'tUSDC',
      network: 'Somnia Shannon',
      source: platformId !== null ? 'supabase:real' : 'none',
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('[DreamDEX Leaderboard] error:', error.message);
    return NextResponse.json({
      success: false,
      data: [],
      count: 0,
      isMock: false,
      platform: 'DreamDEX',
      error: error.message,
      timestamp: Date.now(),
    }, { status: 500 });
  }
}
