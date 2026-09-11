/**
 * TrendsTab Component
 * Displays trending topics across all platforms with filters and search
 */

import { useState, useEffect, useMemo } from 'react'
import { TrendingUp, ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import { useAutoRefresh, REFRESH_INTERVALS } from '../../hooks/useAutoRefresh'
import { SkeletonCard } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'
import { LastUpdated } from '../ui/LastUpdated'
import { FilterChips } from '../ui/FilterChips'
import { SearchInput } from '../ui/SearchInput'
import type { TrendingTopic, TrendCategory, TrendSortOption } from '../../types'

const CATEGORY_OPTIONS = [
  { value: 'all' as TrendCategory, label: 'All' },
  { value: 'crypto' as TrendCategory, label: 'Crypto' },
  { value: 'sports' as TrendCategory, label: 'Sports' },
  { value: 'events' as TrendCategory, label: 'Events' },
  { value: 'forecasting' as TrendCategory, label: 'Forecasting' },
]

const SORT_OPTIONS = [
  { value: 'score' as TrendSortOption, label: 'Score' },
  { value: 'volume' as TrendSortOption, label: 'Volume' },
  { value: 'markets' as TrendSortOption, label: 'Markets' },
  { value: 'velocity' as TrendSortOption, label: 'Velocity' },
]

export function TrendsTab() {
  const [category, setCategory] = useState<TrendCategory>('all')
  const [sortBy, setSortBy] = useState<TrendSortOption>('score')
  const [search, setSearch] = useState('')

  const { data: trends, loading, error, lastUpdated, fetch } = useApi<TrendingTopic[]>()

  const loadTrends = async () => {
    await fetch('/api/trends?limit=50')
  }

  // Auto-load and refresh
  useAutoRefresh({
    interval: REFRESH_INTERVALS.SLOW,
    onRefresh: loadTrends,
    immediate: true,
  })

  // Filter and sort trends
  const filteredTrends = useMemo(() => {
    if (!trends) return []

    let result = [...trends]

    // Filter by category
    if (category !== 'all') {
      result = result.filter((t) => {
        const trendCategory = t.category?.toLowerCase() || 'events'
        return trendCategory === category
      })
    }

    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase()
      result = result.filter((t) =>
        t.topic.toLowerCase().includes(searchLower) ||
        t.normalizedTopic.toLowerCase().includes(searchLower)
      )
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'score':
          return b.score - a.score
        case 'volume':
          return b.totalVolume - a.totalVolume
        case 'markets':
          return b.totalMarkets - a.totalMarkets
        case 'velocity':
          return Math.abs(b.velocity) - Math.abs(a.velocity)
        default:
          return 0
      }
    })

    return result
  }, [trends, category, sortBy, search])

  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
    return n.toFixed(0)
  }

  const VelocityIndicator = ({ velocity }: { velocity: number }) => {
    if (velocity > 0.5) {
      return <ArrowUp className="w-4 h-4 text-success" />
    } else if (velocity < -0.5) {
      return <ArrowDown className="w-4 h-4 text-destructive" />
    }
    return <Minus className="w-4 h-4 text-text-muted" />
  }

  // Loading state
  if (loading && !trends) {
    return (
      <div className="panel">
        <div className="flex items-center justify-between mb-5">
          <h2>Trending topics across all platforms</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    )
  }

  // Error state
  if (error && !trends) {
    return (
      <div className="panel">
        <EmptyState
          variant="error"
          message={error}
          action={{ label: 'Try again', onClick: loadTrends }}
        />
      </div>
    )
  }

  return (
    <div className="panel">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-6 h-6 text-primary" />
          <div>
            <h2 className="text-lg font-semibold">Trending topics</h2>
            <p className="text-sm text-text-secondary">
              Hot topics across {trends?.length || 0} markets on 12 platforms
            </p>
          </div>
        </div>
        <LastUpdated
          timestamp={lastUpdated}
          onRefresh={loadTrends}
          loading={loading}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search topics..."
          />
        </div>
        <FilterChips
          options={CATEGORY_OPTIONS}
          value={category}
          onChange={setCategory}
          size="sm"
        />
      </div>

      {/* Sort */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-text-secondary">Sort by:</span>
        <FilterChips
          options={SORT_OPTIONS}
          value={sortBy}
          onChange={setSortBy}
          size="sm"
        />
      </div>

      {/* Results */}
      {filteredTrends.length === 0 ? (
        <EmptyState
          variant={search || category !== 'all' ? 'no-results' : 'empty'}
          message={
            search
              ? `No topics matching "${search}"`
              : 'No trending topics in this category'
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTrends.map((trend) => (
            <div key={trend.normalizedTopic} className="trend-card">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-medium text-text-primary line-clamp-2">
                  {trend.topic}
                </h3>
                <div className="flex items-center gap-1 ml-2 shrink-0">
                  <VelocityIndicator velocity={trend.velocity} />
                  <span className="text-lg font-bold text-secondary">
                    {trend.score.toFixed(0)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 bg-surface text-text-secondary text-xs rounded-full">
                  {trend.category || 'General'}
                </span>
                <span
                  className={`text-xs ${
                    trend.velocity > 0
                      ? 'text-success'
                      : trend.velocity < 0
                      ? 'text-destructive'
                      : 'text-text-muted'
                  }`}
                >
                  {trend.velocity > 0 ? '+' : ''}
                  {trend.velocity.toFixed(1)} velocity
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center mb-3">
                <div className="bg-surface rounded-lg p-2">
                  <div className="text-xs text-text-secondary">Markets</div>
                  <div className="font-semibold">{trend.totalMarkets}</div>
                </div>
                <div className="bg-surface rounded-lg p-2">
                  <div className="text-xs text-text-secondary">Volume</div>
                  <div className="font-semibold">${formatNumber(trend.totalVolume)}</div>
                </div>
                <div className="bg-surface rounded-lg p-2">
                  <div className="text-xs text-text-secondary">Platforms</div>
                  <div className="font-semibold">{trend.platforms?.length || 0}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-1">
                {trend.platforms?.slice(0, 4).map((p) => (
                  <span
                    key={p.platform}
                    className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full"
                  >
                    {p.platform}
                  </span>
                ))}
                {(trend.platforms?.length || 0) > 4 && (
                  <span className="px-2 py-0.5 bg-surface-raised text-text-muted text-xs rounded-full">
                    +{trend.platforms.length - 4}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default TrendsTab
