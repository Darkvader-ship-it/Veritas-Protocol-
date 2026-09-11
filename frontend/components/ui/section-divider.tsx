import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * SectionDivider - Horizontal line divider with fade effect
 *
 * Used between major page sections for visual separation.
 * The line fades at the edges for a polished look.
 *
 * Variants:
 * - default: Simple line that fades at both edges
 * - accent: Uses data-stream class for animated effect
 */

interface SectionDividerProps {
  variant?: 'default' | 'accent';
  className?: string;
}

export function SectionDivider({ variant = 'default', className }: SectionDividerProps) {
  if (variant === 'accent') {
    // Animated data stream divider (matches homepage)
    return <div className={cn('data-stream', className)} />;
  }

  // Default: subtle fading line
  return (
    <div
      className={cn(
        'h-px w-full bg-gradient-to-r from-transparent via-border to-transparent',
        className
      )}
    />
  );
}

/**
 * DataStream - The animated accent line used between hero and content
 */
export function DataStream({ className }: { className?: string }) {
  return <div className={cn('data-stream', className)} />;
}
