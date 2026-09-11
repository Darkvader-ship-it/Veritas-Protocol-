import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export const dynamic = 'force-dynamic';

/**
 * POST /api/metaculus/simulate
 * Place a simulated prediction on a Metaculus question
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      walletAddress,
      questionId,
      title,
      description,
      category,
      position, // 'Yes' or 'No' for binary
      prediction, // User's prediction (0-1 probability)
      communityPrediction, // Current community prediction
      amount, // Virtual stake amount
      resolvesAt,
    } = body;

    if (!walletAddress || !questionId || !position || !prediction || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: walletAddress, questionId, position, prediction, amount' },
        { status: 400 }
      );
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    if (amountNum < 10) {
      return NextResponse.json({ error: 'Minimum stake is 10 points' }, { status: 400 });
    }

    if (amountNum > 1000) {
      return NextResponse.json({ error: 'Maximum simulated stake is 1000 points' }, { status: 400 });
    }

    const predictionNum = parseFloat(prediction);
    if (isNaN(predictionNum) || predictionNum < 0.01 || predictionNum > 0.99) {
      return NextResponse.json({ error: 'Prediction must be between 1% and 99%' }, { status: 400 });
    }

    // Check if user already has a prediction on this question
    const { data: existing } = await supabase
      .from('metaculus_simulated_trades')
      .select('id')
      .eq('follower', walletAddress.toLowerCase())
      .eq('question_id', questionId)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'You already have a simulated prediction on this question' },
        { status: 400 }
      );
    }

    // Calculate potential score based on Brier score difference
    const communityProb = parseFloat(communityPrediction) || 0.5;
    const potentialScore = amountNum * Math.abs(predictionNum - communityProb);

    // Insert simulated trade
    const { data: trade, error } = await supabase
      .from('metaculus_simulated_trades')
      .insert({
        follower: walletAddress.toLowerCase(),
        question_id: questionId,
        title: title || 'Unknown Question',
        description: description?.slice(0, 500),
        category: category || 'General',
        position: position,
        prediction: predictionNum,
        community_prediction: communityProb,
        amount_points: amountNum,
        potential_score: potentialScore,
        resolves_at: resolvesAt ? new Date(resolvesAt).toISOString() : null,
        outcome: 'pending',
        simulated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting Metaculus trade:', error);
      if (error.code === '42P01' || error.code === 'PGRST205' || error.message?.includes('does not exist')) {
        return NextResponse.json(
          { error: 'Metaculus simulation not yet configured. Please create the metaculus_simulated_trades table.' },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: 'Failed to place simulated prediction' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      trade: {
        id: trade.id,
        questionId: trade.question_id,
        title: trade.title,
        position: trade.position,
        prediction: trade.prediction,
        communityPrediction: trade.community_prediction,
        amount: trade.amount_points,
        potentialScore: trade.potential_score,
        status: 'pending',
        simulatedAt: trade.simulated_at,
      },
      message: `Simulated ${amountNum} points on ${(predictionNum * 100).toFixed(0)}% ${position}`,
    });
  } catch (error: any) {
    console.error('Metaculus simulate error:', error);
    return NextResponse.json({ error: error.message || 'Failed to place simulated prediction' }, { status: 500 });
  }
}

/**
 * GET /api/metaculus/simulate
 * Get simulated Metaculus predictions for a user
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const follower = searchParams.get('follower')?.toLowerCase();
  const questionId = searchParams.get('questionId');
  const limit = parseInt(searchParams.get('limit') || '50');
  const stats = searchParams.get('stats') === 'true';

  try {
    if (stats && follower) {
      const { data: trades, error } = await supabase
        .from('metaculus_simulated_trades')
        .select('outcome, score, amount_points')
        .eq('follower', follower);

      if (error) throw error;

      const wins = trades?.filter(t => t.outcome === 'win').length || 0;
      const losses = trades?.filter(t => t.outcome === 'loss').length || 0;
      const pending = trades?.filter(t => t.outcome === 'pending').length || 0;
      const totalTrades = trades?.length || 0;

      let totalScore = 0;
      let totalVolume = 0;

      for (const t of trades || []) {
        if (t.score) totalScore += t.score;
        if (t.amount_points) totalVolume += t.amount_points;
      }

      return NextResponse.json({
        follower,
        totalPredictions: totalTrades,
        wins,
        losses,
        pending,
        accuracy: wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : '0',
        totalScore: totalScore.toFixed(0),
        totalPoints: totalVolume.toFixed(0),
      });
    }

    let query = supabase
      .from('metaculus_simulated_trades')
      .select('*')
      .order('simulated_at', { ascending: false })
      .limit(limit);

    if (follower) query = query.eq('follower', follower);
    if (questionId) query = query.eq('question_id', questionId);

    const { data: trades, error } = await query;

    if (error) throw error;

    const formatted = (trades || []).map(t => ({
      id: t.id,
      follower: t.follower,
      questionId: t.question_id,
      title: t.title,
      description: t.description,
      category: t.category,
      position: t.position,
      prediction: t.prediction,
      communityPrediction: t.community_prediction,
      amountPoints: t.amount_points,
      potentialScore: t.potential_score,
      resolvesAt: t.resolves_at,
      outcome: t.outcome,
      score: t.score,
      actualOutcome: t.actual_outcome,
      simulatedAt: t.simulated_at,
      resolvedAt: t.resolved_at,
    }));

    return NextResponse.json({ trades: formatted, count: formatted.length });
  } catch (error: any) {
    console.error('Metaculus simulate GET error:', error);
    if (error.code === '42P01' || error.code === 'PGRST205' || error.message?.includes('does not exist')) {
      return NextResponse.json({ trades: [], count: 0, warning: 'Metaculus simulation table not configured' });
    }
    return NextResponse.json({ error: error.message || 'Failed to fetch predictions' }, { status: 500 });
  }
}
