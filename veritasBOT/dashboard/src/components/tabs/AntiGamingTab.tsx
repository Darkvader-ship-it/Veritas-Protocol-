/**
 * AntiGamingTab Component
 * Anti-gaming detector alerts and wallet analysis
 */

import { useState } from 'react'
import { Shield, Search, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import { useApi, fetchApi } from '../../hooks/useApi'
import { useAutoRefresh, REFRESH_INTERVALS } from '../../hooks/useAutoRefresh'
import { SkeletonCard } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'
import { LastUpdated } from '../ui/LastUpdated'
import { RiskScoreGauge } from '../charts'
import type { Alert, WalletAnalysis } from '../../types'

const SEVERITY_COLORS = {
  LOW: 'border-l-blue-500 bg-blue-500/10',
  MEDIUM: 'border-l-yellow-500 bg-yellow-500/10',
  HIGH: 'border-l-orange-500 bg-orange-500/10',
  CRITICAL: 'border-l-red-500 bg-red-500/10',
}

export function AntiGamingTab() {
  const [walletAddress, setWalletAddress] = useState('')

  const { data: alerts, loading: loadingAlerts, lastUpdated, fetch: fetchAlerts } = useApi<Alert[]>()
  const { data: analysis, loading: loadingAnalysis, fetch: fetchAnalysis } = useApi<WalletAnalysis>()

  const loadAlerts = async () => {
    await fetchAlerts('/api/alerts/pending')
  }

  const analyzeWallet = async () => {
    if (!walletAddress) return
    await fetchAnalysis(`/api/wallet/${walletAddress}/analyze`)
  }

  const dismissAlert = async (id: number) => {
    await fetchApi(`/api/alerts/${id}/dismiss`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
    loadAlerts()
  }

  const confirmAlert = async (id: number) => {
    await fetchApi(`/api/alerts/${id}/confirm`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
    loadAlerts()
  }

  useAutoRefresh({
    interval: REFRESH_INTERVALS.NORMAL,
    onRefresh: loadAlerts,
    immediate: true,
  })

  return (
    <div className="panel">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-primary" />
          <div>
            <h2 className="text-lg font-semibold">Anti-gaming detector</h2>
            <p className="text-sm text-text-secondary">
              Detect manipulation and protect VeritasScore integrity
            </p>
          </div>
        </div>
        <LastUpdated
          timestamp={lastUpdated}
          onRefresh={loadAlerts}
          loading={loadingAlerts}
        />
      </div>

      {/* Alerts Section */}
      <div className="mb-8">
        <h3 className="text-md font-medium mb-4">Pending alerts</h3>

        {loadingAlerts && !alerts && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {alerts && alerts.length > 0 ? (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`card p-4 border-l-4 ${SEVERITY_COLORS[alert.severity]}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="font-medium">{alert.type.replace(/_/g, ' ')}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          alert.severity === 'CRITICAL'
                            ? 'bg-destructive text-white'
                            : alert.severity === 'HIGH'
                            ? 'bg-orange-500 text-white'
                            : alert.severity === 'MEDIUM'
                            ? 'bg-yellow-500 text-black'
                            : 'bg-blue-500 text-white'
                        }`}
                      >
                        {alert.severity}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {alert.wallets.map((w) => (
                        <code
                          key={w}
                          className="px-2 py-1 bg-surface rounded text-xs font-mono"
                        >
                          {w.slice(0, 10)}...
                        </code>
                      ))}
                    </div>
                    <div className="text-xs text-text-muted mt-2">
                      {new Date(alert.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => dismissAlert(alert.id)}
                      className="px-3 py-1.5 bg-surface-raised rounded-lg text-sm hover:bg-surface transition-colors flex items-center gap-1"
                    >
                      <XCircle className="w-4 h-4" />
                      Dismiss
                    </button>
                    <button
                      onClick={() => confirmAlert(alert.id)}
                      className="px-3 py-1.5 bg-destructive text-white rounded-lg text-sm hover:bg-destructive/90 transition-colors flex items-center gap-1"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Confirm
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : !loadingAlerts ? (
          <EmptyState variant="empty" title="No pending alerts" message="All clear! No suspicious activity detected." />
        ) : null}
      </div>

      {/* Wallet Analysis Section */}
      <div>
        <h3 className="text-md font-medium mb-4">Wallet analysis</h3>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            placeholder="Enter wallet address..."
            className="flex-1 px-3 py-2 bg-surface-raised border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
          />
          <button
            onClick={analyzeWallet}
            disabled={loadingAnalysis || !walletAddress}
            className="px-4 py-2 bg-primary text-white rounded-lg font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors flex items-center gap-2"
          >
            <Search className="w-4 h-4" />
            Analyze
          </button>
        </div>

        {loadingAnalysis && <SkeletonCard />}

        {analysis && (
          <div className="card p-4">
            <h4 className="font-mono text-sm mb-4">
              {analysis.address.slice(0, 10)}...{analysis.address.slice(-8)}
            </h4>

            <div className="flex flex-col md:flex-row gap-6">
              {/* Risk Gauge */}
              <div className="flex-shrink-0">
                <RiskScoreGauge score={analysis.riskScore} />
              </div>

              {/* Pattern Breakdown */}
              <div className="flex-1">
                <div className="text-sm text-text-secondary mb-3">Risk breakdown</div>
                <div className="space-y-3">
                  {Object.entries(analysis.patterns).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-3">
                      <span className="text-sm text-text-secondary w-28 capitalize">
                        {key.replace(/Score$/, '').replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                      <div className="flex-1 h-2 bg-surface rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            value > 70
                              ? 'bg-destructive'
                              : value > 40
                              ? 'bg-warning'
                              : 'bg-success'
                          }`}
                          style={{ width: `${value}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-10 text-right">{value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {!loadingAnalysis && !analysis && walletAddress && (
          <EmptyState
            variant="empty"
            message="Enter an address and click Analyze to see risk assessment"
          />
        )}
      </div>
    </div>
  )
}

export default AntiGamingTab
