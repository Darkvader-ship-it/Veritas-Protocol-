/**
 * Empty State Component
 * Displays helpful message when no data is available
 */

import { Inbox, Search, AlertCircle, RefreshCw } from 'lucide-react'

type EmptyStateVariant = 'empty' | 'no-results' | 'error' | 'loading'

interface EmptyStateProps {
  variant?: EmptyStateVariant
  title?: string
  message?: string
  action?: {
    label: string
    onClick: () => void
  }
}

const VARIANTS = {
  empty: {
    icon: Inbox,
    defaultTitle: 'No data yet',
    defaultMessage: 'Data will appear here once available.',
  },
  'no-results': {
    icon: Search,
    defaultTitle: 'No results found',
    defaultMessage: 'Try adjusting your filters or search terms.',
  },
  error: {
    icon: AlertCircle,
    defaultTitle: 'Failed to load',
    defaultMessage: 'Something went wrong. Please try again.',
  },
  loading: {
    icon: RefreshCw,
    defaultTitle: 'Loading...',
    defaultMessage: 'Please wait while we fetch the data.',
  },
}

export function EmptyState({
  variant = 'empty',
  title,
  message,
  action,
}: EmptyStateProps) {
  const config = VARIANTS[variant]
  const Icon = config.icon

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-12 h-12 rounded-full bg-surface-raised flex items-center justify-center mb-4">
        <Icon
          className={`w-6 h-6 text-text-secondary ${
            variant === 'loading' ? 'animate-spin' : ''
          }`}
        />
      </div>
      <h3 className="text-lg font-medium text-text-primary mb-1">
        {title ?? config.defaultTitle}
      </h3>
      <p className="text-sm text-text-secondary max-w-sm">
        {message ?? config.defaultMessage}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

export default EmptyState
