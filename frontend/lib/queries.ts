/**
 * Centralized React Query Hooks
 *
 * This file contains all data fetching logic for the app.
 * Benefits:
 * - Automatic caching (no duplicate requests)
 * - Automatic deduplication (same query = same request)
 * - Background refetching
 * - Shared state across components
 * - Proper loading/error states
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ============================================
// Types
// ============================================

export interface LeaderboardEntry {
  rank: number;
  address: string;
  displayName?: string;
  veritasScore: number;
  winRate: number;
  totalBets?: number;
  totalPredictions?: number;
  totalVolume?: number;
  pnl?: number;
  tier: number;
  platforms: string[];
  platformBreakdown?: {
    platform: string;
    bets: number;
    winRate: number;
    score: number;
    volume?: number;
    pnl?: number;
  }[];
}

export interface LeaderboardResponse {
  success: boolean;
  data: LeaderboardEntry[];
  total: number;
  cached: boolean;
  cacheAge: number;
  isRefreshing: boolean;
  lastUpdate: number;
}

export interface MarketData {
  id: string;
  title: string;
  platform: string;
  probability?: number;
  volume?: number;
  endDate?: string;
  status?: string;
}

export interface PlatformStats {
  platform: string;
  totalVolume: number;
  totalBets: number;
  activeMarkets: number;
  topTraders: LeaderboardEntry[];
}

// ============================================
// Query Keys - Centralized for cache management
// ALL query keys MUST be defined here for consistency
// ============================================

export const queryKeys = {
  // Leaderboard
  leaderboard: (limit?: number) => ['leaderboard', limit ?? 500] as const,
  leaderboardByPlatform: (platform: string, limit?: number) =>
    ['leaderboard', platform, limit ?? 100] as const,

  // Individual platforms
  platformLeaderboard: (platform: string, limit?: number) =>
    ['platform-leaderboard', platform, limit ?? 100] as const,

  // Markets
  markets: (platform: string) => ['markets', platform] as const,
  allMarkets: () => ['markets', 'all'] as const,
  platformMarkets: (platform: string) => ['platform-markets', platform] as const,

  // User profiles
  userProfile: (address: string) => ['user-profile', address] as const,
  traderProfile: (address: string) => ['trader-profile', address.toLowerCase()] as const,
  traderFollowStatus: (userAddress: string, traderAddress: string) =>
    ['trader-follow-status', userAddress.toLowerCase(), traderAddress.toLowerCase()] as const,
  traderSearch: (address: string) => ['trader-search', address.toLowerCase()] as const,

  // Stats
  platformStats: () => ['platform-stats'] as const,
  dashboardStats: () => ['dashboard-stats'] as const,
  caseStudyTrader: () => ['case-study-trader'] as const,

  // Simulation / Copy Trading
  simulation: {
    stats: (platform: string, address?: string) =>
      ['simulation', platform, 'stats', address] as const,
    trades: (address?: string) => ['simulation', 'trades', address] as const,
    monitor: () => ['copy-trading', 'monitor'] as const,
    simStats: () => ['copy-trading', 'sim-stats'] as const,
  },
};

// ============================================
// Error Types and Helpers
// ============================================

/**
 * Standard error type for API calls
 * Provides consistent error structure across all hooks
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Parse error response from API
 */
function parseApiError(res: Response, fallbackMessage: string): ApiError {
  const status = res.status;

  // Common HTTP error messages
  const statusMessages: Record<number, string> = {
    400: 'Bad request - please check your input',
    401: 'Unauthorized - please connect your wallet',
    403: 'Forbidden - you do not have access',
    404: 'Not found',
    429: 'Too many requests - please wait and try again',
    500: 'Server error - please try again later',
    502: 'Service temporarily unavailable',
    503: 'Service temporarily unavailable',
  };

  const message = statusMessages[status] || fallbackMessage;
  return new ApiError(message, status);
}

// ============================================
// Fetch Helpers
// ============================================

/**
 * Standard JSON fetch with error handling
 * Throws ApiError for failed requests with meaningful messages
 */
async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw parseApiError(res, `API error: ${res.status}`);
  }
  return res.json();
}

/**
 * Fetch with timeout support
 * Use for endpoints that may be slow/unreliable
 */
async function fetchWithTimeout<T>(
  url: string,
  timeoutMs: number = 10000,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw parseApiError(res, `API error: ${res.status}`);
    }
    return res.json();
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new ApiError('Request timed out - please try again', 408, 'TIMEOUT');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================
// Leaderboard Hooks
// ============================================

