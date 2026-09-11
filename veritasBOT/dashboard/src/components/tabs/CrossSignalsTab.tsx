/**
 * CrossSignalsTab Component
 * Displays cross-platform consensus signals with filtering
 */

import { useState, useMemo } from 'react'
import { Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import { useAutoRefresh, REFRESH_INTERVALS } from '../../hooks/useAutoRefresh'
import { SkeletonCard } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'
import { LastUpdated } from '../ui/LastUpdated'
import { FilterChips } from '../ui/FilterChips'
import { SearchInput } from '../ui/SearchInput'
import type { CrossPlatformSignal, CrossConsensus } from '../../types'

type ConsensusFilter = 'all' | CrossConsensus

const CONSENSUS_OPTIONS = [
  { value: 'all' as ConsensusFilter, label: 'All' },
  { value: 'STRONG_YES' as ConsensusFilter, label: 'Strong Yes' },
  { value: 'LEAN_YES' as ConsensusFilter, label: 'Lean Yes' },
  { value: 'MIXED' as ConsensusFilter, label: 'Mixed' },
  { value: 'LEAN_NO' as ConsensusFilter, label: 'Lean No' },
  { value: 'STRONG_NO' as ConsensusFilter, label: 'Strong No' },
]

const CONSENSUS_STYLES: Record<CrossConsensus, { bg: string; text: string; icon: typeof TrendingUp }> = {
  STRONG_YES: { bg: 'bg-success/20', text: 'text-success', icon: TrendingUp },
  LEAN_YES: { bg: 'bg-success/10', text: 'text-success', icon: TrendingUp },
  MIXED: { bg: 'bg-warning/10', text: 'text-warning', icon: Minus },
  LEAN_NO: { bg: 'bg-destructive/10', text: 'text-destructive', icon: TrendingDown },
  STRONG_NO: { bg: 'bg-destructive/20', text: 'text-destructive', icon: TrendingDown },
}

export function CrossSignalsTab() {
  const [filter, setFilter] = useState<ConsensusFilter>('all')
  const [search, setSearch] = useState('')

  const { data: signals, loading, error, lastUpdated, fetch } = useApi<CrossPlatformSignal[]>()

  const loadSignals = async () => {
    await fetch('/api/cross-signals?limit=50')
  }

  useAutoRefresh({
    interval: REFRESH_INTERVALS.NORMAL,
    onRefresh: loadSignals,
    immediate: true,
  })

  const filteredSignals = useMemo(() => {
    if (!signals) return []

    let result = [...signals]

    if (filter !== 'all') {
      result = result.filter((s) => s.consensus === filter)
    }

    if (search) {
      const searchLower = search.toLowerCase()
      result = result.filter((s) =>
        s.topic.toLowerCase().includes(searchLower)
      )
    }

    return result
  }, [signals, filter, search])

  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
    return n.toFixed(0)
  }

  const formatPercent = (n: number) => `${(n * 100).toFixed(0)}%`

  if (loading && !signals) {
    return (
      <div className="panel">
        <div className="flex items-center justify-between mb-5">
          <h2>Cross-platform consensus signals</h2>
        </div>
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    )
  }

  if (error && !signals) {
    return (
      <div className="panel">
        <EmptyState
          variant="error"
          message={error}
          action={{ label: 'Try again', onClick: loadSignals }}
        />
      </div>
    )
  }

  return (
    <div className="panel">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-primary" />
          <div>
            <h2 className="text-lg font-semibold">Cross-platform signals</h2>
            <p className="text-sm text-text-secondary">
              Consensus from multiple prediction markets
            </p>
          </div>
        </div>
        <LastUpdated
          timestamp={lastUpdated}
          onRefresh={loadSignals}
          loading={loading}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 max-w-sm">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search signals..."
          />
        </div>
        <FilterChips
          options={CONSENSUS_OPTIONS}
          value={filter}
          onChange={setFilter}
          size="sm"
        />
      </div>

      {/* Signals List */}
      {filteredSignals.length === 0 ? (
        <EmptyState
          variant={search || filter !== 'all' ? 'no-results' : 'empty'}
        />
      ) : (
        <div className="space-y-4">
          {filteredSignals.map((signal, i) => {
            const style = CONSENSUS_STYLES[signal.consensus]
            const Icon = style.icon

            return (
              <div
                key={signal.normalizedTopic || i}
                className={`card p-4 border-l-4 ${style.bg} border-l-current ${style.text}`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Topic and Consensus */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="w-5 h-5" />
                      <h3 className="font-semibold text-text-primary">
                        {signal.topic}
                      </h3>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}
                      >
                        {signal.consensus.replace(/_/g, ' ')}
                      </span>
                    </div>

                    {/* Stats */}
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div>
                        <span className="text-text-secondary">Confidence:</span>{' '}
                        <span className="font-medium">{signal.confidence.toFixed(0)}%</span>
                      </div>
                      <div>
                        <span className="text-text-secondary">Probability:</span>{' '}
                        <span className="font-medium">
                          {formatPercent(signal.volumeWeightedProbability)}
                        </span>
                      </div>
                      <div>
                        <span className="text-text-secondary">Markets:</span>{' '}
                        <span className="font-medium">{signal.marketCount}</span>
                      </div>
                      <div>
                        <span className="text-text-secondary">Volume:</span>{' '}
                        <span className="font-medium">${formatNumber(signal.totalVolume)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Platform breakdown */}
                  <div className="flex flex-wrap gap-2">
                    {signal.platforms?.slice(0, 4).map((p) => (
                      <div
                        key={p.platform}
                        className="px-3 py-1.5 bg-surface rounded-lg text-xs"
                      >
                        <div className="font-medium text-text-primary">
                          {p.platform}
                        </div>
                        <div className="text-text-secondary">
                          {formatPercent(p.probability)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default CrossSignalsTab
