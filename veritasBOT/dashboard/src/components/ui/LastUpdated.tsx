/**
 * LastUpdated Component
 * Displays relative time since last update
 */

import { useState, useEffect } from 'react'
import { Clock, RefreshCw } from 'lucide-react'

interface LastUpdatedProps {
  timestamp: Date | null
  onRefresh?: () => void
  loading?: boolean
  className?: string
}

function getRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)

  if (diffSec < 10) return 'just now'
  if (diffSec < 60) return `${diffSec}s ago`
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  return date.toLocaleDateString()
}

export function LastUpdated({
  timestamp,
  onRefresh,
  loading = false,
  className = '',
}: LastUpdatedProps) {
  const [relativeTime, setRelativeTime] = useState<string>('')

  useEffect(() => {
    if (!timestamp) {
      setRelativeTime('')
      return
    }

    // Update immediately
    setRelativeTime(getRelativeTime(timestamp))

    // Update every 10 seconds
    const interval = setInterval(() => {
      setRelativeTime(getRelativeTime(timestamp))
    }, 10000)

    return () => clearInterval(interval)
  }, [timestamp])

  if (!timestamp) return null

  return (
    <div className={`flex items-center gap-2 text-xs text-text-secondary ${className}`}>
      <Clock className="w-3 h-3" />
      <span>Updated {relativeTime}</span>
      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-1 hover:bg-surface-raised rounded transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      )}
    </div>
  )
}

export default LastUpdated
