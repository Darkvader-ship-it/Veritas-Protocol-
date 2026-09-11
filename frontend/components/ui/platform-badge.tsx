/**
 * PlatformBadge Component
 * ======================
 * Consistent platform indicator badges across the app.
 * Uses design tokens for colors and sizing.
 */

import { PLATFORM_COLORS, getPlatformKey, type PlatformKey } from './design-tokens';

interface PlatformBadgeProps {
  platform: string;
  size?: 'xs' | 'sm' | 'md';
  showFullName?: boolean;
  className?: string;
}

// Short names for compact display
const SHORT_NAMES: Record<string, string> = {
  'Polymarket': 'Poly',
  'DreamDEX Event Contracts': 'DreamDEX',
  'DreamDEX': 'DreamDEX',
  'Overtime': 'OT',
  'Speed Markets': 'Speed',
  'Limitless': 'LMT',
  'Azuro': 'AZR',
  'SX Bet': 'SX',
  'Gnosis/Omen': 'Gnosis',
  'Gnosis': 'Gnosis',
  'Omen': 'Omen',
  'Drift BET': 'Drift',
  'Drift': 'Drift',
  'Kalshi': 'Kalshi',
  'Manifold Markets': 'Manifold',
  'Manifold': 'Manifold',
  'Metaculus': 'Meta',
};

// Clean display names
const DISPLAY_NAMES: Record<string, string> = {
  'Polymarket': 'Polymarket',
  'DreamDEX Event Contracts': 'DreamDEX',
  'DreamDEX': 'DreamDEX',
  'Overtime': 'Overtime',
  'Speed Markets': 'Speed Markets',
  'Limitless': 'Limitless',
  'Azuro': 'Azuro',
  'SX Bet': 'SX Bet',
  'Gnosis/Omen': 'Gnosis',
  'Gnosis': 'Gnosis',
  'Omen': 'Omen',
  'Drift BET': 'Drift',
  'Drift': 'Drift',
  'Kalshi': 'Kalshi',
  'Manifold Markets': 'Manifold',
  'Manifold': 'Manifold',
  'Metaculus': 'Metaculus',
};

const SIZE_CLASSES = {
  xs: 'px-1 py-0 text-[9px]',
  sm: 'px-1.5 py-0.5 text-[10px]',
  md: 'px-2 py-0.5 text-xs',
};

export function PlatformBadge({
  platform,
  size = 'sm',
  showFullName = false,
  className = '',
}: PlatformBadgeProps) {
  const platformKey = getPlatformKey(platform);
  const colors = PLATFORM_COLORS[platformKey];
  const displayName = showFullName
    ? (DISPLAY_NAMES[platform] || platform)
    : (SHORT_NAMES[platform] || platform.split(' ')[0]);

  return (
    <span
      className={`
        inline-flex items-center rounded font-medium
        ${colors.bg} ${colors.text}
        ${SIZE_CLASSES[size]}
        ${className}
      `}
    >
      {displayName}
    </span>
  );
}

/**
 * Render multiple platform badges from an array of platform names
 */
export function PlatformBadgeList({
  platforms,
  size = 'sm',
  max = 3,
  className = '',
}: {
  platforms: string[];
  size?: 'xs' | 'sm' | 'md';
  max?: number;
  className?: string;
}) {
  if (!platforms || platforms.length === 0) return null;

  const visiblePlatforms = platforms.slice(0, max);
  const hiddenCount = platforms.length - max;

  return (
    <div className={`flex items-center gap-1 flex-wrap ${className}`}>
      {visiblePlatforms.map((platform) => (
        <PlatformBadge key={platform} platform={platform} size={size} />
      ))}
      {hiddenCount > 0 && (
        <span className={`text-muted-foreground ${SIZE_CLASSES[size]}`}>
          +{hiddenCount}
        </span>
      )}
    </div>
  );
}
