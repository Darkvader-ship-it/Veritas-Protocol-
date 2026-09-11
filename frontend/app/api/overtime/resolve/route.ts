import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

const ODDS_API_KEY = process.env.ODDS_API_KEY || '';
const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

// Sport key mapping for The Odds API
const SPORT_ID_TO_KEYS: Record<number, string[]> = {
  1: ['soccer_epl', 'soccer_spain_la_liga', 'soccer_germany_bundesliga', 'soccer_italy_serie_a', 'soccer_france_ligue_one', 'soccer_usa_mls'],
  2: ['americanfootball_nfl', 'americanfootball_ncaaf'],
  3: ['basketball_nba', 'basketball_ncaab'],
  4: ['icehockey_nhl'],
  5: ['baseball_mlb'],
  6: ['tennis_atp_wimbledon', 'tennis_wta_wimbledon'],
  7: ['mma_mixed_martial_arts'],
};

interface ScoresEvent {
  id: string;
  sport_key: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  completed: boolean;
  scores: Array<{
    name: string;
    score: string;
  }> | null;
}

/**
 * Fetch completed games from The Odds API scores endpoint
 */
async function fetchScores(sport: string): Promise<ScoresEvent[]> {
  if (!ODDS_API_KEY) return [];

  const url = `${ODDS_API_BASE}/sports/${sport}/scores?apiKey=${ODDS_API_KEY}&daysFrom=3`;

  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return [];
    return response.json();
  } catch {
    return [];
  }
}

/**
 * GET /api/overtime/resolve
 * Resolve pending Overtime simulated trades by checking game results
 */
export async function GET() {
  const startTime = Date.now();

  try {
    // Get all pending trades
    const { data: pendingTrades, error: fetchError } = await supabase
      .from('overtime_simulated_trades')
      .select('id, game_id, sport_id, home_team, away_team, position, outcome_label, amount_usd, odds_at_entry, maturity')
      .eq('outcome', 'pending');

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!pendingTrades || pendingTrades.length === 0) {
      return NextResponse.json({
        resolved: 0,
        pending: 0,
        message: 'No pending trades',
        duration: Date.now() - startTime,
      });
    }

    // Get unique sport IDs to fetch scores for
    const sportIds = [...new Set(pendingTrades.map(t => t.sport_id))];

    // Fetch scores for all relevant sports
    const allScores: Map<string, ScoresEvent> = new Map();

    for (const sportId of sportIds) {
      const sportKeys = SPORT_ID_TO_KEYS[sportId] || [];
      for (const sportKey of sportKeys) {
        if (Date.now() - startTime > 7000) break; // Avoid timeout

        const scores = await fetchScores(sportKey);
        for (const event of scores) {
          allScores.set(event.id, event);
        }
      }
    }

    let resolved = 0;
    let skipped = 0;

    // Process each pending trade
    for (const trade of pendingTrades) {
      if (Date.now() - startTime > 8000) break;

      // Try to find the game in scores
      // Game ID format is "odds-{eventId}-{index}"
      const eventId = trade.game_id.replace('odds-', '').split('-')[0];
      const event = allScores.get(eventId);

      // Also try matching by team names if event ID doesn't match
      let matchedEvent = event;
      if (!matchedEvent) {
        for (const [, ev] of allScores) {
          if (ev.home_team === trade.home_team && ev.away_team === trade.away_team) {
            matchedEvent = ev;
            break;
          }
        }
      }

      if (!matchedEvent || !matchedEvent.completed || !matchedEvent.scores) {
        // Check if game should have been completed (past maturity + 4 hours)
        const maturityTime = new Date(trade.maturity).getTime();
        const now = Date.now();
        const hoursAfterMaturity = (now - maturityTime) / (1000 * 60 * 60);

        if (hoursAfterMaturity > 24) {
          // Game is way past due - mark as refund since we can't verify result
          await supabase
            .from('overtime_simulated_trades')
            .update({
              outcome: 'refund',
              pnl_usd: 0,
              resolved_at: new Date().toISOString(),
            })
            .eq('id', trade.id);
          resolved++;
        } else {
          skipped++;
        }
        continue;
      }

      // Determine winner
      const homeScore = matchedEvent.scores.find(s => s.name === matchedEvent!.home_team);
      const awayScore = matchedEvent.scores.find(s => s.name === matchedEvent!.away_team);

      if (!homeScore || !awayScore) {
        skipped++;
        continue;
      }

      const homePoints = parseInt(homeScore.score);
      const awayPoints = parseInt(awayScore.score);

      // Determine winning position
      // position: 0 = home, 1 = draw (soccer), 2 = away
      let winningPosition: number;
      if (homePoints > awayPoints) {
        winningPosition = 0; // Home wins
      } else if (awayPoints > homePoints) {
        winningPosition = 2; // Away wins
      } else {
        winningPosition = 1; // Draw
      }

      // Check if user won
      const won = trade.position === winningPosition;
      const amount = Number(trade.amount_usd);
      const odds = Number(trade.odds_at_entry) || 2.0;

      // Calculate PnL
      let pnl: number;
      if (won) {
        pnl = amount * (odds - 1); // Net profit
      } else {
        pnl = -amount;
      }

      await supabase
        .from('overtime_simulated_trades')
        .update({
          outcome: won ? 'win' : 'loss',
          pnl_usd: pnl.toFixed(2),
          resolved_at: new Date().toISOString(),
        })
        .eq('id', trade.id);

      resolved++;
    }

    // Get updated stats
    const { data: stats } = await supabase
      .from('overtime_simulated_trades')
      .select('outcome');

    const wins = stats?.filter(t => t.outcome === 'win').length || 0;
    const losses = stats?.filter(t => t.outcome === 'loss').length || 0;
    const pending = stats?.filter(t => t.outcome === 'pending').length || 0;

    return NextResponse.json({
      resolved,
      skipped,
      pending,
      wins,
      losses,
      winRate: wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) + '%' : 'N/A',
      scoresFound: allScores.size,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Overtime resolve error:', error);
    return NextResponse.json({
      error: error.message,
      duration: Date.now() - startTime,
    }, { status: 500 });
  }
}
