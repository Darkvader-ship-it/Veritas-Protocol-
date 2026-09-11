/**
 * useAutoRefresh Hook
 * Automatically refreshes data at specified intervals
 */

import { useEffect, useRef, useCallback } from 'react'

interface UseAutoRefreshOptions {
  /** Interval in milliseconds */
  interval: number
  /** Whether auto-refresh is enabled */
  enabled?: boolean
  /** Callback to execute on each refresh */
  onRefresh: () => void | Promise<void>
  /** Whether to run immediately on mount */
  immediate?: boolean
}

export function useAutoRefresh({
  interval,
  enabled = true,
  onRefresh,
  immediate = true,
}: UseAutoRefreshOptions): {
  refresh: () => void
  isRefreshing: boolean
} {
  const timeoutRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isRefreshingRef = useRef(false)
  const onRefreshRef = useRef(onRefresh)
  const immediateRef = useRef(immediate)
  const hasRunRef = useRef(false)

  // Update refs on each render
  onRefreshRef.current = onRefresh
  immediateRef.current = immediate

  const refresh = useCallback(async () => {
    if (isRefreshingRef.current) return
    isRefreshingRef.current = true
    try {
      await onRefreshRef.current()
    } finally {
      isRefreshingRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      if (timeoutRef.current) {
        clearInterval(timeoutRef.current)
        timeoutRef.current = null
      }
      return
    }

    // Run immediately on first mount if requested
    if (immediateRef.current && !hasRunRef.current) {
      hasRunRef.current = true
      refresh()
    }

    // Set up interval
    timeoutRef.current = setInterval(refresh, interval)

    return () => {
      if (timeoutRef.current) {
        clearInterval(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [enabled, interval, refresh])

  return {
    refresh,
    isRefreshing: isRefreshingRef.current,
  }
}

// Predefined intervals for different data types
export const REFRESH_INTERVALS = {
  REALTIME: 10000,      // 10 seconds - for live signals
  FAST: 30000,          // 30 seconds - for frequently changing data
  NORMAL: 60000,        // 1 minute - for moderately changing data
  SLOW: 120000,         // 2 minutes - for slowly changing data
  VERY_SLOW: 300000,    // 5 minutes - for rarely changing data
} as const

export default useAutoRefresh
