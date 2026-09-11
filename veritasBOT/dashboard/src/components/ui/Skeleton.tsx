/**
 * Skeleton Loading Component
 * Displays animated placeholder while content is loading
 */

import { clsx } from 'clsx'

interface SkeletonProps {
  className?: string
  variant?: 'text' | 'rectangular' | 'circular'
  width?: string | number
  height?: string | number
  count?: number
}

export function Skeleton({
  className,
  variant = 'rectangular',
  width,
  height,
  count = 1,
}: SkeletonProps) {
  const baseClasses = 'animate-pulse bg-surface-raised'

  const variantClasses = {
    text: 'rounded h-4',
    rectangular: 'rounded-lg',
    circular: 'rounded-full',
  }

  const style: React.CSSProperties = {
    width: width ?? (variant === 'circular' ? height : '100%'),
    height: height ?? (variant === 'text' ? '1rem' : '100%'),
  }

  if (count > 1) {
    return (
      <div className="space-y-2">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className={clsx(baseClasses, variantClasses[variant], className)}
            style={style}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      className={clsx(baseClasses, variantClasses[variant], className)}
      style={style}
    />
  )
}

// Pre-built skeleton patterns
export function SkeletonCard() {
  return (
    <div className="card p-4 space-y-3">
      <Skeleton height={20} width="60%" />
      <Skeleton height={16} count={2} />
      <div className="flex gap-2 mt-2">
        <Skeleton width={60} height={24} />
        <Skeleton width={60} height={24} />
      </div>
    </div>
  )
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      <Skeleton height={40} className="rounded-t-lg" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={48} />
      ))}
    </div>
  )
}

export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-4 text-center">
          <Skeleton height={12} width="50%" className="mx-auto mb-2" />
          <Skeleton height={24} width="70%" className="mx-auto" />
        </div>
      ))}
    </div>
  )
}

export default Skeleton
