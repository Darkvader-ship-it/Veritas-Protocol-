/**
 * SignalsTab Component
 * DreamDEX smart money signals
 */

import { useState } from 'react'
import { Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import { useAutoRefresh, REFRESH_INTERVALS } from '../../hooks/useAutoRefresh'
import { SkeletonCard, SkeletonTable } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'
import { LastUpdated } from '../ui/LastUpdated'
import { SignalHistoryChart } from '../charts'
import type { Signal, Trader } from '../../types'

const CONSENSUS_CONFIG = {
  BULL: { color: 'text-success', bg: 'bg-success/20', icon: TrendingUp },
  BEAR: { color: 'text-destructive', bg: 'bg-destructive/20', icon: TrendingDown },
  NEUTRAL: { color: 'text-warning', bg: 'bg-warning/20', icon: Minus },
}

const TIER_COLORS: Record<string, string> = {
  DIAMOND: 'bg-tier-diamond',
  PLATINUM: 'bg-tier-platinum',
  GOLD: 'bg-tier-gold',
  SILVER: 'bg-tier-silver',
  BRONZE: 'bg-tier-bronze',
}

export function SignalsTab() {
  const [activeSection, setActiveSection] = useState<'signal' | 'traders'>('signal')

  const { data: currentSignal, loading: loadingSignal, lastUpdated: signalUpdated, fetch: fetchSignal } = useApi<Signal>()
  const { data: signalHistory, loading: loadingHistory, fetch: fetchHistory } = useApi<Signal[]>()
  const { data: traders, loading: loadingTraders, fetch: fetchTraders } = useApi<Trader[]>()

  const loadSignal = async () => {
    await fetchSignal('/api/signals/current/dreamdex')
  }

  const loadHistory = async () => {
    await fetchHistory('/api/signals/history?limit=20')
  }

  const loadTraders = async () => {
    await fetchTraders('/api/signals/traders')
  }

  const loadAll = async () => {
    await Promise.all([loadSignal(), loadHistory(), loadTraders()])
  }

  useAutoRefresh({
    interval: REFRESH_INTERVALS.FAST,
    onRefresh: loadAll,
    immediate: true,
  })

  const formatStt = (wei: string) => {
    try {
      return (Number(BigInt(wei)) / 1e18).toFixed(4)
    } catch {
      return parseFloat(wei).toFixed(2)
    }
  }

  const formatPercent = (n: number) => `${n.toFixed(1)}%`

  const loading = loadingSignal && !currentSignal

  if (loading) {
    return (
      <div className="panel">
        <div className="flex items-center justify-between mb-5">
          <h2>DreamDEX smart money signals</h2>
        </div>
        <SkeletonCard />
        <div className="mt-4">
          <SkeletonTable rows={5} />
        </div>
      </div>
    )
  }

  const config = currentSignal ? CONSENSUS_CONFIG[currentSignal.consensus] : null
  const Icon = config?.icon || Minus

  return (
    <div className="panel">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-primary" />
          <div>
            <h2 className="text-lg font-semibold">DreamDEX signals</h2>
            <p className="text-sm text-text-secondary">
              Smart money consensus from top traders
            </p>
          </div>
        </div>
        <LastUpdated
          timestamp={signalUpdated}
          onRefresh={loadAll}
          loading={loadingSignal}
        />
      </div>

      {/* Current Signal */}
      {currentSignal && config && (
        <div className={`card p-6 mb-6 ${config.bg} border border-current/20`}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-text-secondary">
              Epoch {currentSignal.epoch}
            </span>
            <span className={`text-sm ${config.color}`}>
              {currentSignal.signalStrength} signal
            </span>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <div className={`p-4 rounded-full ${config.bg}`}>
              <Icon className={`w-8 h-8 ${config.color}`} />
            </div>
            <div>
              <div className={`text-3xl font-bold ${config.color}`}>
                {currentSignal.consensus}
              </div>
              <div className="text-sm text-text-secondary">
                {formatPercent(currentSignal.confidence)} confidence
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-surface/50 rounded-lg p-3 text-center">
              <div className="text-xl font-bold">
                {formatPercent(currentSignal.weightedBullPercent)}
              </div>
              <div className="text-xs text-text-secondary">Bull %</div>
            </div>
            <div className="bg-surface/50 rounded-lg p-3 text-center">
              <div className="text-xl font-bold">
                {currentSignal.participatingTraders}
              </div>
              <div className="text-xs text-text-secondary">Traders</div>
            </div>
            <div className="bg-surface/50 rounded-lg p-3 text-center">
              <div className="text-xl font-bold">
                {currentSignal.diamondTraderCount}
              </div>
              <div className="text-xs text-text-secondary">Diamond</div>
            </div>
            <div className="bg-surface/50 rounded-lg p-3 text-center">
              <div className="text-xl font-bold">
                {formatStt(currentSignal.totalVolumeWei)}
              </div>
              <div className="text-xs text-text-secondary">Volume (STT)</div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveSection('signal')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeSection === 'signal'
              ? 'bg-primary text-white'
              : 'bg-surface-raised text-text-secondary hover:text-text-primary'
          }`}
        >
          Signal history
        </button>
        <button
          onClick={() => setActiveSection('traders')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeSection === 'traders'
              ? 'bg-primary text-white'
              : 'bg-surface-raised text-text-secondary hover:text-text-primary'
          }`}
        >
          Tracked traders ({traders?.length || 0})
        </button>
      </div>

      {/* Signal History */}
      {activeSection === 'signal' && (
        <>
          {signalHistory && signalHistory.length > 0 && (
            <div className="mb-6 p-4 bg-surface-raised rounded-lg">
              <h3 className="text-sm text-text-secondary mb-3">Signal trend</h3>
              <SignalHistoryChart signals={signalHistory} />
            </div>
          )}

          {signalHistory && signalHistory.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">
                      Epoch
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">
                      Consensus
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">
                      Confidence
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">
                      Traders
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">
                      Strength
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {signalHistory.map((s) => {
                    const cfg = CONSENSUS_CONFIG[s.consensus]
                    return (
                      <tr
                        key={s.epoch}
                        className="border-b border-border/50 hover:bg-surface-raised/50"
                      >
                        <td className="py-3 px-4">{s.epoch}</td>
                        <td className={`py-3 px-4 font-medium ${cfg.color}`}>
                          {s.consensus}
                        </td>
                        <td className="py-3 px-4">{formatPercent(s.confidence)}</td>
                        <td className="py-3 px-4">{s.participatingTraders}</td>
                        <td className="py-3 px-4">{s.signalStrength}</td>
                        <td className="py-3 px-4 text-text-secondary text-sm">
                          {new Date(s.timestamp).toLocaleTimeString()}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState variant="empty" message="No signal history yet" />
          )}
        </>
      )}

      {/* Traders */}
      {activeSection === 'traders' && (
        <>
          {traders && traders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">
                      Address
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">
                      Tier
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">
                      Score
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">
                      Win rate
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">
                      Bets
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">
                      Volume
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {traders.slice(0, 20).map((t) => (
                    <tr
                      key={t.address}
                      className="border-b border-border/50 hover:bg-surface-raised/50"
                    >
                      <td className="py-3 px-4 font-mono text-sm">
                        {t.address.slice(0, 8)}...{t.address.slice(-6)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium text-white ${
                            TIER_COLORS[t.tier]
                          }`}
                        >
                          {t.tier}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-secondary">
                        {t.veritasScore}
                      </td>
                      <td className="py-3 px-4">
                        {(t.winRate * 100).toFixed(1)}%
                      </td>
                      <td className="py-3 px-4">{t.totalBets}</td>
                      <td className="py-3 px-4">{formatStt(t.totalVolume)} STT</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState variant="empty" message="No tracked traders" />
          )}
        </>
      )}
    </div>
  )
}

export default SignalsTab