/**
 * Main leaderboard hook - fetches unified leaderboard data
 * Cached for 60 seconds, shared across all components
 * Auto-retries when empty data is returned (server cache stale)
 */
export function useLeaderboard(limit = 500) {
  return useQuery({
    queryKey: queryKeys.leaderboard(limit),
    queryFn: async () => {
      const response = await fetchJson<LeaderboardResponse>(`/api/unified-leaderboard?limit=${limit}`);
      // If API returns empty data, force refresh and throw to trigger retry
      if (response.success && (!response.data || response.data.length === 0)) {
        // Try with refresh=true to force server-side cache refresh
        const refreshed = await fetchJson<LeaderboardResponse>(`/api/unified-leaderboard?limit=${limit}&refresh=true`);
        if (refreshed.data && refreshed.data.length > 0) {
          return refreshed;
        }
        // Still empty? Throw to trigger retry
        throw new Error('Leaderboard data is empty - server cache may be stale');
      }
      return response;
    },
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    retry: 3, // Retry up to 3 times
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    refetchInterval: 30 * 1000, // Real-time updates every 30 seconds
    refetchIntervalInBackground: false, // Only poll when tab is active
  });
}

/**
 * Leaderboard filtered by platform
 */
export function useLeaderboardByPlatform(platform: string, limit = 100) {
  return useQuery({
    queryKey: queryKeys.leaderboardByPlatform(platform, limit),
    queryFn: () =>
      fetchJson<LeaderboardResponse>(
        `/api/unified-leaderboard?limit=${limit}&platform=${encodeURIComponent(platform)}`
      ),
    staleTime: 60 * 1000,
    enabled: !!platform,
  });
}

/**
 * Hook to manually refresh leaderboard data
 */
export function useRefreshLeaderboard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/unified-leaderboard?limit=500&refresh=true');
      return res.json();
    },
    onSuccess: (data) => {
      // Update all leaderboard queries with fresh data
      queryClient.setQueryData(queryKeys.leaderboard(500), data);
    },
  });
}

// ============================================
// Platform-Specific Leaderboard Hooks
// ============================================

const PLATFORM_ENDPOINTS: Record<string, string> = {
  polymarket: '/api/polymarket-leaderboard',
  dreamdex: '/api/dreamdex-leaderboard',
  manifold: '/api/manifold-leaderboard',
  metaculus: '/api/metaculus-leaderboard',
  kalshi: '/api/kalshi-leaderboard',
  azuro: '/api/azuro-leaderboard',
  gnosis: '/api/gnosis-leaderboard',
  drift: '/api/drift-leaderboard',
  overtime: '/api/overtime-leaderboard',
  speedmarkets: '/api/speedmarkets-leaderboard',
  limitless: '/api/limitless-leaderboard',
  sxbet: '/api/sxbet-leaderboard',
};

/**
 * Fetch leaderboard for a specific platform
 */
export function usePlatformLeaderboard(platform: string, limit = 100) {
  const endpoint = PLATFORM_ENDPOINTS[platform.toLowerCase()];

  return useQuery({
    queryKey: queryKeys.platformLeaderboard(platform, limit),
    queryFn: () => fetchJson<{ data: LeaderboardEntry[] }>(`${endpoint}?limit=${limit}`),
    staleTime: 60 * 1000,
    enabled: !!endpoint,
  });
}

// ============================================
// Market Hooks
// ============================================

const MARKET_ENDPOINTS: Record<string, string> = {
  polymarket: '/api/polymarket',
  dreamdex: '/api/dreamdex',
  overtime: '/api/overtime',
  speedmarkets: '/api/speedmarkets',
  limitless: '/api/limitless',
  azuro: '/api/azuro',
  sxbet: '/api/sxbet',
  manifold: '/api/manifold',
  metaculus: '/api/metaculus',
  kalshi: '/api/kalshi',
  drift: '/api/drift',
};

/**
 * Fetch markets for a specific platform
 */
export function useMarkets(platform: string, limit = 50) {
  const endpoint = MARKET_ENDPOINTS[platform.toLowerCase()];

  return useQuery({
    queryKey: queryKeys.markets(platform),
    queryFn: () => fetchJson<{ data: MarketData[] }>(`${endpoint}?limit=${limit}`),
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 60 * 1000, // Real-time market updates every 60 seconds
    refetchIntervalInBackground: false,
    retry: (failureCount, error: any) => {
      if (String(error?.message).includes('503') || String(error).includes('429')) return false;
      return failureCount < 2;
    },
    enabled: !!endpoint,
  });
}

