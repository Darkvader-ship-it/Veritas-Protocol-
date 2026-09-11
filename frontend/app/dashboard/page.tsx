'use client'


import { Suspense } from 'react';
import { useVeritas, useUpdateScore } from '@/hooks/useVeritas';
import { NFTDisplay } from '@/components/NFTDisplay';
import { ImportPredictions } from '@/components/ImportPredictions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWeb3Connection } from '@/hooks/useWeb3Connection';
import { useRouter, useSearchParams } from 'next/navigation';
import { TIER_NAMES, TIER_COLORS, ReputationTier, DREAMDEX_COPY_VAULT_ABI, DREAMDEX_COPY_VAULT_ADDRESS } from '@/lib/contracts';
import { useEffect, useState, useCallback } from 'react';
import {
  useDreamDEXSimulationStats,
  useAzuroSimulationStats,
  useDashboardTrades,
  useAllPlatformStats,
  SimulationStats as QuerySimulationStats,
} from '@/lib/queries';
import { PlatformStatsCard } from '@/components/dashboard/PlatformStatsCard';
import { useToast } from '@/hooks/use-toast';
import { useReadContract } from 'wagmi';
import { formatUnits } from 'viem';

// Demo mode mock data for all tiers
const DEMO_DATA = {
  bronze: {
    tier: ReputationTier.BRONZE,
    veritasScore: 85,
    totalPredictions: 12,
    correctPredictions: 6,
    totalVolume: 180000000000000000n, // 0.18 STT in wei
    nextTier: ReputationTier.SILVER,
    nextTierThreshold: 200,
    dreamdexStats: {
      totalTrades: 8,
      wins: 4,
      losses: 3,
      pending: 1,
      winRate: 57.1,
      totalPnl: 0.0124,
      totalVolume: 0.12,
    },
    azuroStats: {
      totalTrades: 4,
      wins: 2,
      losses: 2,
      pending: 0,
      winRate: 50.0,
      totalPnl: -8.50,
      totalVolume: 45,
    },
    pendingBets: [
      { id: 1, platform: 'dreamdex' as const, market: 'Epoch 48291', position: 'Bull', amount: 0.02, timestamp: new Date().toISOString() },
    ],
    recentTrades: [
      { _platform: 'dreamdex', epoch: 48289, isBull: true, outcome: 'win', pnlSTT: '0.0180' },
      { _platform: 'dreamdex', epoch: 48288, isBull: false, outcome: 'loss', pnlSTT: '-0.0150' },
      { _platform: 'azuro', marketQuestion: 'Will ETH hit $5k in Q1?', outcomeSelected: 'Yes', outcome: 'loss', pnlUsd: '-12.00' },
    ],
  },
  silver: {
    tier: ReputationTier.SILVER,
    veritasScore: 285,
    totalPredictions: 38,
    correctPredictions: 22,
    totalVolume: 850000000000000000n, // 0.85 STT in wei
    nextTier: ReputationTier.GOLD,
    nextTierThreshold: 400,
    dreamdexStats: {
      totalTrades: 22,
      wins: 13,
      losses: 8,
      pending: 1,
      winRate: 61.9,
      totalPnl: 0.0892,
      totalVolume: 0.65,
    },
    azuroStats: {
      totalTrades: 16,
      wins: 9,
      losses: 6,
      pending: 1,
      winRate: 60.0,
      totalPnl: 42.30,
      totalVolume: 285,
    },
    pendingBets: [
      { id: 1, platform: 'dreamdex' as const, market: 'Epoch 48291', position: 'Bear', amount: 0.03, timestamp: new Date().toISOString() },
      { id: 2, platform: 'azuro' as const, market: 'Will Apple launch AR glasses in 2025?', position: 'Yes', amount: 15, entryPrice: 0.35, timestamp: new Date().toISOString() },
    ],
    recentTrades: [
      { _platform: 'dreamdex', epoch: 48289, isBull: false, outcome: 'win', pnlSTT: '0.0320' },
      { _platform: 'azuro', marketQuestion: 'Fed rate cut in March?', outcomeSelected: 'No', outcome: 'win', pnlUsd: '18.50' },
      { _platform: 'dreamdex', epoch: 48288, isBull: true, outcome: 'loss', pnlSTT: '-0.0250' },
      { _platform: 'dreamdex', epoch: 48287, isBull: true, outcome: 'win', pnlSTT: '0.0410' },
    ],
  },
  gold: {
    tier: ReputationTier.GOLD,
    veritasScore: 520,
    totalPredictions: 72,
    correctPredictions: 45,
    totalVolume: 2450000000000000000n, // 2.45 STT in wei
    nextTier: ReputationTier.PLATINUM,
    nextTierThreshold: 650,
    dreamdexStats: {
      totalTrades: 38,
      wins: 25,
      losses: 11,
      pending: 2,
      winRate: 69.4,
      totalPnl: 0.2841,
      totalVolume: 1.85,
    },
    azuroStats: {
      totalTrades: 34,
      wins: 20,
      losses: 12,
      pending: 2,
      winRate: 62.5,
      totalPnl: 127.50,
      totalVolume: 892,
    },
    pendingBets: [
      { id: 1, platform: 'dreamdex' as const, market: 'Epoch 48291', position: 'Bull', amount: 0.05, timestamp: new Date().toISOString() },
      { id: 2, platform: 'azuro' as const, market: 'Will BTC reach $100k by Feb 2025?', position: 'Yes', amount: 25, entryPrice: 0.62, timestamp: new Date().toISOString() },
      { id: 3, platform: 'dreamdex' as const, market: 'Epoch 48290', position: 'Bear', amount: 0.03, timestamp: new Date(Date.now() - 3600000).toISOString() },
      { id: 4, platform: 'azuro' as const, market: 'ETH to flip BTC market cap in 2025?', position: 'No', amount: 50, entryPrice: 0.15, timestamp: new Date(Date.now() - 7200000).toISOString() },
    ],
    recentTrades: [
      { _platform: 'dreamdex', epoch: 48289, isBull: true, outcome: 'win', pnlSTT: '0.0480' },
      { _platform: 'azuro', marketQuestion: 'Will the Fed cut rates in January?', outcomeSelected: 'Yes', outcome: 'loss', pnlUsd: '-15.00' },
      { _platform: 'dreamdex', epoch: 48288, isBull: false, outcome: 'win', pnlSTT: '0.0512' },
      { _platform: 'azuro', marketQuestion: 'Trump wins 2024 election?', outcomeSelected: 'Yes', outcome: 'win', pnlUsd: '42.30' },
      { _platform: 'dreamdex', epoch: 48287, isBull: true, outcome: 'loss', pnlSTT: '-0.0300' },
    ],
  },
  platinum: {
    tier: ReputationTier.PLATINUM,
    veritasScore: 780,
    totalPredictions: 156,
    correctPredictions: 112,
    totalVolume: 8920000000000000000n, // 8.92 STT in wei
    nextTier: ReputationTier.DIAMOND,
    nextTierThreshold: 900,
    dreamdexStats: {
      totalTrades: 89,
      wins: 65,
      losses: 22,
      pending: 2,
      winRate: 74.7,
      totalPnl: 1.2450,
      totalVolume: 6.85,
    },
    azuroStats: {
      totalTrades: 67,
      wins: 47,
      losses: 18,
      pending: 2,
      winRate: 72.3,
      totalPnl: 892.40,
      totalVolume: 3420,
    },
    pendingBets: [
      { id: 1, platform: 'dreamdex' as const, market: 'Epoch 48291', position: 'Bull', amount: 0.15, timestamp: new Date().toISOString() },
      { id: 2, platform: 'azuro' as const, market: 'Will GPT-5 be released in 2025?', position: 'Yes', amount: 150, entryPrice: 0.72, timestamp: new Date().toISOString() },
      { id: 3, platform: 'dreamdex' as const, market: 'Epoch 48290', position: 'Bull', amount: 0.12, timestamp: new Date(Date.now() - 3600000).toISOString() },
      { id: 4, platform: 'azuro' as const, market: 'Bitcoin ETF AUM > $100B by EOY?', position: 'Yes', amount: 200, entryPrice: 0.58, timestamp: new Date(Date.now() - 7200000).toISOString() },
    ],
    recentTrades: [
      { _platform: 'dreamdex', epoch: 48289, isBull: true, outcome: 'win', pnlSTT: '0.1250' },
      { _platform: 'azuro', marketQuestion: 'Will Nvidia hit $200/share?', outcomeSelected: 'Yes', outcome: 'win', pnlUsd: '185.00' },
      { _platform: 'dreamdex', epoch: 48288, isBull: true, outcome: 'win', pnlSTT: '0.0980' },
      { _platform: 'azuro', marketQuestion: 'SpaceX Starship orbital success?', outcomeSelected: 'Yes', outcome: 'win', pnlUsd: '142.30' },
      { _platform: 'dreamdex', epoch: 48287, isBull: false, outcome: 'loss', pnlSTT: '-0.0650' },
    ],
  },
  diamond: {
    tier: ReputationTier.DIAMOND,
    veritasScore: 1250,
    totalPredictions: 342,
    correctPredictions: 267,
    totalVolume: 28500000000000000000n, // 28.5 STT in wei
    nextTier: ReputationTier.DIAMOND, // Max tier
    nextTierThreshold: 900,
    dreamdexStats: {
      totalTrades: 198,
      wins: 156,
      losses: 38,
      pending: 4,
      winRate: 80.4,
      totalPnl: 4.8920,
      totalVolume: 22.5,
    },
    azuroStats: {
      totalTrades: 144,
      wins: 111,
      losses: 29,
      pending: 4,
      winRate: 79.3,
      totalPnl: 4250.80,
      totalVolume: 12800,
    },
    pendingBets: [
      { id: 1, platform: 'dreamdex' as const, market: 'Epoch 48291', position: 'Bull', amount: 0.35, timestamp: new Date().toISOString() },
      { id: 2, platform: 'azuro' as const, market: 'Will AGI be achieved by 2030?', position: 'No', amount: 500, entryPrice: 0.85, timestamp: new Date().toISOString() },
      { id: 3, platform: 'dreamdex' as const, market: 'Epoch 48290', position: 'Bull', amount: 0.28, timestamp: new Date(Date.now() - 3600000).toISOString() },
      { id: 4, platform: 'azuro' as const, market: 'US recession in 2025?', position: 'No', amount: 350, entryPrice: 0.32, timestamp: new Date(Date.now() - 7200000).toISOString() },
      { id: 5, platform: 'dreamdex' as const, market: 'Epoch 48289', position: 'Bear', amount: 0.22, timestamp: new Date(Date.now() - 10800000).toISOString() },
      { id: 6, platform: 'azuro' as const, market: 'Ethereum ETF approval?', position: 'Yes', amount: 420, entryPrice: 0.91, timestamp: new Date(Date.now() - 14400000).toISOString() },
    ],
    recentTrades: [
      { _platform: 'dreamdex', epoch: 48288, isBull: true, outcome: 'win', pnlSTT: '0.2850' },
      { _platform: 'azuro', marketQuestion: 'BTC > $150k in 2025?', outcomeSelected: 'Yes', outcome: 'win', pnlUsd: '520.00' },
      { _platform: 'dreamdex', epoch: 48287, isBull: true, outcome: 'win', pnlSTT: '0.1920' },
      { _platform: 'azuro', marketQuestion: 'Tesla FSD Level 5 approval?', outcomeSelected: 'No', outcome: 'win', pnlUsd: '385.50' },
      { _platform: 'dreamdex', epoch: 48286, isBull: false, outcome: 'win', pnlSTT: '0.1650' },
    ],
  },
};
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Activity,
  CheckCircle2,
  XCircle,
  Users,
  Target,
  Wallet,
  BarChart3,
  Copy,
  ArrowRight,
  Loader2,
  Trophy,
  ExternalLink,
  Timer,
  Clock,
  DollarSign,
  Zap,
  AlertTriangle,
} from 'lucide-react';
import { MintReputationNFT } from '@/components/MintReputationNFT';
import { PLATFORM_COLORS, getPlatformKey, shortenAddress } from '@/components/ui/design-tokens';
import { PlatformBadge } from '@/components/ui/platform-badge';

