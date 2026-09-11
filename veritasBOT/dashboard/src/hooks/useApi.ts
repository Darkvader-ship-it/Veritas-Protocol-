/**
 * useApi Hook
 * Handles API fetching with loading, error, and data states
 */

import { useState, useCallback, useRef } from 'react'

const API_BASE = 'http://localhost:4001'

interface UseApiOptions {
  onSuccess?: (data: any) => void
  onError?: (error: string) => void
}

interface UseApiReturn<T> {
  data: T | null
  loading: boolean
  error: string | null
  lastUpdated: Date | null
  fetch: (endpoint: string, options?: RequestInit) => Promise<T | null>
  reset: () => void
}

export function useApi<T = any>(options: UseApiOptions = {}): UseApiReturn<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Store callbacks in refs to avoid re-creating fetch function
  const onSuccessRef = useRef(options.onSuccess)
  const onErrorRef = useRef(options.onError)
  onSuccessRef.current = options.onSuccess
  onErrorRef.current = options.onError

  const fetch = useCallback(async (endpoint: string, fetchOptions?: RequestInit): Promise<T | null> => {
    setLoading(true)
    setError(null)

    try {
      const res = await window.fetch(`${API_BASE}${endpoint}`, {
        ...fetchOptions,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'dev',
          ...fetchOptions?.headers,
        },
      })

      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error || `API Error: ${res.status}`)
      }

      const result = json.data ?? json
      setData(result)
      setLastUpdated(new Date())
      onSuccessRef.current?.(result)
      return result
    } catch (err) {
      const message = (err as Error).message
      setError(message)
      onErrorRef.current?.(message)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setData(null)
    setLoading(false)
    setError(null)
    setLastUpdated(null)
  }, [])

  return { data, loading, error, lastUpdated, fetch, reset }
}

/**
 * Simple fetch helper for one-off requests
 */
export async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<{ data: T | null; error: string | null }> {
  try {
    const res = await window.fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'dev',
        ...options?.headers,
      },
    })

    const json = await res.json()

    if (!res.ok) {
      return { data: null, error: json.error || `API Error: ${res.status}` }
    }

    return { data: json.data ?? json, error: null }
  } catch (err) {
    return { data: null, error: (err as Error).message }
  }
}

export default useApi