/**
 * Fetch all markets from all platforms (for Markets page)
 */
export function useAllMarkets() {
  return useQuery({
    queryKey: queryKeys.allMarkets(),
    queryFn: async () => {
      const platforms = Object.keys(MARKET_ENDPOINTS);
      const results = await Promise.allSettled(
        platforms.map(async (platform) => {
          const endpoint = MARKET_ENDPOINTS[platform];
          try {
            const res = await fetch(`${endpoint}?limit=20`);
            if (!res.ok) return { platform, data: [], error: true };
            const json = await res.json();
            return {
              platform,
              data: (json.data || json.markets || []).map((m: any) => ({ ...m, platform })),
              error: false,
            };
          } catch {
            return { platform, data: [], error: true };
          }
        })
      );

      return results
        .filter((r): r is PromiseFulfilledResult<{ platform: string; data: MarketData[]; error: boolean }> =>
          r.status === 'fulfilled'
        )
        .map(r => r.value);
    },
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 60 * 1000, // Real-time updates across all markets every 60 seconds
    refetchIntervalInBackground: false,
  });
}

// ============================================
// User Profile Hooks
// ============================================

/**
 * Get a user's profile from leaderboard data
 * This reuses the leaderboard cache instead of making separate API calls
 */
export function useUserProfile(address: string | undefined) {
  const { data: leaderboard, isLoading, error } = useLeaderboard(1000);

  const userData = address && leaderboard?.data
    ? leaderboard.data.find(
        (entry) => entry.address.toLowerCase() === address.toLowerCase()
      )
    : null;

  return {
    data: userData,
    isLoading,
    error,
    isFound: !!userData,
  };
}

// ============================================
// Trader Search Hooks (for /traders page)
// ============================================

export interface TraderSearchResult {
  wallet_address: string;
  username?: string;
  total_bets: number;
  wins: number;
  losses: number;
  win_rate: number;
  total_score: number;
  total_volume: string;
  platforms: string[];
  last_bet_at?: string;
}

export interface TraderBet {
  id: string;
  market_id: string;
  platform: string;
  position: string;
  amount: string;
  won: boolean | null;
  claimed_amount: string | null;
  placed_at: string;
  resolved_at?: string;
  market_name?: string;
}

/**
 * Search for a trader by address - cached for instant re-lookups
 * Returns profile data and recent bets
 */
export function useTraderSearch(address: string | undefined) {
  return useQuery({
    queryKey: queryKeys.traderSearch(address || ''),
    queryFn: async (): Promise<{ profile: TraderSearchResult | null; bets: TraderBet[]; error?: string }> => {
      if (!address) return { profile: null, bets: [] };

      try {
        const profileRes = await fetch(`/api/trader/${address}`);

        if (profileRes.status === 404) {
          return { profile: null, bets: [], error: 'Trader not found. They may not have any indexed bets yet.' };
        }

        if (!profileRes.ok) {
          return { profile: null, bets: [], error: 'Unable to fetch trader data.' };
        }

        const data = await profileRes.json();

        if (!data.profile) {
          return { profile: null, bets: [], error: 'No data found for this address.' };
        }

        // Transform profile data
        const profile: TraderSearchResult = {
          wallet_address: data.profile.wallet_address,
          username: data.profile.username,
          total_bets: data.profile.total_bets,
          wins: data.profile.wins,
          losses: data.profile.losses,
          win_rate: data.profile.win_rate,
          total_score: data.profile.total_score,
          total_volume: data.profile.total_volume,
          platforms: data.profile.platforms?.map((p: any) => p.name) || [],
          last_bet_at: data.profile.recent_bets?.[0]?.timestamp,
        };

        // Transform bets data
        const bets: TraderBet[] = (data.profile.recent_bets || []).map((bet: any) => ({
          id: bet.id,
          market_id: bet.market_id,
          platform: bet.platform,
          position: bet.position,
          amount: bet.amount,
          won: bet.won,
          claimed_amount: bet.claimed_amount,
          placed_at: bet.timestamp,
        }));

        return { profile, bets };
      } catch (error: any) {
        return { profile: null, bets: [], error: 'Failed to fetch trader data' };
      }
    },
    staleTime: 2 * 60 * 1000, // Cache for 2 minutes
    gcTime: 10 * 60 * 1000, // Keep in garbage collection for 10 minutes
    enabled: !!address,
  });
}

