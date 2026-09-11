/**
 * LeaderboardTab Component
 * Unified cross-platform leaderboard with tier filters and search
 */

import { useState, useMemo } from 'react'
import { Users, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import { useAutoRefresh, REFRESH_INTERVALS } from '../../hooks/useAutoRefresh'
import { SkeletonTable } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'
import { LastUpdated } from '../ui/LastUpdated'
import { TierFilterChips } from '../ui/FilterChips'
import { SearchInput } from '../ui/SearchInput'
import { WinRateChart } from '../charts'
import type { UnifiedTrader, Tier, LeaderboardSortOption } from '../../types'

const TIER_OPTIONS = [
  { value: 'all', label: 'All tiers' },
  { value: 'DIAMOND', label: 'Diamond' },
  { value: 'PLATINUM', label: 'Platinum' },
  { value: 'GOLD', label: 'Gold' },
  { value: 'SILVER', label: 'Silver' },
  { value: 'BRONZE', label: 'Bronze' },
]

const TIER_COLORS: Record<Tier, string> = {
  DIAMOND: 'bg-tier-diamond',
  PLATINUM: 'bg-tier-platinum',
  GOLD: 'bg-tier-gold',
  SILVER: 'bg-tier-silver',
  BRONZE: 'bg-tier-bronze',
}

export function LeaderboardTab() {
  const [tierFilter, setTierFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<LeaderboardSortOption>('score')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)

  const { data: traders, loading, error, lastUpdated, fetch } = useApi<UnifiedTrader[]>()

  const loadLeaderboard = async () => {
    await fetch('/api/leaderboard/unified?limit=100')
  }

  useAutoRefresh({
    interval: REFRESH_INTERVALS.VERY_SLOW,
    onRefresh: loadLeaderboard,
    immediate: true,
  })

  const filteredTraders = useMemo(() => {
    if (!traders) return []

    let result = [...traders]

    // Filter by tier
    if (tierFilter !== 'all') {
      result = result.filter((t) => t.tier === tierFilter)
    }

    // Filter by search (address)
    if (search) {
      const searchLower = search.toLowerCase()
      result = result.filter((t) =>
        t.primaryAddress.toLowerCase().includes(searchLower) ||
        t.displayName?.toLowerCase().includes(searchLower)
      )
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'score':
          comparison = a.unifiedScore - b.unifiedScore
          break
        case 'winRate':
          comparison = a.winRate - b.winRate
          break
        case 'volume':
          comparison = a.totalVolume - b.totalVolume
          break
        case 'roi':
          comparison = a.overallRoi - b.overallRoi
          break
      }
      return sortOrder === 'desc' ? -comparison : comparison
    })

    return result
  }, [traders, tierFilter, search, sortBy, sortOrder])

  const handleSort = (column: LeaderboardSortOption) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')
    } else {
      setSortBy(column)
      setSortOrder('desc')
    }
  }

  const copyAddress = async (address: string) => {
    await navigator.clipboard.writeText(address)
    setCopiedAddress(address)
    setTimeout(() => setCopiedAddress(null), 2000)
  }

  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
    return n.toFixed(0)
  }

  const formatPercent = (n: number) => `${(n * 100).toFixed(1)}%`

  const SortIcon = ({ column }: { column: LeaderboardSortOption }) => {
    if (sortBy !== column) return null
    return sortOrder === 'desc' ? (
      <ChevronDown className="w-4 h-4 inline" />
    ) : (
      <ChevronUp className="w-4 h-4 inline" />
    )
  }

  if (loading && !traders) {
    return (
      <div className="panel">
        <div className="flex items-center justify-between mb-5">
          <h2>Unified cross-platform leaderboard</h2>
        </div>
        <SkeletonTable rows={10} />
      </div>
    )
  }

  if (error && !traders) {
    return (
      <div className="panel">
        <EmptyState
          variant="error"
          message={error}
          action={{ label: 'Try again', onClick: loadLeaderboard }}
        />
      </div>
    )
  }

  return (
    <div className="panel">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-primary" />
          <div>
            <h2 className="text-lg font-semibold">Leaderboard</h2>
            <p className="text-sm text-text-secondary">
              {filteredTraders.length} traders across 12 platforms
            </p>
          </div>
        </div>
        <LastUpdated
          timestamp={lastUpdated}
          onRefresh={loadLeaderboard}
          loading={loading}
        />
      </div>

      {/* Win Rate Chart */}
      {traders && traders.length > 0 && (
        <div className="mb-6 p-4 bg-surface-raised rounded-lg">
          <h3 className="text-sm text-text-secondary mb-3">Win rate distribution</h3>
          <WinRateChart
            traders={traders.map((t) => ({
              address: t.primaryAddress,
              winRate: t.winRate,
              tier: t.tier,
            }))}
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 max-w-sm">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by address..."
          />
        </div>
        <TierFilterChips
          options={TIER_OPTIONS}
          value={tierFilter}
          onChange={setTierFilter}
        />
      </div>

      {/* Table */}
      {filteredTraders.length === 0 ? (
        <EmptyState
          variant={search || tierFilter !== 'all' ? 'no-results' : 'empty'}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">
                  Rank
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">
                  Address
                </th>
                <th
                  className="text-left py-3 px-4 text-sm font-medium text-text-secondary cursor-pointer hover:text-text-primary"
                  onClick={() => handleSort('score')}
                >
                  Score <SortIcon column="score" />
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">
                  Tier
                </th>
                <th
                  className="text-left py-3 px-4 text-sm font-medium text-text-secondary cursor-pointer hover:text-text-primary"
                  onClick={() => handleSort('winRate')}
                >
                  Win rate <SortIcon column="winRate" />
                </th>
                <th
                  className="text-left py-3 px-4 text-sm font-medium text-text-secondary cursor-pointer hover:text-text-primary"
                  onClick={() => handleSort('volume')}
                >
                  Volume <SortIcon column="volume" />
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">
                  Platforms
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredTraders.map((trader, i) => (
                <>
                  <tr
                    key={trader.primaryAddress}
                    className="border-b border-border/50 hover:bg-surface-raised/50 cursor-pointer transition-colors"
                    onClick={() =>
                      setExpandedRow(
                        expandedRow === trader.primaryAddress
                          ? null
                          : trader.primaryAddress
                      )
                    }
                  >
                    <td className="py-3 px-4 text-text-secondary">#{i + 1}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">
                          {trader.primaryAddress.slice(0, 8)}...
                          {trader.primaryAddress.slice(-6)}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            copyAddress(trader.primaryAddress)
                          }}
                          className="p-1 hover:bg-surface rounded transition-colors"
                          title="Copy address"
                        >
                          {copiedAddress === trader.primaryAddress ? (
                            <Check className="w-3 h-3 text-success" />
                          ) : (
                            <Copy className="w-3 h-3 text-text-muted" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-secondary">
                        {trader.unifiedScore}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium text-white ${
                          TIER_COLORS[trader.tier]
                        }`}
                      >
                        {trader.tier}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={
                          trader.winRate >= 0.55
                            ? 'text-success'
                            : trader.winRate < 0.5
                            ? 'text-destructive'
                            : ''
                        }
                      >
                        {formatPercent(trader.winRate)}
                      </span>
                    </td>
                    <td className="py-3 px-4">${formatNumber(trader.totalVolume)}</td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1">
                        {trader.activePlatforms?.slice(0, 3).map((p) => (
                          <span
                            key={p}
                            className="px-1.5 py-0.5 bg-surface text-xs rounded"
                          >
                            {p}
                          </span>
                        ))}
                        {(trader.activePlatforms?.length || 0) > 3 && (
                          <span className="px-1.5 py-0.5 bg-surface-raised text-xs rounded">
                            +{trader.activePlatforms.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                  {/* Expanded row */}
                  {expandedRow === trader.primaryAddress && trader.platformScores && (
                    <tr className="bg-surface-raised/30">
                      <td colSpan={7} className="p-4">
                        <div className="text-sm text-text-secondary mb-2">
                          Platform breakdown
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                          {trader.platformScores.map((ps) => (
                            <div
                              key={ps.platform}
                              className="p-2 bg-surface rounded-lg"
                            >
                              <div className="font-medium text-text-primary text-sm">
                                {ps.platform}
                              </div>
                              <div className="text-xs text-text-secondary mt-1">
                                Score: {ps.score} • WR: {formatPercent(ps.winRate)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default LeaderboardTab
