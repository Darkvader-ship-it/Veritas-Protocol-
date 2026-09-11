import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * StatCard - Standardized stat display card
 *
 * Usage:
 * <StatCard label="Win Rate" color="success">58.2%</StatCard>
 * <StatCard label="VeritasScore" color="secondary">847</StatCard>
 * <StatCard label="Volume" color="primary">$43.3M</StatCard>
 */

type StatColor = 'primary' | 'secondary' | 'success' | 'destructive' | 'muted';

const colorMap: Record<StatColor, { bg: string; text: string; border: string }> = {
  primary: { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/20' },
  secondary: { bg: 'bg-secondary/10', text: 'text-secondary', border: 'border-secondary/20' },
  success: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/20' },
  destructive: { bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/20' },
  muted: { bg: 'bg-surface/50', text: 'text-foreground', border: 'border-border' },
};

interface StatCardProps {
  children: React.ReactNode;
  label: string;
  color?: StatColor;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: { padding: 'p-1.5 sm:p-2', value: 'text-sm sm:text-lg', label: 'text-[9px] sm:text-[10px]' },
  md: { padding: 'p-2 sm:p-3', value: 'text-base sm:text-xl', label: 'text-[10px] sm:text-xs' },
  lg: { padding: 'p-3 sm:p-4', value: 'text-xl sm:text-2xl', label: 'text-xs' },
};

export function StatCard({
  children,
  label,
  color = 'muted',
  size = 'md',
  className,
}: StatCardProps) {
  const colors = colorMap[color];
  const sizes = sizeMap[size];

  return (
    <div
      className={cn(
        'rounded-xl border text-center overflow-hidden',
        colors.bg,
        colors.border,
        sizes.padding,
        className
      )}
    >
      <p className={cn('font-bold tabular-nums truncate whitespace-nowrap', colors.text, sizes.value)}>
        {children}
      </p>
      <p className={cn('text-muted-foreground mt-0.5', sizes.label)}>{label}</p>
    </div>
  );
}

/**
 * StatRow - Horizontal row of stats with consistent spacing
 */
interface StatRowProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
}

const gapMap = {
  sm: 'gap-2',
  md: 'gap-3',
  lg: 'gap-4',
};

export function StatRow({ children, columns = 3, gap = 'md', className }: StatRowProps) {
  return (
    <div
      className={cn(
        'grid',
        columns === 2 && 'grid-cols-2',
        columns === 3 && 'grid-cols-3',
        columns === 4 && 'grid-cols-4',
        gapMap[gap],
        className
      )}
    >
      {children}
    </div>
  );
}