/**
 * Check if a user is following a trader
 */
export function useTraderFollowStatus(userAddress: string | undefined, traderAddress: string | undefined) {
  return useQuery({
    queryKey: queryKeys.traderFollowStatus(userAddress || '', traderAddress || ''),
    queryFn: async () => {
      if (!userAddress || !traderAddress) return { isFollowing: false };

      const res = await fetch(`/api/copy-trade/follow?address=${userAddress}&trader=${traderAddress}`);
      if (!res.ok) return { isFollowing: false };

      const data = await res.json();
      return { isFollowing: data.isFollowing || false };
    },
    staleTime: 30 * 1000, // 30 seconds
    enabled: !!userAddress && !!traderAddress,
  });
}

// ============================================
// Dashboard Stats Hooks
// ============================================

/**
 * Dashboard statistics - aggregated from leaderboard
 */
export function useDashboardStats() {
  const { data: leaderboard, isLoading } = useLeaderboard(500);

  if (!leaderboard?.data) {
    return { data: null, isLoading };
  }

  const traders = leaderboard.data;
  const stats = {
    totalTraders: traders.length,
    totalVolume: traders.reduce((sum, t) => sum + (t.totalVolume || 0), 0),
    avgWinRate: traders.length > 0
      ? traders.reduce((sum, t) => sum + (t.winRate || 0), 0) / traders.length
      : 0,
    topPerformers: traders.slice(0, 10),
    platformDistribution: {} as Record<string, number>,
  };

  // Count traders per platform
  traders.forEach(t => {
    (t.platforms || []).forEach(p => {
      stats.platformDistribution[p] = (stats.platformDistribution[p] || 0) + 1;
    });
  });

  return { data: stats, isLoading };
}

// ============================================
// Home Page Hooks
// ============================================

export interface HomePlatformStats {
  totalTraders: number;
  totalPredictions: number;
  totalVolumeSTT: number;
  totalVolumeUSD: number;
  supportedChains: number;
}

/**
 * Platform stats for home page hero
 * Long cache since this data changes slowly
 */