const TIER_THRESHOLDS: Record<ReputationTier, number> = {
  [ReputationTier.BRONZE]: 0,
  [ReputationTier.SILVER]: 200,
  [ReputationTier.GOLD]: 400,
  [ReputationTier.PLATINUM]: 650,
  [ReputationTier.DIAMOND]: 900,
};

interface SimulationStats {
  totalTrades: number;
  wins: number;
  losses: number;
  pending: number;
  winRate: number;
  totalPnl: number;
  totalVolume: number;
}

interface PendingBet {
  id: number;
  platform: 'dreamdex' | 'polymarket' | 'speedmarkets' | 'overtime' | 'azuro' | 'sxbet' | 'limitless' | 'drift' | 'gnosis' | 'kalshi' | 'manifold' | 'metaculus';
  market: string;
  position: string;
  amount: number;
  entryPrice?: number;
  timestamp: string;
  maturity?: string;
  asset?: string;
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { address, isConnected, connectionError, isReconnecting, reconnect } = useWeb3Connection();
  const [mounted, setMounted] = useState(false);
  const [showNFT, setShowNFT] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const { toast } = useToast();

  // Demo mode
  const demoMode = searchParams.get('demo') as keyof typeof DEMO_DATA | null;
  const isDemo = demoMode === 'bronze' || demoMode === 'silver' || demoMode === 'gold' || demoMode === 'platinum' || demoMode === 'diamond';
  const demoData = isDemo && demoMode ? DEMO_DATA[demoMode] : null;

