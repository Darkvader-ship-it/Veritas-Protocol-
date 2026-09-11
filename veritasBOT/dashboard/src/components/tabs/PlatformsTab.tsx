/**
 * PlatformsTab Component
 * Platform status and health monitoring
 */

import { BarChart3, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import { useAutoRefresh, REFRESH_INTERVALS } from '../../hooks/useAutoRefresh'
import { SkeletonCard } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'
import { LastUpdated } from '../ui/LastUpdated'
import { PlatformVolumeChart } from '../charts'
import type { PlatformStatus } from '../../types'

const PLATFORM_COLORS: Record<string, string> = {
  dreamdex: 'border-l-yellow-500',
  polymarket: 'border-l-indigo-500',
  azuro: 'border-l-green-500',
  overtime: 'border-l-red-500',
  limitless: 'border-l-purple-500',
  speedmarkets: 'border-l-orange-500',
  sxbet: 'border-l-cyan-500',
  gnosis: 'border-l-emerald-500',
  drift: 'border-l-violet-500',
  kalshi: 'border-l-blue-500',
  manifold: 'border-l-pink-500',
  metaculus: 'border-l-teal-500',
}

function getRelativeTime(dateStr?: string): string {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMin / 60)

  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  return date.toLocaleDateString()
}

export function PlatformsTab() {
  const { data: platforms, loading, error, lastUpdated, fetch } = useApi<PlatformStatus[]>()

  const loadStatuses = async () => {
    await fetch('/api/platforms/status')
  }

  useAutoRefresh({
    interval: REFRESH_INTERVALS.NORMAL,
    onRefresh: loadStatuses,
    immediate: true,
  })

  const healthyCount = platforms?.filter((p) => p.status === 'ok').length || 0
  const totalCount = platforms?.length || 0

  if (loading && !platforms) {
    return (
      <div className="panel">
        <div className="flex items-center justify-between mb-5">
          <h2>Platform status</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    )
  }

  if (error && !platforms) {
    return (
      <div className="panel">
        <EmptyState
          variant="error"
          message={error}
          action={{ label: 'Try again', onClick: loadStatuses }}
        />
      </div>
    )
  }

  return (
    <div className="panel">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-6 h-6 text-primary" />
          <div>
            <h2 className="text-lg font-semibold">Platform status</h2>
            <p className="text-sm text-text-secondary">
              {healthyCount}/{totalCount} platforms healthy
            </p>
          </div>
        </div>
        <LastUpdated
          timestamp={lastUpdated}
          onRefresh={loadStatuses}
          loading={loading}
        />
      </div>

      {/* Health Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-success">{healthyCount}</div>
          <div className="text-sm text-text-secondary">Healthy</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-destructive">
            {totalCount - healthyCount}
          </div>
          <div className="text-sm text-text-secondary">Issues</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-text-primary">
            {platforms?.reduce((sum, p) => sum + p.leaderboardCount, 0) || 0}
          </div>
          <div className="text-sm text-text-secondary">Total traders</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-text-primary">
            {platforms?.reduce((sum, p) => sum + p.marketsCount, 0) || 0}
          </div>
          <div className="text-sm text-text-secondary">Total markets</div>
        </div>
      </div>

      {/* Volume Chart */}
      {platforms && platforms.length > 0 && (
        <div className="mb-6 p-4 bg-surface-raised rounded-lg">
          <h3 className="text-sm text-text-secondary mb-3">Traders by platform</h3>
          <PlatformVolumeChart platforms={platforms} />
        </div>
      )}

      {/* Platform Cards */}
      {platforms && platforms.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {platforms.map((platform) => (
            <div
              key={platform.platform}
              className={`card p-4 border-l-4 ${
                PLATFORM_COLORS[platform.platform] || 'border-l-primary'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-text-primary capitalize">
                  {platform.platform}
                </h3>
                {platform.status === 'ok' ? (
                  <div className="flex items-center gap-1 text-success">
                    <CheckCircle className="w-5 h-5" />
                    <span className="text-xs">Healthy</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-destructive">
                    <XCircle className="w-5 h-5" />
                    <span className="text-xs">Error</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-surface rounded-lg p-2 text-center">
                  <div className="text-lg font-semibold">
                    {platform.leaderboardCount}
                  </div>
                  <div className="text-xs text-text-secondary">Traders</div>
                </div>
                <div className="bg-surface rounded-lg p-2 text-center">
                  <div className="text-lg font-semibold">
                    {platform.marketsCount}
                  </div>
                  <div className="text-xs text-text-secondary">Markets</div>
                </div>
              </div>

              <div className="flex items-center gap-1 text-xs text-text-muted">
                <Clock className="w-3 h-3" />
                Last sync: {getRelativeTime(platform.lastLeaderboardSync)}
              </div>

              {platform.errorMessage && (
                <div className="mt-2 p-2 bg-destructive/10 rounded text-xs text-destructive">
                  {platform.errorMessage}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState variant="empty" message="No platform data available" />
      )}
    </div>
  )
}

export default PlatformsTab