export function useHomePlatformStats() {
  return useQuery({
    queryKey: queryKeys.platformStats(),
    queryFn: () => fetchJson<HomePlatformStats>('/api/stats'),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}

export interface CaseStudyTrader {
  address: string;
  username?: string;
  veritasScore: number;
  winRate: number;
  totalBets: number;
}

/**
 * Case study trader for home page
 * Fetches top Polymarket trader
 */
export function useCaseStudyTrader() {
  return useQuery({
    queryKey: queryKeys.caseStudyTrader(),
    queryFn: async () => {
      const res = await fetch('/api/dreamdex-leaderboard?limit=1');
      const data = await res.json();
      if (data.success && data.data?.[0]) {
        return data.data[0] as CaseStudyTrader;
      }
      // No fallback — hide the trader section until a real trader exists
      return null;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}

// ============================================
// Simulation/Copy Trading Hooks
// ============================================

export function useSimulationStats() {
  return useQuery({
    queryKey: queryKeys.simulation.simStats(),
    queryFn: () => fetchJson<any>('/api/copy-trading-stats'),
    staleTime: 30 * 1000, // Refresh more frequently for simulation
    refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
  });
}

// ============================================
// Dashboard Simulation Hooks
// ============================================

export interface SimulationStats {
  totalTrades: number;
  wins: number;
  losses: number;
  pending: number;
  winRate: number;
  totalPnl: number;
  totalVolume: number;
}

export interface PendingBet {
  id: number;
  platform: 'polymarket' | 'speedmarkets' | 'overtime' | 'azuro' | 'sxbet' | 'limitless' | 'drift' | 'gnosis' | 'kalshi' | 'manifold' | 'metaculus';
  market: string;
  position: string;
  amount: number;
  entryPrice?: number;
  timestamp: string;
  maturity?: string;
  asset?: string;
}

/**
 * Fetch DreamDEX simulation stats for a user
 * With automatic 30-second polling
 */

/**
 * Fetch Polymarket simulation stats for a user
 * With automatic 30-second polling
 */
export function usePolymarketSimulationStats(address: string | undefined) {
  return useQuery({
    queryKey: queryKeys.simulation.stats('polymarket', address),
    queryFn: async () => {
      if (!address) return null;
      const res = await fetch(`/api/polymarket/simulate?stats=true&follower=${address}`);
      if (!res.ok) return null;
      const data = await res.json();
      const followerStats = data.followers?.find((f: any) =>
        f.follower.toLowerCase() === address.toLowerCase()
      );
      if (!followerStats) return null;

      let winRateNum = 0;
      if (typeof followerStats.winRate === 'string') {
        winRateNum = parseFloat(followerStats.winRate.replace('%', '')) || 0;
      } else if (typeof followerStats.winRate === 'number') {
        winRateNum = followerStats.winRate;
      }

      return {
        totalTrades: followerStats.totalTrades || 0,
        wins: followerStats.wins || 0,
        losses: followerStats.losses || 0,
        pending: followerStats.pending || 0,
        winRate: winRateNum,
        totalPnl: parseFloat(followerStats.totalPnlUsd || followerStats.totalPnlUSD) || 0,
        totalVolume: parseFloat(followerStats.totalVolumeUsd || followerStats.totalVolumeUSD) || 0,
      } as SimulationStats;
    },
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
    refetchIntervalInBackground: false,
    enabled: !!address,
  });
}

/**
 * DreamDEX simulation stats (our native binary prediction market)
 */
export function useDreamDEXSimulationStats(address: string | undefined) {
  return usePlatformSimulationStats('dreamdex', address, '/api/dreamdex/simulate', 'STT');
}

/**
 * DreamDEX simulation tab: aggregated stats + recent simulated trades
 * for a followed trader (used by the Copy Trading simulation view).
 */
export function useDreamDEXSimulationTab(traderAddress: string | undefined) {
  return useQuery({
    queryKey: queryKeys.simulation.trades(traderAddress ? `dreamdex:${traderAddress}` : undefined),
    queryFn: async () => {
      if (!traderAddress) return { stats: null, trades: [] };

      const [statsRes, tradesRes] = await Promise.all([
        fetch(`/api/dreamdex/simulate?stats=true&follower=${traderAddress.toLowerCase()}`),
        fetch(`/api/dreamdex/simulate?follower=${traderAddress.toLowerCase()}&limit=50`),
      ]);

      const statsData = await statsRes.json();
      const tradesData = await tradesRes.json();

      const trades = tradesData.trades || [];
      const stats = {
        overall: {
          totalTrades: statsData.totalTrades || 0,
          overallWinRate: statsData.winRate ? `${statsData.winRate}%` : 'N/A',
          totalPnlSTT: statsData.totalPnlUsd || statsData.totalPnlUSD || '0',
          totalPending: statsData.pending || 0,
        },
      };
      return { stats, trades } as { stats: { overall: Record<string, any> }; trades: any[] };
    },
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
    refetchIntervalInBackground: false,
    enabled: !!traderAddress,
  });
}

/**
 * Azuro simulation stats
 */
export function useAzuroSimulationStats(address: string | undefined) {
  return usePlatformSimulationStats('azuro', address, '/api/azuro/simulate', 'USD');
}

/**
 * Generic hook to fetch simulation stats for any platform
 */
export function usePlatformSimulationStats(
  platform: string,
  address: string | undefined,
  apiEndpoint: string,
  currencyLabel: string = 'USD'
) {
  return useQuery({
    queryKey: queryKeys.simulation.stats(platform, address),
    queryFn: async () => {
      if (!address) return null;
      const res = await fetch(`${apiEndpoint}?stats=true&follower=${address}`);
      if (!res.ok) return null;

      const data = await res.json();
      // Handle both response formats: { stats: {...} } and direct stats
      const followerStats = data.stats || data;

      // Check if we have any trades - return null if no data
      const totalTrades = followerStats.totalTrades || followerStats.total_trades || 0;
      if (totalTrades === 0) return null;

      const winRateNum = parseFloat(followerStats.winRate || followerStats.win_rate || '0') ||
        (totalTrades > 0 ? ((followerStats.wins || 0) / totalTrades) * 100 : 0);

      return {
        totalTrades,
        wins: followerStats.wins || 0,
        losses: followerStats.losses || 0,
        pending: followerStats.pending || 0,
        winRate: winRateNum,
        totalPnl: parseFloat(followerStats.totalPnlUsd || followerStats.totalPnlUSD || followerStats.totalPnlSTT || followerStats.totalPnlBnb || followerStats.total_pnl || '0'),
        totalVolume: parseFloat(followerStats.totalVolumeUsd || followerStats.totalVolumeUSD || followerStats.totalVolumeSTT || followerStats.totalVolumeBnb || followerStats.total_volume || '0'),
        currencyLabel,
      } as SimulationStats & { currencyLabel: string };
    },
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
    refetchIntervalInBackground: false,
    enabled: !!address,
  });
}

/**
 * Fetch stats for all platforms
 */
export function useAllPlatformStats(address: string | undefined) {
  const platforms = [
    { key: 'dreamdex', name: 'DreamDEX', endpoint: '/api/dreamdex/simulate', currency: 'STT' },
    { key: 'azuro', name: 'Azuro', endpoint: '/api/azuro/simulate', currency: 'USD' },
    { key: 'sxbet', name: 'SX Bet', endpoint: '/api/sxbet/simulate', currency: 'USD' },
  ];

  const statsQueries = platforms.map(platform =>
    usePlatformSimulationStats(platform.key, address, platform.endpoint, platform.currency)
  );

  return {
    platforms,
    statsQueries,
    isLoading: statsQueries.some(q => q.isLoading),
    // Return platforms with stats (has trades)
    platformsWithStats: platforms
      .map((platform, index) => ({
        ...platform,
        stats: statsQueries[index].data,
      }))
      .filter(p => p.stats && p.stats.totalTrades > 0),
  };
}

/**
 * Fetch pending bets and recent trades for a user from ALL platforms
 * With automatic 30-second polling
 */
export function useDashboardTrades(address: string | undefined) {
  return useQuery({
    queryKey: queryKeys.simulation.trades(address),
    queryFn: async () => {
      if (!address) return { pendingBets: [], recentTrades: [] };

      const allPending: PendingBet[] = [];
      const allResolved: any[] = [];

      // All platforms that can provide dashboard updates (real tUSDC or simulated)
      const platforms = [
        { key: 'dreamdex', endpoint: '/api/dreamdex/simulate' },
        { key: 'drift', endpoint: '/api/drift/simulate' },
        { key: 'azuro', endpoint: '/api/azuro/simulate' },
        { key: 'sxbet', endpoint: '/api/sxbet/simulate' },
        { key: 'polymarket', endpoint: '/api/polymarket/simulate' },
        { key: 'limitless', endpoint: '/api/limitless/simulate' },
        { key: 'overtime', endpoint: '/api/overtime/simulate' },
        { key: 'gnosis', endpoint: '/api/gnosis/simulate' },
        { key: 'kalshi', endpoint: '/api/kalshi/simulate' },
        { key: 'manifold', endpoint: '/api/manifold/simulate' },
        { key: 'metaculus', endpoint: '/api/metaculus/simulate' },
      ];

      // Fetch all platforms in parallel - simulated trades only (vault is handled via wagmi in Dashboard)
      await Promise.all(
        platforms.map(async ({ key, endpoint }) => {
          try {
            const res = await fetch(`${endpoint}?follower=${address.toLowerCase()}&limit=50`);
            if (!res.ok) return;

            const data = await res.json();
            const trades = data.trades || [];

            // Map pending bets based on platform
            const pending = trades
              .filter((t: any) => t.outcome === 'pending')
              .map((t: any) => {
                // Base fields
                const bet: PendingBet = {
                  id: t.id,
                  platform: key as any,
                  market: '',
                  position: '',
                  amount: 0,
                  timestamp: t.simulatedAt || t.simulated_at,
                };

                // Platform-specific mapping
                switch (key) {

                  case 'polymarket':
                    bet.market = t.marketQuestion || t.market_question || `Market ${(t.marketId || t.market_id)?.slice(0, 8)}...`;
                    bet.position = t.outcomeSelected || t.outcome_selected || 'Unknown';
                    bet.amount = parseFloat(t.amountUsd || t.amount_usd || '0');
                    bet.entryPrice = t.priceAtEntry || t.price_at_entry ? parseFloat(t.priceAtEntry || t.price_at_entry) : undefined;
                    break;

                  case 'speedmarkets':
                    bet.market = `${t.asset} ${t.direction}`;
                    bet.position = t.direction;
                    bet.amount = parseFloat(t.amountUsd || t.amount_usd || '0');
                    bet.maturity = t.maturity;
                    bet.asset = t.asset;
                    bet.entryPrice = parseFloat(t.strikePrice || t.strike_price || '0');
                    break;

                  case 'overtime':
                    bet.market = `${t.homeTeam || t.home_team || ''} vs ${t.awayTeam || t.away_team || ''}`;
                    bet.position = t.outcomeLabel || t.outcome_label || 'Unknown';
                    bet.amount = parseFloat(t.amountUsd || t.amount_usd || '0');
                    bet.maturity = t.maturity;
                    break;

                  case 'dreamdex':
                    bet.market = t.question || t.marketQuestion || `Market ${t.marketId || t.market_id || ''}`;
                    bet.position = t.outcomeLabel || t.outcome_label || 'Unknown';
                    bet.amount = parseFloat(t.amountUsd || t.amount_usd || '0');
                    bet.entryPrice = parseFloat(t.priceAtEntry || t.price_at_entry || '0');
                    bet.maturity = t.closeTime || t.close_time || t.maturity;
                    break;

                  case 'azuro':
                  case 'sxbet':
                    bet.market = t.marketName || t.market_name || `Game ${t.gameId || t.game_id || ''}`;
                    bet.position = t.outcomeLabel || t.outcome_label || t.position || 'Unknown';
                    bet.amount = parseFloat(t.amountUsd || t.amount_usd || '0');
                    bet.maturity = t.maturity;
                    break;

                  case 'limitless':
                  case 'drift':
                  case 'gnosis':
                  case 'kalshi':
                  case 'manifold':
                  case 'metaculus':
                    bet.market = t.marketQuestion || t.market_question || t.question || `Market ${t.marketId || t.market_id || ''}`;
                    bet.position = t.outcomeSelected || t.outcome_selected || t.position || 'Unknown';
                    bet.amount = parseFloat(t.amountUsd || t.amount_usd || t.amount || '0');
                    bet.maturity = t.maturity || t.closeTime || t.close_time;
                    break;
                }

                return bet;
              });

            allPending.push(...pending);

            // Add resolved trades
            const resolved = trades
              .filter((t: any) => t.outcome !== 'pending')
              .slice(0, 5)
              .map((t: any) => ({ ...t, _platform: key }));
            allResolved.push(...resolved);
          } catch (error) {
            console.error(`Error fetching ${key} trades:`, error);
          }
        })
      );

      // Sort by timestamp (most recent first)
      const pendingBets = allPending.sort((a, b) =>
        new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
      );

      const recentTrades = allResolved
        .sort((a, b) =>
          new Date(b.resolvedAt || b.resolved_at || b.simulatedAt || b.simulated_at || 0).getTime() -
          new Date(a.resolvedAt || a.resolved_at || a.simulatedAt || a.simulated_at || 0).getTime()
        )
        .slice(0, 10);

      return { pendingBets, recentTrades };
    },
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
    refetchIntervalInBackground: false,
    enabled: !!address,
  });
}

// ============================================
// Markets Page Hooks
// ============================================

export interface PlatformMarketsResult {
  markets: any[];
  isMock: boolean;
  error?: string;
}

/**
 * Hook for Monitor page - fetches copy trading monitor data
 * 10-second polling interval
 */
export function useMonitorData(enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.simulation.monitor(),
    queryFn: async () => {
      const res = await fetch('/api/copy-trading/monitor');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    staleTime: 10 * 1000, // 10 seconds
    refetchInterval: enabled ? 10 * 1000 : false,
    refetchIntervalInBackground: false,
  });
}

/**
 * Generic hook for fetching markets using a provided fetch function
 * Only active tab polls, other tabs use cached data
 */
export function usePlatformMarketsWithFetcher<T>(
  platform: string,
  fetcher: () => Promise<{ markets: T[]; isMock: boolean; error?: string }>,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: queryKeys.platformMarkets(platform),
    queryFn: async (): Promise<{ markets: T[]; isMock: boolean; error?: string }> => {
      try {
        const result = await fetcher();
        if ('error' in result && result.error) {
          return { markets: [], isMock: false, error: result.error };
        }
        return result;
      } catch (error: any) {
        console.error(`Error fetching ${platform} markets:`, error);
        return { markets: [], isMock: false, error: error.message };
      }
    },
    enabled, // Only fetch when enabled (active tab) - prevents 11 parallel API calls
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: enabled ? 30 * 1000 : false, // Only poll if enabled (active tab)
    refetchIntervalInBackground: false,
  });
}

/**
 * Hook for Copy Trading page simulation stats overview
 */
export function useCopyTradingSimStats() {
  return useQuery({
    queryKey: queryKeys.simulation.simStats(),
    queryFn: async () => {
      const res = await fetch('/api/copy-trading/simulation?stats=true');
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
    refetchIntervalInBackground: false,
  });
}

// DreamDEX is REAL (Somnia 50312) — no simulation tab. Use DreamDEXCopyVault on-chain.

// ============================================
// Traders Discovery Hooks
// ============================================

export interface DiscoveryTrader {
  wallet_address: string;
  username?: string;
  total_bets: number;
  wins: number;
  win_rate: number;
  veritas_score: number;
  total_volume: string;
}

/**
 * Discovery traders for traders page
 * Reuses the main leaderboard cache to avoid duplicate fetches
 */
export function useDiscoveryTraders(limit = 8) {
  const { data: leaderboard, isLoading, error } = useLeaderboard(500);

  const traders: DiscoveryTrader[] = leaderboard?.data
    ? leaderboard.data.slice(0, limit).map(entry => ({
        wallet_address: entry.address,
        username: entry.displayName,
        total_bets: entry.totalBets || entry.totalPredictions || 0,
        wins: Math.round((entry.winRate / 100) * (entry.totalBets || entry.totalPredictions || 0)),
        win_rate: entry.winRate,
        veritas_score: entry.veritasScore,
        total_volume: String(entry.totalVolume || 0),
      }))
    : [];

  // Sort by activity (total bets) for "most active" section
  const recentlyActive = [...traders]
    .sort((a, b) => b.total_bets - a.total_bets)
    .slice(0, 4);

  return {
    topTraders: traders,
    recentlyActive,
    isLoading,
    error,
  };
}

// ============================================
// Prefetching Helpers
// ============================================

/**
 * Prefetch leaderboard data (call on app init or hover)
 */
export function usePrefetchLeaderboard() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.leaderboard(500),
      queryFn: () => fetchJson<LeaderboardResponse>('/api/unified-leaderboard?limit=500'),
      staleTime: 60 * 1000,
    });
  };
}