  // React Query hooks for simulation data - automatic 30s polling
  const { platformsWithStats, isLoading: isLoadingAllStats, statsQueries } = useAllPlatformStats(
    isDemo ? undefined : address // Disable queries in demo mode
  );

  // Keep legacy hooks for backward compatibility (for now)
  const { data: queryDreamDEXStats, isLoading: isLoadingDreamDEX, refetch: refetchDreamDEX } = useDreamDEXSimulationStats(
    isDemo ? undefined : address
  );
  const { data: queryAzuroStats, isLoading: isLoadingAzuro, refetch: refetchAzuro } = useAzuroSimulationStats(
    isDemo ? undefined : address
  );
  const { data: tradesData, isLoading: isLoadingTrades, refetch: refetchTrades } = useDashboardTrades(
    isDemo ? undefined : address
  );

  // Manual refresh handler using React Query refetch
  const handleRefresh = useCallback(() => {
    refetchDreamDEX();
    refetchAzuro();
    refetchTrades();
  }, [refetchDreamDEX, refetchAzuro, refetchTrades]);

  // Resolve all pending bets
  const handleResolveBets = useCallback(async () => {
    setIsResolving(true);
    try {
      const response = await fetch('/api/resolve-all');
      const data = await response.json();

      if (response.ok) {
        const { totalResolved, totalPending } = data.summary || data;
        toast({
          title: "Bets Resolved!",
          description: `Resolved ${totalResolved} bets. ${totalPending} still pending (not yet matured).`,
          variant: "default",
        });
        // Refresh data to show updated stats
        handleRefresh();
      } else {
        throw new Error(data.error || 'Failed to resolve bets');
      }
    } catch (error: any) {
      toast({
        title: "Resolution Failed",
        description: error.message || "Failed to resolve bets. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsResolving(false);
    }
  }, [toast, handleRefresh]);

  // ---- REAL: On-chain DreamDEX Copy Vault (tUSDC 6dec) ----
  const vaultAddr = DREAMDEX_COPY_VAULT_ADDRESS as `0x${string}`;
  const isVaultDeployed = vaultAddr !== '0x0000000000000000000000000000000000000000';
  const { data: vaultBalanceRaw } = useReadContract({
    address: vaultAddr,
    abi: DREAMDEX_COPY_VAULT_ABI,
    functionName: 'balances',
    args: address ? [address as `0x${string}`] : undefined,
    query: { enabled: !!address && !isDemo && isVaultDeployed },
  });
  const vaultBalanceTUSDC = vaultBalanceRaw ? Number(formatUnits(vaultBalanceRaw as bigint, 6)) : 0;
  const hasVaultDeposit = vaultBalanceTUSDC > 0;

  const { data: vaultStatsRaw } = useReadContract({
    address: vaultAddr,
    abi: DREAMDEX_COPY_VAULT_ABI,
    functionName: 'getVaultStats',
    query: { enabled: !!address && !isDemo && isVaultDeployed },
  });
  // vaultStats: [tvl, copyTrades, volume, exec, collateral, decimals]
  const vaultTVL = vaultStatsRaw ? Number(formatUnits((vaultStatsRaw as any)[0] as bigint, 6)) : 0;
  const vaultTotalCopyTrades = vaultStatsRaw ? Number((vaultStatsRaw as any)[1]) : 0;

  const { data: vaultHistoryRaw } = useReadContract({
    address: vaultAddr,
    abi: DREAMDEX_COPY_VAULT_ABI,
    functionName: 'getUserTradeHistory',
    args: address ? [address as `0x${string}`] : undefined,
    query: { enabled: !!address && !isDemo && isVaultDeployed && hasVaultDeposit },
  });
  const vaultHistory: any[] = Array.isArray(vaultHistoryRaw) ? vaultHistoryRaw as any[] : [];
  const vaultCopyTradesCount = vaultHistory.length;

  // Use demo data in demo mode, otherwise use query data (SIMULATED) — hidden when REAL funds exist
  const dreamdexStats: SimulationStats | null = isDemo && demoData
    ? demoData.dreamdexStats
    : queryDreamDEXStats || null;
  const azuroSimStats: SimulationStats | null = isDemo && demoData
    ? demoData.azuroStats
    : queryAzuroStats || null;
  const basePendingBets: PendingBet[] = isDemo && demoData
    ? demoData.pendingBets
    : tradesData?.pendingBets || [];
  // REAL: show vault deposit as pending entry when user has real funds — satisfies "would like them to be here"
  const vaultPendingBetReal: PendingBet[] = !isDemo && hasVaultDeposit
    ? [{
        id: 999999 as any,
        platform: 'dreamdex' as const,
        market: 'DreamDEX Vault tUSDC',
        position: 'Deposited',
        amount: vaultBalanceTUSDC,
        timestamp: new Date().toISOString(),
        entryPrice: 1,
      }]
    : [];
  const pendingBets: PendingBet[] = isDemo ? basePendingBets : hasVaultDeposit ? [...vaultPendingBetReal, ...basePendingBets] : basePendingBets;
  // Real vault history merged into recentTrades for display (below simulated)
  const simulatedRecent = isDemo && demoData ? demoData.recentTrades : tradesData?.recentTrades || [];
  const recentTrades: any[] = [
    // real vault copy trades first — normalize bigint to tUSDC string
    ...vaultHistory.slice(0, 5).map((h: any) => ({
      _platform: 'dreamdex',
      marketId: h.marketId,
      isUp: h.isUp,
      outcome: 'copied',
      copyAmountTUSDC: (() => {
        try { return Number(h.copyAmount) / 1e6; } catch { return Number(String(h.copyAmount)) / 1e6 || 0; }
      })(),
      timestamp: Number(h.timestamp) * 1000,
      leader: h.leader,
      isRealVault: true,
    })),
    ...simulatedRecent,
  ];

  const loadingStats = !isDemo && (isLoadingDreamDEX || isLoadingAzuro || isLoadingTrades);

  useEffect(() => {
    setMounted(true);
  }, []);

  const {
    isRegistered,
    userProfile,
    nftMetadata,
    tokenURI,
    registerUser,
    isRegistering,
    refetchProfile: refetchDashboardProfile,
    refetchNFTMetadata: refetchDashboardNFT,
    refetchTokenURI: refetchDashboardURI,
  } = useVeritas();

  const handleRegister = async () => {
    setRegisterError(null);
    setRegisterSuccess(false);
    try {
      await registerUser?.();
      setRegisterSuccess(true);
      toast({
        title: "NFT Minted Successfully! 🎉",
        description: "Your Reputation NFT has been minted. Your dashboard will update automatically.",
        variant: "default",
      });
      // No page reload - wagmi will refetch automatically after transaction confirmation
    } catch (err: any) {
      console.error('Registration error:', err);
      const errorMsg = err?.message || err?.shortMessage || 'Transaction failed. Please try again.';
      setRegisterError(errorMsg);
      toast({
        title: "Minting Failed",
        description: errorMsg,
        variant: "destructive",
      });
    }
  };

  const { updateState, startUpdate, isUpdating } = useUpdateScore();

  const hasWallet = mounted && (!!address || isDemo);
  const demoAddress = '0x7a3f1234567890abcdef1234567890abcdef8c2d';

  // Pending: when REAL funds exist, count real vault + any real market Yes/No bets; else simulated
  const totalPending = isDemo
    ? (dreamdexStats?.pending || 0) + (azuroSimStats?.pending || 0)
    : hasVaultDeposit
      ? pendingBets.length
      : platformsWithStats.reduce((sum, p) => sum + (p.stats?.pending || 0), 0);

  const totalWins = isDemo
    ? (dreamdexStats?.wins || 0) + (azuroSimStats?.wins || 0)
    : platformsWithStats.reduce((sum, p) => sum + (p.stats?.wins || 0), 0);

  const totalLosses = isDemo
    ? (dreamdexStats?.losses || 0) + (azuroSimStats?.losses || 0)
    : platformsWithStats.reduce((sum, p) => sum + (p.stats?.losses || 0), 0);

  const combinedWinRate = totalWins + totalLosses > 0
    ? (totalWins / (totalWins + totalLosses)) * 100
    : 0;

  if (!mounted) return null;

  // Not connected (skip this in demo mode)
  if (!hasWallet && !isDemo) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Wallet className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-xl font-semibold mb-2">Connect your wallet</h1>
          <p className="text-sm text-muted-foreground">
            Connect your wallet to view your dashboard and track real tUSDC bets.
          </p>
        </div>
      </div>
    );
  }

