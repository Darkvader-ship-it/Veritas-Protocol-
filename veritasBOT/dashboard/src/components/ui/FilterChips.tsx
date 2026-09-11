/**
 * FilterChips Component
 * Reusable filter chip/button group
 */

import { clsx } from 'clsx'

export interface FilterOption<T extends string = string> {
  value: T
  label: string
  count?: number
}

interface FilterChipsProps<T extends string = string> {
  options: FilterOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
  size?: 'sm' | 'md'
}

export function FilterChips<T extends string = string>({
  options,
  value,
  onChange,
  className = '',
  size = 'md',
}: FilterChipsProps<T>) {
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={clsx(
            'rounded-full font-medium transition-all',
            sizeClasses[size],
            value === option.value
              ? 'bg-primary text-white'
              : 'bg-surface-raised text-text-secondary hover:bg-surface-raised/80 hover:text-text-primary'
          )}
        >
          {option.label}
          {option.count !== undefined && (
            <span
              className={clsx(
                'ml-1.5 px-1.5 py-0.5 rounded-full text-xs',
                value === option.value
                  ? 'bg-white/20'
                  : 'bg-surface text-text-muted'
              )}
            >
              {option.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

// Tier-specific filter chips with colors
export interface TierFilterOption {
  value: string
  label: string
  color?: string
}

const TIER_COLORS: Record<string, string> = {
  all: 'bg-primary',
  DIAMOND: 'bg-tier-diamond',
  PLATINUM: 'bg-tier-platinum',
  GOLD: 'bg-tier-gold',
  SILVER: 'bg-tier-silver',
  BRONZE: 'bg-tier-bronze',
}

export function TierFilterChips({
  options,
  value,
  onChange,
  className = '',
}: {
  options: TierFilterOption[]
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {options.map((option) => {
        const isActive = value === option.value
        const colorClass = TIER_COLORS[option.value] || 'bg-primary'

        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={clsx(
              'px-3 py-1.5 rounded-full text-sm font-medium transition-all',
              isActive
                ? `${colorClass} text-white`
                : 'bg-surface-raised text-text-secondary hover:text-text-primary'
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export default FilterChips