// ============================================
// Cache Invalidation Helpers
// ============================================

/**
 * Invalidate all leaderboard-related queries
 */
export function useInvalidateLeaderboard() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    queryClient.invalidateQueries({ queryKey: ['platform-leaderboard'] });
  };
}

// ============================================
// Mutation Hooks with Cache Invalidation
// ============================================

/**
 * Mutation to follow/unfollow a trader
 * Automatically invalidates follow status cache on success
 */
export function useFollowTraderMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userAddress,
      traderAddress,
      action,
    }: {
      userAddress: string;
      traderAddress: string;
      action: 'follow' | 'unfollow';
    }) => {
      const res = await fetch('/api/copy-trade/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress, traderAddress, action }),
      });
      if (!res.ok) throw new Error('Failed to update follow status');
      return res.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate the specific follow status query
      queryClient.invalidateQueries({
        queryKey: queryKeys.traderFollowStatus(variables.userAddress, variables.traderAddress),
      });
      // Also invalidate any simulation data that might be affected
      queryClient.invalidateQueries({
        queryKey: ['simulation'],
      });
    },
  });
}

/**
 * Mutation to refresh simulation/copy trading data
 * Use this after placing a simulated trade
 */
export function useRefreshSimulation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // Just trigger a refresh - no API call needed
      return true;
    },
    onSuccess: () => {
      // Invalidate all simulation-related queries
      queryClient.invalidateQueries({ queryKey: ['simulation'] });
      queryClient.invalidateQueries({ queryKey: ['copy-trading'] });
    },
  });
}

