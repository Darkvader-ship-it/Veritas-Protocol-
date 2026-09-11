/**
 * CascadeTab Component
 * Cascade copy trading prevention
 */

import { useState } from 'react'
import { Link2, Search, CheckCircle, XCircle, ChevronRight } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import { SkeletonCard } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'
import { CopyChainVisualizer } from '../charts'
import type { CopyEligibility, CopyStatus, CopyChainNode } from '../../types'

export function CascadeTab() {
  const [address, setAddress] = useState('')
  const [followerAddress, setFollowerAddress] = useState('')
  const [leaderAddress, setLeaderAddress] = useState('')

  const { data: eligibility, loading: loadingEligibility, fetch: fetchEligibility } = useApi<CopyEligibility>()
  const { data: status, loading: loadingStatus, fetch: fetchStatus } = useApi<CopyStatus>()
  const { data: chainData, loading: loadingChain, fetch: fetchChain } = useApi<{ chain: CopyChainNode[] }>()
  const { data: validation, loading: loadingValidation, fetch: fetchValidation } = useApi<{ valid: boolean; error?: string }>()

  const checkEligibility = async () => {
    if (!address) return
    await fetchEligibility(`/api/cascade/can-copy/${address}`)
  }

  const checkStatus = async () => {
    if (!address) return
    await fetchStatus(`/api/cascade/status/${address}`)
  }

  const viewChain = async () => {
    if (!address) return
    await fetchChain(`/api/cascade/chain/${address}`)
  }

  const validateFollow = async () => {
    if (!followerAddress || !leaderAddress) return
    await fetchValidation('/api/cascade/validate-follow', {
      method: 'POST',
      body: JSON.stringify({ follower: followerAddress, leader: leaderAddress }),
    })
  }

  return (
    <div className="panel">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Link2 className="w-6 h-6 text-primary" />
        <div>
          <h2 className="text-lg font-semibold">Cascade prevention</h2>
          <p className="text-sm text-text-secondary">
            Prevent cascade copy trading problems
          </p>
        </div>
      </div>

      <p className="text-sm text-text-muted mb-6">
        Cascade copy trading occurs when A copies B, B copies C, creating delayed
        executions and worse prices. This tool helps detect and prevent such chains.
      </p>

      {/* Wallet Lookup */}
      <div className="card p-4 mb-6">
        <h3 className="font-medium mb-4">Check wallet eligibility</h3>

        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Enter wallet address..."
            className="flex-1 px-3 py-2 bg-surface-raised border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
          />
          <button
            onClick={checkEligibility}
            disabled={loadingEligibility || !address}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
          >
            Can copy?
          </button>
          <button
            onClick={checkStatus}
            disabled={loadingStatus || !address}
            className="px-4 py-2 bg-surface-raised border border-border rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-surface transition-colors"
          >
            Status
          </button>
          <button
            onClick={viewChain}
            disabled={loadingChain || !address}
            className="px-4 py-2 bg-surface-raised border border-border rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-surface transition-colors"
          >
            View chain
          </button>
        </div>

        {/* Loading */}
        {(loadingEligibility || loadingStatus || loadingChain) && <SkeletonCard />}

        {/* Eligibility Result */}
        {eligibility && (
          <div
            className={`p-4 rounded-lg border-2 mb-4 ${
              eligibility.allowed
                ? 'border-success bg-success/10'
                : 'border-destructive bg-destructive/10'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              {eligibility.allowed ? (
                <CheckCircle className="w-6 h-6 text-success" />
              ) : (
                <XCircle className="w-6 h-6 text-destructive" />
              )}
              <div>
                <div className="font-semibold">
                  {eligibility.allowed ? 'Eligible for copying' : 'Not eligible for copying'}
                </div>
                <div className="text-sm text-text-secondary">{eligibility.reason}</div>
              </div>
            </div>
            <div className="flex gap-4 text-sm">
              <div>
                <span className="text-text-secondary">Copy depth:</span>{' '}
                <span
                  className={
                    eligibility.copyDepth === 0 ? 'text-success' : 'text-warning'
                  }
                >
                  {eligibility.copyDepth}
                </span>
              </div>
              <div>
                <span className="text-text-secondary">Is copy trader:</span>{' '}
                <span
                  className={
                    eligibility.isCopyTrader ? 'text-warning' : 'text-success'
                  }
                >
                  {eligibility.isCopyTrader ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Status Result */}
        {status && (
          <div className="p-4 bg-surface-raised rounded-lg mb-4">
            <h4 className="font-medium mb-3">Copy status</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-text-secondary">Copy depth:</span>{' '}
                <strong>{status.copyDepth}</strong>
              </div>
              <div>
                <span className="text-text-secondary">Original source:</span>{' '}
                <code className="font-mono text-xs">
                  {status.originalSource
                    ? `${status.originalSource.slice(0, 8)}...`
                    : 'None'}
                </code>
              </div>
              <div>
                <span className="text-text-secondary">Following:</span>{' '}
                <strong>{status.following.length}</strong>
              </div>
              <div>
                <span className="text-text-secondary">Followed by:</span>{' '}
                <strong>{status.followedBy.length}</strong>
              </div>
            </div>
          </div>
        )}

        {/* Chain Visualization */}
        {chainData?.chain && chainData.chain.length > 0 && (
          <div className="p-4 bg-surface-raised rounded-lg">
            <h4 className="font-medium mb-3">Copy chain visualization</h4>
            <CopyChainVisualizer chain={chainData.chain} currentAddress={address} />
          </div>
        )}
      </div>

      {/* Validate Follow */}
      <div className="card p-4">
        <h3 className="font-medium mb-2">Validate follow request</h3>
        <p className="text-sm text-text-muted mb-4">
          Check if a follow relationship would be valid before creating it.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-2 mb-4">
          <div className="flex-1 w-full">
            <label className="block text-xs text-text-secondary mb-1">Follower</label>
            <input
              type="text"
              value={followerAddress}
              onChange={(e) => setFollowerAddress(e.target.value)}
              placeholder="0x..."
              className="w-full px-3 py-2 bg-surface-raised border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <ChevronRight className="w-5 h-5 text-text-muted hidden sm:block mt-5" />
          <div className="flex-1 w-full">
            <label className="block text-xs text-text-secondary mb-1">Leader</label>
            <input
              type="text"
              value={leaderAddress}
              onChange={(e) => setLeaderAddress(e.target.value)}
              placeholder="0x..."
              className="w-full px-3 py-2 bg-surface-raised border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={validateFollow}
            disabled={loadingValidation || !followerAddress || !leaderAddress}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors mt-5 sm:mt-0"
          >
            Validate
          </button>
        </div>

        {loadingValidation && <SkeletonCard />}

        {validation && (
          <div
            className={`p-4 rounded-lg border-2 ${
              validation.valid
                ? 'border-success bg-success/10'
                : 'border-destructive bg-destructive/10'
            }`}
          >
            <div className="flex items-center gap-3">
              {validation.valid ? (
                <>
                  <CheckCircle className="w-6 h-6 text-success" />
                  <div>
                    <div className="font-semibold text-success">Valid follow request</div>
                    <div className="text-sm text-text-secondary">
                      This follow relationship can be created safely.
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <XCircle className="w-6 h-6 text-destructive" />
                  <div>
                    <div className="font-semibold text-destructive">Invalid follow request</div>
                    <div className="text-sm text-text-secondary">{validation.error}</div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {!loadingValidation && !validation && (
          <EmptyState
            variant="empty"
            title="Validate a follow"
            message="Enter follower and leader addresses to check if the relationship is valid."
          />
        )}
      </div>
    </div>
  )
}

export default CascadeTab
