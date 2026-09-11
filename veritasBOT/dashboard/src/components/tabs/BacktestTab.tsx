/**
 * BacktestTab Component
 * Backtesting engine for simulating copy trading strategies
 */

import { useState } from 'react'
import { BarChart3, Play } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import { SkeletonCard } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'
import { EquityCurve } from '../charts'
import type { BacktestResult } from '../../types'

export function BacktestTab() {
  const [leader, setLeader] = useState('')
  const [days, setDays] = useState('30')

  const { data: result, loading, error, fetch } = useApi<BacktestResult>()

  const runBacktest = async () => {
    if (!leader) return

    const endDate = new Date()
    const startDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000)

    await fetch('/api/backtest', {
      method: 'POST',
      body: JSON.stringify({
        leader,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        initialCapital: 1,
        allocationPercent: 0.1,
        compounding: true,
      }),
    })
  }

  const formatPercent = (n: number) => `${(n * 100).toFixed(1)}%`

  return (
    <div className="panel">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <BarChart3 className="w-6 h-6 text-primary" />
        <div>
          <h2 className="text-lg font-semibold">Backtesting engine</h2>
          <p className="text-sm text-text-secondary">
            Simulate copy trading performance over historical data
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="card p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">
              Leader address
            </label>
            <input
              type="text"
              value={leader}
              onChange={(e) => setLeader(e.target.value)}
              placeholder="0x..."
              className="w-full px-3 py-2 bg-surface-raised border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">
              Time period
            </label>
            <select
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="w-full px-3 py-2 bg-surface-raised border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
            >
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="180">180 days</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={runBacktest}
              disabled={loading || !leader}
              className="w-full px-4 py-2 bg-primary text-white rounded-lg font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              {loading ? 'Running...' : 'Run backtest'}
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="card p-4 mb-6 bg-destructive/10 border border-destructive/20">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && !result && <SkeletonCard />}

      {/* Results */}
      {result && (
        <>
          {/* Equity Curve */}
          {result.trades && result.trades.length > 0 && (
            <div className="mb-6 p-4 bg-surface-raised rounded-lg">
              <h3 className="text-sm text-text-secondary mb-3">Equity curve</h3>
              <EquityCurve trades={result.trades} initialCapital={1} />
            </div>
          )}

          {/* Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="card p-4 text-center">
              <div
                className={`text-xl font-bold ${
                  result.totalReturn >= 0 ? 'text-success' : 'text-destructive'
                }`}
              >
                {result.totalReturn >= 0 ? '+' : ''}
                {formatPercent(result.totalReturn)}
              </div>
              <div className="text-xs text-text-secondary">Total return</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-xl font-bold">{formatPercent(result.winRate / 100)}</div>
              <div className="text-xs text-text-secondary">Win rate</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-xl font-bold">{result.totalTrades}</div>
              <div className="text-xs text-text-secondary">Total trades</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-xl font-bold text-destructive">
                -{formatPercent(result.maxDrawdown / 100)}
              </div>
              <div className="text-xs text-text-secondary">Max drawdown</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-xl font-bold">{result.sharpeRatio.toFixed(2)}</div>
              <div className="text-xs text-text-secondary">Sharpe ratio</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-xl font-bold">{result.profitFactor.toFixed(2)}</div>
              <div className="text-xs text-text-secondary">Profit factor</div>
            </div>
          </div>

          {/* Trade Summary */}
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="card p-4">
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Winning trades</span>
                <span className="font-bold text-success">{result.winningTrades}</span>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Losing trades</span>
                <span className="font-bold text-destructive">{result.losingTrades}</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Empty State */}
      {!loading && !result && !error && (
        <EmptyState
          variant="empty"
          title="No backtest results"
          message="Enter a leader address and run a backtest to see simulated performance."
        />
      )}
    </div>
  )
}

export default BacktestTab