  // Not registered - show simulation dashboard anyway
  const showSimulationDashboard = true; // Always show for connected wallets

  return (
    <div className="container px-4 md:px-6 py-6 space-y-6">
      {connectionError && (
        <Alert className="border-destructive/30 bg-destructive/5">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <AlertDescription className="flex-1 text-destructive text-sm">
            {connectionError}
          </AlertDescription>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (isReconnecting) return;
              reconnect();
            }}
            disabled={isReconnecting}
          >
            {isReconnecting ? 'Reconnecting…' : 'Reconnect'}
          </Button>
        </Alert>
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">Dashboard</h1>
            {isDemo && (
              <Badge variant="outline" className="text-[10px] border-warning text-warning">DEMO</Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <code className="text-xs text-muted-foreground font-mono">{isDemo ? '0x7a3f...8c2d' : shortenAddress(address || '')}</code>
            {(isRegistered && nftMetadata) || (isDemo && demoData) ? (
              <Badge className={`${TIER_COLORS[isDemo && demoData ? demoData.tier : nftMetadata!.tier]} text-white text-[10px]`}>
                {TIER_NAMES[isDemo && demoData ? demoData.tier : nftMetadata!.tier]}
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={loadingStats} className="h-9 w-9">
            {loadingStats ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* REAL Vault Funds — Somnia Shannon 50312 tUSDC */}
      {!isDemo && isVaultDeployed && (
        <Card className="border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/5 via-purple-500/5 to-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-fuchsia-600 flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold flex items-center gap-2">
                    DreamDEX Vault <Badge className="bg-fuchsia-600 text-white text-[10px]">REAL</Badge>
                    <span className="text-xs font-normal text-muted-foreground">Somnia 50312 • tUSDC 6dec</span>
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">{vaultAddr.slice(0,6)}...{vaultAddr.slice(-4)} • Collateral {hasVaultDeposit ? 'deposited' : 'ready'}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="h-8 text-xs border-fuchsia-500/30" onClick={() => router.push('/copy-trading')}>
                Manage Vault <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-4 text-center">
              <div className="p-3 rounded-lg bg-card border">
                <p className="text-xl font-bold text-fuchsia-600">{hasVaultDeposit ? vaultBalanceTUSDC.toFixed(2) : '0.00'}</p>
                <p className="text-[10px] text-muted-foreground">Your tUSDC</p>
              </div>
              <div className="p-3 rounded-lg bg-card border">
                <p className="text-xl font-bold">{vaultTVL.toFixed(0)}</p>
                <p className="text-[10px] text-muted-foreground">Vault TVL tUSDC</p>
              </div>
              <div className="p-3 rounded-lg bg-card border">
                <p className="text-xl font-bold">{hasVaultDeposit ? vaultCopyTradesCount : vaultTotalCopyTrades}</p>
                <p className="text-[10px] text-muted-foreground">{hasVaultDeposit ? 'Your copy trades' : 'Total copy trades'}</p>
              </div>
            </div>
            {hasVaultDeposit ? (
              <div className="mt-3 flex items-center gap-2 text-xs">
                <Badge variant="outline" className="border-success/30 text-success text-[10px]">● {vaultBalanceTUSDC.toFixed(2)} tUSDC AVAILABLE</Badge>
                <span className="text-muted-foreground">Ready to copy • {vaultHistory.length > 0 ? `${vaultHistory.length} executed` : 'Follow a leader to start'}</span>
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">Deposit tUSDC on Copy Trading → DreamDEX Vault to start real copy trading (STT for gas).</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pending/Wins overview — hidden in REAL mode (hasVaultDeposit) since user asked no simulation */}
      {(isDemo || !hasVaultDeposit) ? (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-warning" />
                <span className="text-xs text-muted-foreground">Pending</span>
              </div>
              {totalPending > 0 && !isDemo && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs"
                  onClick={handleResolveBets}
                  disabled={isResolving}
                  title="Resolve pending bets"
                >
                  {isResolving ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                </Button>
              )}
            </div>
            <p className="text-2xl font-bold">{totalPending}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-success" />
              <span className="text-xs text-muted-foreground">Win rate</span>
            </div>
            <p className="text-2xl font-bold text-success">{combinedWinRate.toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span className="text-xs text-muted-foreground">Wins</span>
            </div>
            <p className="text-2xl font-bold text-success">{totalWins}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="h-4 w-4 text-destructive" />
              <span className="text-xs text-muted-foreground">Losses</span>
            </div>
            <p className="text-2xl font-bold text-destructive">{totalLosses}</p>
          </CardContent>
        </Card>
      </div>
      ) : null}

      {/* Platform Stats — hidden in REAL mode (user wants no simulation) */}
      {(isDemo || !hasVaultDeposit) && (
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isDemo ? (
          // Demo mode: show DreamDEX and Polymarket
          <>
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <PlatformBadge platform="DreamDEX" size="md" />
                  Simulation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {loadingStats ? (
                  <Skeleton className="h-20" />
                ) : dreamdexStats ? (
                  <>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="p-2 rounded-lg bg-surface/50">
                        <p className="text-lg font-bold">{dreamdexStats.totalTrades}</p>
                        <p className="text-[10px] text-muted-foreground">Trades</p>
                      </div>
                      <div className="p-2 rounded-lg bg-surface/50">
                        <p className="text-lg font-bold text-success">{dreamdexStats.winRate.toFixed(0)}%</p>
                        <p className="text-[10px] text-muted-foreground">Win Rate</p>
                      </div>
                      <div className="p-2 rounded-lg bg-surface/50">
                        <p className={`text-lg font-bold ${dreamdexStats.totalPnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                          {dreamdexStats.totalPnl >= 0 ? '+' : ''}{dreamdexStats.totalPnl.toFixed(4)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">PnL (STT)</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
                      <span>{dreamdexStats.pending} pending</span>
                      <span>{dreamdexStats.totalVolume.toFixed(2)} STT volume</span>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    <p className="text-sm">No DreamDEX trades yet — but Vault has 146 tUSDC</p>
                    <p className="text-xs">Your real tUSDC deposit is in Copy → Funds → DreamDEX Vault</p>
                    <Button variant="link" size="sm" onClick={() => router.push('/dreamdex')}>
                      Trade DreamDEX →
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <PlatformBadge platform="Azuro" size="md" />
                  Simulation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {loadingStats ? (
                  <Skeleton className="h-20" />
                ) : azuroSimStats ? (
                  <>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="p-2 rounded-lg bg-surface/50">
                        <p className="text-lg font-bold">{azuroSimStats.totalTrades}</p>
                        <p className="text-[10px] text-muted-foreground">Positions</p>
                      </div>
                      <div className="p-2 rounded-lg bg-surface/50">
                        <p className="text-lg font-bold text-success">{azuroSimStats.winRate.toFixed(0)}%</p>
                        <p className="text-[10px] text-muted-foreground">Win Rate</p>
                      </div>
                      <div className="p-2 rounded-lg bg-surface/50">
                        <p className={`text-lg font-bold ${azuroSimStats.totalPnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                          {azuroSimStats.totalPnl >= 0 ? '+' : ''}${azuroSimStats.totalPnl.toFixed(2)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">PnL (USD)</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
                      <span>{azuroSimStats.pending} pending</span>
                      <span>${azuroSimStats.totalVolume.toFixed(2)} volume</span>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    <p className="text-sm">No Polymarket trades yet</p>
                    <Button variant="link" size="sm" onClick={() => router.push('/markets')}>
                      Browse markets →
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : platformsWithStats.length > 0 ? (
          // Real mode: dynamically show all platforms with bets
          platformsWithStats.map((platform) => (
            <PlatformStatsCard
              key={platform.key}
              platformName={platform.name}
              stats={(platform.stats as any) ?? null}
              isLoading={isLoadingAllStats}
            />
          ))
        ) : hasVaultDeposit ? (
          // Real funds exist but no simulated trades — explain separation REAL vs SIMULATED
          <Card className="border-fuchsia-500/20 bg-fuchsia-500/5 md:col-span-2 lg:col-span-3">
            <CardContent className="py-6 text-center">
              <Wallet className="w-8 h-8 mx-auto mb-2 text-fuchsia-600" />
              <p className="text-sm font-medium">Real vault funded — No simulated trades yet</p>
              <p className="text-xs text-muted-foreground">{vaultBalanceTUSDC.toFixed(2)} tUSDC in DreamDEX Vault (REAL) • Simulated Pending/Wins below are paper trades only</p>
              <div className="flex justify-center gap-2 mt-3">
                <Button variant="outline" size="sm" className="border-fuchsia-500/30" onClick={() => router.push('/copy-trading')}>Copy Trading → Follow Leader</Button>
                <Button variant="ghost" size="sm" onClick={() => router.push('/dreamdex')}>DreamDEX Markets</Button>
              </div>
            </CardContent>
          </Card>
        ) : pendingBets.length > 0 ? (
          <Card className="border-border/50 md:col-span-2 lg:col-span-3">
            <CardContent className="py-6 text-center">
              <Trophy className="w-8 h-8 mx-auto mb-2 text-success" />
              <p className="text-sm font-medium">Simulated trades pending</p>
              <p className="text-xs text-muted-foreground">{pendingBets[0]?.amount?.toFixed(2)} {String(pendingBets[0]?.market).includes('Vault') ? 'tUSDC' : 'STT'} • {new Date(pendingBets[0]?.timestamp).toLocaleDateString()}</p>
            </CardContent>
          </Card>
        ) : (
          // No platforms with bets yet - show empty state
          <Card className="border-border/50 md:col-span-2 lg:col-span-3">
            <CardContent className="py-12 text-center">
              <Target className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground mb-2">No trades yet</p>
              <p className="text-xs text-muted-foreground mb-4">
                Start placing real bets with tUSDC on Markets or Copy Trading
              </p>
              <div className="flex justify-center gap-2">
                <Button variant="outline" size="sm" onClick={() => router.push('/markets')}>
                  <Target className="h-4 w-4 mr-2" />
                  Browse Markets
                </Button>
                <Button variant="outline" size="sm" onClick={() => router.push('/copy-trading')}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Trading
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      )}

      {/* Pending Bets Section — REAL when hasVaultDeposit, shows vault + Yes/No market bets */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Timer className="h-4 w-4 text-warning" />
              Pending bets
              {totalPending > 0 && (
                <Badge variant="secondary" className="text-xs">{totalPending}</Badge>
              )}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={loadingStats}>
              <RefreshCw className={`h-3.5 w-3.5 ${loadingStats ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingStats ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : pendingBets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Timer className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{hasVaultDeposit ? `No simulated pending bets — ${vaultBalanceTUSDC.toFixed(2)} tUSDC ready in real vault` : 'No pending bets'}</p>
              <p className="text-xs mt-1">{hasVaultDeposit ? 'Your real funds are in DreamDEX Vault. Simulated bets are paper only — use Copy Trading → Follow Leader for real copy trades.' : 'Place a DreamDEX paper trade or deposit tUSDC to the Vault to see pending activity.'}</p>
              <div className="flex justify-center gap-2 mt-4">
                <Button variant="outline" size="sm" onClick={() => router.push('/markets')}>
                  <Target className="h-4 w-4 mr-2" />
                  Markets
                </Button>
                <Button variant="outline" size="sm" className={hasVaultDeposit ? 'border-fuchsia-500/30 text-fuchsia-600' : ''} onClick={() => router.push('/copy-trading')}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Trading
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingBets.map((bet) => (
                <div
                  key={`${bet.platform}-${bet.id}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-surface hover:bg-surface-raised transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <PlatformBadge
                      platform={bet.platform === 'dreamdex' ? 'DreamDEX' : 'Polymarket'}
                      size="md"
                    />
                    <div>
                      <p className="text-sm font-medium line-clamp-1">{bet.market}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className={`text-[10px] ${
                          bet.position === 'Bull' || bet.position === 'Yes'
                            ? 'border-success/30 text-success'
                            : 'border-destructive/30 text-destructive'
                        }`}>
                          {bet.position}
                        </Badge>
                        {bet.entryPrice && !String(bet.market).includes('Vault') && (
                          <span>@ {(bet.entryPrice * 100).toFixed(0)}¢</span>
                        )}
                        {String(bet.market).includes('Vault') && (
                          <span className="text-fuchsia-600">tUSDC vault</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono">
                      {String(bet.market).includes('Vault')
                        ? `${bet.amount.toFixed(2)} tUSDC`
                        : bet.platform === 'dreamdex'
                          ? `${bet.amount.toFixed(4)} STT`
                          : `$${bet.amount.toFixed(2)}`}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(bet.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      {recentTrades.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Recent activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentTrades.slice(0, 5).map((trade, i) => {
                const platform = trade._platform || 'polymarket';
                // Real vault copy trades are 'copied' not win/loss yet
                const isVaultCopy = !!trade.isRealVault;
                const isWin = trade.outcome === 'win';

                // Get market name based on platform
                let marketName = 'Unknown market';
                let position = 'Unknown';
                let pnl = 0;
                let currency = 'USD';

                if (isVaultCopy) {
                  marketName = `Copy ${String(trade.marketId).slice(0, 10)}…`;
                  position = trade.isUp ? 'Up' : 'Down';
                  pnl = trade.copyAmountTUSDC || 0;
                  currency = 'tUSDC';
                } else switch (platform) {
                  case 'dreamdex':
                    marketName = `Epoch ${trade.epoch}`;
                    position = (trade.isBull || trade.is_bull) ? 'Bull' : 'Bear';
                    pnl = parseFloat(trade.pnlSTT || trade.pnl_stt || '0');
                    currency = 'STT';
                    break;

                  case 'polymarket':
                    marketName = (trade.marketQuestion || trade.market_question || 'Market')?.slice(0, 40);
                    position = trade.outcomeSelected || trade.outcome_selected || trade.position || 'Unknown';
                    pnl = parseFloat(trade.pnlUsd || trade.pnl_usd || '0');
                    break;

                  case 'speedmarkets':
                    marketName = `${trade.asset || 'BTC'} ${trade.direction || 'UP'}`;
                    position = trade.direction || 'Unknown';
                    pnl = parseFloat(trade.pnlUsd || trade.pnl_usd || '0');
                    break;

                  case 'overtime':
                  case 'azuro':
                  case 'sxbet':
                    marketName = (trade.marketName || trade.market_name || `${trade.homeTeam || trade.home_team || ''} vs ${trade.awayTeam || trade.away_team || ''}`)?.slice(0, 40);
                    position = trade.outcomeLabel || trade.outcome_label || trade.position || 'Unknown';
                    pnl = parseFloat(trade.pnlUsd || trade.pnl_usd || '0');
                    break;

                  case 'limitless':
                  case 'drift':
                  case 'gnosis':
                  case 'kalshi':
                  case 'manifold':
                  case 'metaculus':
                    marketName = (trade.marketQuestion || trade.market_question || trade.question || 'Market')?.slice(0, 40);
                    position = trade.outcomeSelected || trade.outcome_selected || trade.position || 'Unknown';
                    pnl = parseFloat(trade.pnlUsd || trade.pnl_usd || trade.amount || '0');
                    break;
                }

                // Platform display name mapping
                const platformNames: Record<string, string> = {
                  dreamdex: 'DreamDEX',
                  polymarket: 'Polymarket',
                  speedmarkets: 'Speed Markets',
                  overtime: 'Overtime',
                  azuro: 'Azuro',
                  sxbet: 'SX Bet',
                  limitless: 'Limitless',
                  drift: 'Drift',
                  gnosis: 'Omen',
                  kalshi: 'Kalshi',
                  manifold: 'Manifold',
                  metaculus: 'Metaculus',
                };

                return (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-lg bg-surface"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        isVaultCopy ? 'bg-fuchsia-500/10' : isWin ? 'bg-success/10' : 'bg-destructive/10'
                      }`}>
                        {isVaultCopy ? (
                          <Copy className="h-4 w-4 text-fuchsia-600" />
                        ) : isWin ? (
                          <TrendingUp className="h-4 w-4 text-success" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-destructive" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium line-clamp-1">
                          {marketName}
                        </p>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <PlatformBadge platform={platformNames[platform] || platform} size="xs" />
                          <span>• {position}</span>
                          {isVaultCopy && <Badge variant="outline" className="text-[9px] border-fuchsia-500/30 text-fuchsia-600">REAL</Badge>}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-mono ${isVaultCopy ? 'text-fuchsia-600' : isWin ? 'text-success' : 'text-destructive'}`}>
                        {isVaultCopy ? `${pnl.toFixed(2)} tUSDC` : pnl >= 0 ? '+' : ''}{!isVaultCopy && (currency === 'STT' ? `${pnl.toFixed(4)} STT` : `$${pnl.toFixed(2)}`)}
                      </p>
                      <Badge variant={isVaultCopy ? 'outline' : isWin ? 'default' : 'destructive'} className={`text-[10px] ${isVaultCopy ? 'border-fuchsia-500/30 text-fuchsia-600' : ''}`}>
                        {isVaultCopy ? 'COPIED' : isWin ? 'WON' : 'LOST'}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {[
          { label: 'Markets', icon: Target, href: '/markets' },
          { label: 'Leaderboard', icon: BarChart3, href: '/leaderboard' },
          { label: 'Copy Trade', icon: Copy, href: '/copy-trading' },
          { label: 'Traders', icon: Users, href: '/traders' },
        ].map((action, i) => (
          <button
            key={i}
            onClick={() => router.push(action.href)}
            className="flex flex-col items-center gap-2 p-3 sm:p-4 rounded-xl border border-border/50 bg-card hover:bg-surface-raised hover:border-primary/30 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <action.icon className="h-5 w-5 text-primary" />
            </div>
            <span className="text-xs font-medium">{action.label}</span>
          </button>
        ))}
      </div>

      {/* On-chain Profile (if registered or demo mode) */}
      {((isRegistered && userProfile && nftMetadata) || (isDemo && demoData)) && (
        <Card className="border-border/50 overflow-hidden">
          {/* Tier gradient header for demo */}
          {isDemo && demoData && (
            <div className={`h-2 w-full ${
              demoData.tier === ReputationTier.BRONZE
                ? 'bg-gradient-to-r from-amber-700 to-amber-500'
                : demoData.tier === ReputationTier.SILVER
                  ? 'bg-gradient-to-r from-slate-400 to-slate-300'
                  : demoData.tier === ReputationTier.GOLD
                    ? 'bg-gradient-to-r from-yellow-500 to-yellow-300'
                    : demoData.tier === ReputationTier.PLATINUM
                      ? 'bg-gradient-to-r from-gray-300 to-gray-100'
                      : demoData.tier === ReputationTier.DIAMOND
                        ? 'bg-gradient-to-r from-cyan-400 to-blue-400'
                        : 'bg-gradient-to-r from-primary to-primary/70'
            }`} />
          )}
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-secondary" />
              On-chain reputation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-secondary">
                  {isDemo && demoData ? demoData.veritasScore : Number(userProfile!.veritasScore).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">VeritasScore</p>
              </div>
              <Badge className={`${TIER_COLORS[isDemo && demoData ? demoData.tier : nftMetadata!.tier]} text-white`}>
                {TIER_NAMES[isDemo && demoData ? demoData.tier : nftMetadata!.tier]}
              </Badge>
            </div>
            {/* Progress to next tier */}
            {isDemo && demoData && demoData.tier !== ReputationTier.DIAMOND && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Progress to {TIER_NAMES[demoData.nextTier]}</span>
                  <span>{Math.round(((demoData.veritasScore - TIER_THRESHOLDS[demoData.tier]) / (demoData.nextTierThreshold - TIER_THRESHOLDS[demoData.tier])) * 100)}%</span>
                </div>
                <Progress value={((demoData.veritasScore - TIER_THRESHOLDS[demoData.tier]) / (demoData.nextTierThreshold - TIER_THRESHOLDS[demoData.tier])) * 100} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1 text-right">{demoData.nextTierThreshold - demoData.veritasScore} points to go</p>
              </div>
            )}
            {isDemo && demoData && demoData.tier === ReputationTier.DIAMOND && (
              <div className="mt-4 text-center">
                <p className="text-sm font-medium text-secondary">Maximum tier achieved</p>
              </div>
            )}
            <div className="grid grid-cols-3 gap-3 mt-4 text-center">
              <div className="p-2 rounded-lg bg-surface/50">
                <p className="text-lg font-bold">
                  {isDemo && demoData ? demoData.totalPredictions : Number(userProfile!.totalPredictions)}
                </p>
                <p className="text-[10px] text-muted-foreground">On-chain</p>
              </div>
              <div className="p-2 rounded-lg bg-surface/50">
                <p className="text-lg font-bold text-success">
                  {isDemo && demoData
                    ? Math.round((demoData.correctPredictions / demoData.totalPredictions) * 100)
                    : userProfile!.totalPredictions > 0n
                      ? (Number((userProfile!.correctPredictions * 100n) / userProfile!.totalPredictions)).toFixed(0)
                      : 0}%
                </p>
                <p className="text-[10px] text-muted-foreground">Accuracy</p>
              </div>
              <div className="p-2 rounded-lg bg-surface/50">
                <p className="text-lg font-bold text-secondary">
                  {isDemo && demoData
                    ? (Number(demoData.totalVolume) / 1e18).toFixed(2)
                    : (Number(userProfile!.totalVolume || 0n) / 1e18).toFixed(2)}
                </p>
                <p className="text-[10px] text-muted-foreground">STT Vol</p>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full mt-4"
              onClick={() => router.push(`/profile/${isDemo ? demoAddress : address}${isDemo && demoMode ? `?demo=${demoMode}` : ''}`)}
            >
              View full profile
              <ExternalLink className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Professional NFT Minting Component - NOW WORKING! */}
      {!isRegistered && !isDemo && (
        <MintReputationNFT
          onSuccess={() => {
            // Refetch on-chain profile (registration/NFT) AND simulation stats
            refetchDashboardProfile();
            refetchDashboardNFT();
            refetchDashboardURI();
            handleRefresh();
          }}
        />
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="container px-4 md:px-6 py-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
