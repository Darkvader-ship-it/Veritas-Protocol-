import * as React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from './badge';
import { StatCard, StatRow } from './stat-card';
import { Crown, Medal, User } from 'lucide-react';
import {
  TIER_STYLES,
  getTierFromScore,
  shortenAddress,
  formatVolume,
  RADIUS,
  BORDER,
  SHADOW,
  SPACING,
} from './design-tokens';

/**
 * TraderCard - Standardized trader display card for leaderboards and listings
 *
 * Variants:
 * - podium: Featured card with rank badge (for top 3) - matches homepage hero card styling
 * - compact: Smaller card for grids
 * - row: Table row style
 *
 * Card styling matches homepage:
 * - rounded-2xl border border-border bg-card shadow-xl shadow-black/5
 * - Stat boxes with colored backgrounds (bg-secondary/10, bg-success/10, bg-primary/10)
 */

export { TIER_STYLES, getTierFromScore };
export type TierName = keyof typeof TIER_STYLES;

export function getTierStyle(score: number) {
  return TIER_STYLES[getTierFromScore(score)];
}

// Rank styling - gradient badges positioned outside card
const RANK_BADGE_STYLES = {
  1: {
    gradient: 'bg-gradient-to-br from-secondary to-amber-600',
    icon: Crown,
    position: '-top-3 -right-2 rotate-3',
    size: 'w-12 h-12',
    iconSize: 'w-6 h-6',
  },
  2: {
    gradient: 'bg-gradient-to-br from-gray-400 to-gray-500',
    icon: Medal,
    position: '-top-3 -left-2 -rotate-3',
    size: 'w-10 h-10',
    iconSize: 'w-5 h-5',
  },
  3: {
    gradient: 'bg-gradient-to-br from-amber-600 to-amber-700',
    icon: Medal,
    position: '-top-3 -right-2 rotate-3',
    size: 'w-10 h-10',
    iconSize: 'w-5 h-5',
  },
} as const;

interface TraderCardProps {
  address: string;
  username?: string;
  rank?: number;
  veritasScore: number;
  winRate: number;
  totalPredictions: number;
  totalVolume?: string;
  platforms?: string[];
  variant?: 'podium' | 'compact' | 'row';
  featured?: boolean;
  onClick?: () => void;
  className?: string;
  customFormatVolume?: (vol: string, platforms?: string[]) => string;
}

// Using shortenAddress and formatVolume from design-tokens