/**
 * Mutation to invalidate market data
 * Use after market resolution or when user requests refresh
 */
export function useRefreshMarkets() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (platform?: string) => {
      if (platform) {
        // Refetch specific platform
        await queryClient.refetchQueries({
          queryKey: queryKeys.platformMarkets(platform),
        });
      }
      return true;
    },
    onSuccess: (_, platform) => {
      if (platform) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.platformMarkets(platform),
        });
      } else {
        // Invalidate all market queries
        queryClient.invalidateQueries({ queryKey: ['markets'] });
        queryClient.invalidateQueries({ queryKey: ['platform-markets'] });
      }
    },
  });
}

/**
 * Invalidate all simulation-related caches
 * Call this when simulation state changes externally
 */
export function useInvalidateSimulation() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: ['simulation'] });
    queryClient.invalidateQueries({ queryKey: ['copy-trading'] });
  };
}

/**
 * Invalidate trader search cache
 * Call this when trader data might have changed
 */
export function useInvalidateTraderSearch() {
  const queryClient = useQueryClient();

  return (address?: string) => {
    if (address) {
      queryClient.invalidateQueries({
        queryKey: queryKeys.traderSearch(address),
      });
    } else {
      queryClient.invalidateQueries({ queryKey: ['trader-search'] });
    }
  };
}
