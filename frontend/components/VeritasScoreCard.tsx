'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TIER_NAMES, TIER_COLORS, ReputationTier } from '@/lib/contracts';
import { Trophy, TrendingUp, Target, Coins, Award } from 'lucide-react';

interface VeritasScoreCardProps {
  score: bigint;
  tier: ReputationTier;
  winRate: bigint;
  totalPredictions: bigint;
  correctPredictions: bigint;
  totalVolume: bigint;
  rank?: number;
  showDetails?: boolean;
}

const TIER_THRESHOLDS = {
  [ReputationTier.BRONZE]: 0,
  [ReputationTier.SILVER]: 200,
  [ReputationTier.GOLD]: 400,
  [ReputationTier.PLATINUM]: 650,
  [ReputationTier.DIAMOND]: 900,
};

const TIER_GRADIENTS = {
  [ReputationTier.BRONZE]: 'from-orange-600 to-orange-400',
  [ReputationTier.SILVER]: 'from-gray-400 to-gray-300',
  [ReputationTier.GOLD]: 'from-yellow-500 to-yellow-300',
  [ReputationTier.PLATINUM]: 'from-cyan-400 to-cyan-300',
  [ReputationTier.DIAMOND]: 'from-blue-500 to-purple-500',
};

export function VeritasScoreCard({
  score,
  tier,
  winRate,
  totalPredictions,
  correctPredictions,
  totalVolume,
  rank,
  showDetails = true,
}: VeritasScoreCardProps) {
  const scoreNum = Number(score);
  const winRateNum = Number(winRate) / 100; // Convert from basis points
  const tierName = TIER_NAMES[tier];
  const tierColor = TIER_COLORS[tier];
  const tierGradient = TIER_GRADIENTS[tier];

  // Calculate progress to next tier
  const currentThreshold = TIER_THRESHOLDS[tier];
  const nextTier = tier < ReputationTier.DIAMOND ? (tier + 1) as ReputationTier : tier;
  const nextThreshold = TIER_THRESHOLDS[nextTier];
  const progress = tier === ReputationTier.DIAMOND
    ? 100
    : ((scoreNum - currentThreshold) / (nextThreshold - currentThreshold)) * 100;
  const pointsToNext = nextThreshold - scoreNum;

  return (
    <Card className="border-2 overflow-hidden">
      {/* Header with Gradient */}
      <div className={`bg-gradient-to-r ${tierGradient} p-6 text-white`}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm opacity-90 mb-1">Your VeritasScore</p>
            <div className="text-6xl font-bold tracking-tight">
              {scoreNum.toLocaleString()}
            </div>
          </div>
          <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm">
            <Trophy className="w-3 h-3 mr-1" />
            {tierName}
          </Badge>
        </div>

        {/* Rank Badge */}
        {rank && (
          <div className="flex items-center gap-2 text-sm">
            <Award className="w-4 h-4" />
            <span className="font-semibold">Rank #{rank}</span>
            <span className="opacity-75">Global Leaderboard</span>
          </div>
        )}
      </div>

      <CardContent className="pt-6 space-y-6">
        {/* Tier Progress */}
        {tier < ReputationTier.DIAMOND && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Progress to {TIER_NAMES[nextTier]}</span>
              <span className="text-muted-foreground">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground text-right">
              {pointsToNext.toLocaleString()} points to go
            </p>
          </div>
        )}

        {tier === ReputationTier.DIAMOND && (
          <div className="text-center py-2">
            <Badge className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">
              <Trophy className="w-3 h-3 mr-1" />
              Maximum Tier Achieved!
            </Badge>
          </div>
        )}

        {showDetails && (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              {/* Win Rate */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingUp className="w-4 h-4" />
                  <span>Win Rate</span>
                </div>
                <div className="text-3xl font-bold">{winRateNum.toFixed(1)}%</div>
                <Progress value={winRateNum} className="h-1" />
              </div>

              {/* Total Predictions */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Target className="w-4 h-4" />
                  <span>Predictions</span>
                </div>
                <div className="text-3xl font-bold">{Number(totalPredictions)}</div>
                <p className="text-xs text-muted-foreground">
                  {Number(correctPredictions)} correct
                </p>
              </div>
            </div>

            {/* Volume */}
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Coins className="w-4 h-4" />
                  <span>Total Volume</span>
                </div>
                <div className="text-2xl font-bold">
                  {(Number(totalVolume) / 10 ** 18).toFixed(2)} STT
                </div>
              </div>
            </div>

            {/* Detailed Breakdown */}
            <div className="grid grid-cols-3 gap-2 pt-4 border-t">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-lg font-bold">{Number(totalPredictions)}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950">
                <div className="text-lg font-bold text-green-600">{Number(correctPredictions)}</div>
                <div className="text-xs text-muted-foreground">Won</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-950">
                <div className="text-lg font-bold text-red-600">
                  {Number(totalPredictions - correctPredictions)}
                </div>
                <div className="text-xs text-muted-foreground">Lost</div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