export function TraderCard({
  address,
  username,
  rank,
  veritasScore,
  winRate,
  totalPredictions,
  totalVolume,
  platforms,
  variant = 'podium',
  featured = false,
  onClick,
  className,
  customFormatVolume,
}: TraderCardProps) {
  // Use custom formatter if provided, otherwise use design tokens
  const volumeFormatter = customFormatVolume || ((vol: string, plat?: string[]) => formatVolume(vol, plat));
  const tierStyle = getTierStyle(veritasScore);
  // Only use featured styling when explicitly passed - allows parent to control card size
  const isFeatured = featured;

  if (variant === 'podium') {
    const rankBadge = rank && rank <= 3 ? RANK_BADGE_STYLES[rank as 1 | 2 | 3] : null;
    const RankIcon = rankBadge?.icon;

    return (
      <button
        onClick={onClick}
        className={cn(
          // Base card styling - matches homepage hero card exactly
          // overflow-visible allows rank badges to extend outside the card
          'relative group flex flex-col rounded-2xl border border-border bg-card shadow-xl shadow-black/5 transition-all hover:scale-[1.02] overflow-visible',
          isFeatured
            ? 'p-5 sm:p-6 hover:border-secondary/30 verification-glow'
            : 'p-4 sm:p-5 hover:border-muted-foreground/30',
          className
        )}
      >
        {/* Rank badge - positioned outside card like homepage trophy badge */}
        {rankBadge && RankIcon && (
          <div
            className={cn(
              'absolute rounded-xl flex items-center justify-center shadow-lg',
              rankBadge.gradient,
              rankBadge.position,
              rankBadge.size
            )}
          >
            <RankIcon className={cn('text-white', rankBadge.iconSize)} />
          </div>
        )}

        {/* Profile: Icon Avatar + Name + Tier Badge - matches homepage hero card */}
        <div className="flex items-center gap-3 mb-4">
          {/* Square rounded avatar with icon - matches homepage styling */}
          <div className={cn(
            'rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-md',
            isFeatured ? 'w-11 h-11' : 'w-10 h-10'
          )}>
            <User className={cn('text-white', isFeatured ? 'h-5 w-5' : 'h-4 w-4')} />
          </div>
          <div className="text-left min-w-0 flex-1">
            {username ? (
              <span className={cn('font-semibold truncate block', isFeatured ? 'text-base' : 'text-sm')}>
                {username}
              </span>
            ) : (
              <code className={cn('font-mono truncate block', isFeatured ? 'text-sm' : 'text-xs')}>
                {shortenAddress(address)}
              </code>
            )}
            <Badge className={cn(tierStyle.bg, tierStyle.color, tierStyle.border, 'text-[10px] mt-0.5')}>
              {tierStyle.name}
            </Badge>
          </div>
        </div>

        {/* Featured 1st place: Big Score Display */}
        {isFeatured && (
          <div className="text-center py-4 mb-4 rounded-xl bg-surface/50 border border-border">
            <div className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-secondary via-amber-400 to-secondary bg-clip-text text-transparent tabular-nums">
              {veritasScore}
            </div>
            <p className="text-xs text-muted-foreground mt-1">VeritasScore</p>
          </div>
        )}

        {/* Stats - COLORED backgrounds matching homepage */}
        <StatRow columns={3} gap="sm" className="mt-auto">
          {isFeatured ? (
            // 1st place: win rate, bets, volume
            <>
              <StatCard label="Win Rate" color="success" size="sm">
                {winRate.toFixed(0)}%
              </StatCard>
              <StatCard label="Bets" color="muted" size="sm">
                {totalPredictions}
              </StatCard>
              <StatCard label="Volume" color="primary" size="sm">
                {totalVolume ? volumeFormatter(totalVolume, platforms) : '-'}
              </StatCard>
            </>
          ) : (
            // 2nd/3rd place: score, win rate, volume
            <>
              <StatCard label="Score" color="secondary" size="sm">
                {veritasScore}
              </StatCard>
              <StatCard label="Win" color="success" size="sm">
                {winRate.toFixed(0)}%
              </StatCard>
              <StatCard label="Vol" color="primary" size="sm">
                {totalVolume ? volumeFormatter(totalVolume, platforms) : '-'}
              </StatCard>
            </>
          )}
        </StatRow>
      </button>
    );
  }

  // Compact variant for grids
  if (variant === 'compact') {
    return (
      <button
        onClick={onClick}
        className={cn(
          'p-3 rounded-xl border border-border bg-card hover:border-primary/30 hover:bg-surface-raised transition-all text-left group',
          className
        )}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {rank && (
              <span className="w-5 h-5 rounded-full bg-surface-raised text-xs flex items-center justify-center font-medium text-muted-foreground">
                {rank}
              </span>
            )}
            <Badge className={cn(tierStyle.bg, tierStyle.color, tierStyle.border, 'text-[10px]')}>
              {tierStyle.name}
            </Badge>
          </div>
          <span className="text-success text-sm font-medium">{winRate.toFixed(1)}%</span>
        </div>
        <code className="font-mono text-xs text-muted-foreground group-hover:text-foreground transition-colors">
          {shortenAddress(address)}
        </code>
      </button>
    );
  }

  // Row variant - handled separately for full table row rendering
  return null;
}

/**
 * TierBadge - Standalone tier badge component
 */
interface TierBadgeProps {
  score: number;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

export function TierBadge({ score, size = 'sm', className }: TierBadgeProps) {
  const style = getTierStyle(score);
  const sizeClasses = {
    xs: 'text-[10px] px-1.5 py-0',
    sm: 'text-xs',
    md: 'text-sm',
  };

  return (
    <Badge className={cn(style.bg, style.color, style.border, sizeClasses[size], className)}>
      {style.name}
    </Badge>
  );
}
