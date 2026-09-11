'use client';

import '@rainbow-me/rainbowkit/styles.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { config } from '@/lib/wagmi';
import { useState } from 'react';
import { NetworkGuard } from './NetworkGuard';

/**
 * Application-wide React Query defaults
 * These can be overridden per-hook when needed
 */
const QUERY_DEFAULTS = {
  queries: {
    // Data freshness
    staleTime: 60 * 1000, // 1 minute - data considered fresh
    gcTime: 5 * 60 * 1000, // 5 minutes - keep in cache after unmount

    // Retry configuration
    retry: 2, // Retry failed requests twice
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 5000),

    // Refetch behavior
    refetchOnWindowFocus: false, // Don't auto-refetch on tab focus
    refetchOnReconnect: true, // Refetch when network reconnects
    refetchOnMount: true, // Refetch on component mount if stale

    // Network mode
    networkMode: 'online' as const, // Only fetch when online
  },
  mutations: {
    // Retry mutations once on failure
    retry: 1,
    retryDelay: 1000,

    // Network mode
    networkMode: 'online' as const,
  },
};

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: QUERY_DEFAULTS,
      })
  );

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#7b3ff2',
            accentColorForeground: 'white',
            borderRadius: 'medium',
            fontStack: 'system',
          })}
          appInfo={{
            appName: 'Veritas',
            learnMoreUrl: 'https://github.com/yourusername/veritas',
          }}
        >
          <NetworkGuard>{children}</NetworkGuard>
        </RainbowKitProvider>
        {/* React Query DevTools - only visible in development */}
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
