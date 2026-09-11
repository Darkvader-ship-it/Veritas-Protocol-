'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TIER_NAMES, TIER_COLORS, ReputationTier } from '@/lib/contracts';

interface VeritasScoreDisplayProps {
  score: bigint;
  tier: ReputationTier;
  winRate: bigint;
  totalPredictions: bigint;
  correctPredictions: bigint;
  showDetails?: boolean;
}

const TIER_THRESHOLDS = {
  [ReputationTier.BRONZE]: 0,
  [ReputationTier.SILVER]: 200,
  [ReputationTier.GOLD]: 400,
  [ReputationTier.PLATINUM]: 650,
  [ReputationTier.DIAMOND]: 900,
};

export function VeritasScoreDisplay({
  score,
  tier,
  winRate,
  totalPredictions,
  correctPredictions,
  showDetails = true,
}: VeritasScoreDisplayProps) {
  const scoreNum = Number(score);
  const winRateNum = Number(winRate) / 100; // Convert from basis points
  const tierName = TIER_NAMES[tier];
  const tierColor = TIER_COLORS[tier];

  // Calculate progress to next tier
  const currentThreshold = TIER_THRESHOLDS[tier];
  const nextTier = tier < ReputationTier.DIAMOND ? (tier + 1) as ReputationTier : tier;
  const nextThreshold = TIER_THRESHOLDS[nextTier];
  const progress = tier === ReputationTier.DIAMOND
    ? 100
    : ((scoreNum - currentThreshold) / (nextThreshold - currentThreshold)) * 100;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>VeritasScore</CardTitle>
          <Badge className={tierColor}>{tierName}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <div className="text-5xl font-bold">{scoreNum.toLocaleString()}</div>
          <p className="text-sm text-muted-foreground mt-1">Reputation Score</p>
        </div>

        {tier < ReputationTier.DIAMOND && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{tierName}</span>
              <span>{TIER_NAMES[nextTier]}</span>
            </div>
            <Progress value={progress} />
            <p className="text-xs text-muted-foreground text-center">
              {(nextThreshold - scoreNum).toLocaleString()} points to {TIER_NAMES[nextTier]}
            </p>
          </div>
        )}

        {showDetails && (
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <p className="text-2xl font-bold">{winRateNum.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">Win Rate</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{Number(totalPredictions)}</p>
              <p className="text-xs text-muted-foreground">Predictions</p>
            </div>
            <div className="col-span-2">
              <p className="text-sm">
                <span className="font-semibold">{Number(correctPredictions)}</span> correct out of{' '}
                <span className="font-semibold">{Number(totalPredictions)}</span> total
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
