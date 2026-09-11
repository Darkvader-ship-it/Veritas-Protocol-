/**
 * SearchInput Component
 * Search input with debounce and clear button
 */

import { useState, useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  debounceMs?: number
  className?: string
  autoFocus?: boolean
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  debounceMs = 300,
  className = '',
  autoFocus = false,
}: SearchInputProps) {
  const [localValue, setLocalValue] = useState(value)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync external value changes
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  // Debounced onChange
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue)
      }
    }, debounceMs)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [localValue, value, onChange, debounceMs])

  const handleClear = () => {
    setLocalValue('')
    onChange('')
    inputRef.current?.focus()
  }

  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full pl-10 pr-10 py-2 bg-surface-raised border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
      />
      {localValue && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-surface rounded transition-colors"
          title="Clear search"
        >
          <X className="w-4 h-4 text-text-muted" />
        </button>
      )}
    </div>
  )
}

export default SearchInput
