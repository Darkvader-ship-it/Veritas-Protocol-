'use client'


import { useParams, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { TIER_NAMES, TIER_COLORS, TIER_THRESHOLDS, ReputationTier } from '@/lib/contracts';
import { PATTERNS, PLATFORM_COLORS, getPlatformKey, shortenAddress } from '@/components/ui/design-tokens';
import {
  Award,
  TrendingUp,
  Target,
  Copy,
  ExternalLink,
  CheckCircle2,
  Activity,
  Users,
  BarChart3,
  Clock,
  Share2,
  Trophy,
  Crown,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { useState, useEffect, Suspense } from 'react';
import { CopyTradeButton } from '@/components/CopyTradeButton';

// Demo mode constants - must match dashboard/page.tsx
const DEMO_ADDRESS = '0x7a3f1234567890abcdef1234567890abcdef8c2d';

// Demo profile data for all tiers
const DEMO_PROFILES: Record<string, AggregatedProfile> = {
  bronze: {
    address: DEMO_ADDRESS,
    username: 'New Trader',
    veritasScore: 85,
    winRate: 52.5,
    totalBets: 12,
    wins: 6,
    losses: 6,
    totalVolume: { USD: 165, STT: 0.12 },
    totalPnl: { USD: -8.50, STT: 0.0124 },
    platforms: [
      {
        platform: 'DreamDEX Event Contracts',
        veritasScore: 85,
        winRate: 57.1,
        totalBets: 8,
        wins: 4,
        losses: 4,
        volume: '0.12',
        pnl: 0.0124,
        rank: 892,
      },
      {
        platform: 'Polymarket',
        veritasScore: 65,
        winRate: 50.0,
        totalBets: 4,
        wins: 2,
        losses: 2,
        volume: '45',
        pnl: -8.50,
        rank: 1245,
      },
    ],
    globalRank: 856,
  },
  silver: {
    address: DEMO_ADDRESS,
    username: 'Rising Trader',
    veritasScore: 285,
    winRate: 61.2,
    totalBets: 38,
    wins: 22,
    losses: 16,
    totalVolume: { USD: 950, STT: 0.65 },
    totalPnl: { USD: 42.30, STT: 0.0892 },
    platforms: [
      {
        platform: 'Polymarket',
        veritasScore: 285,
        winRate: 60.0,
        totalBets: 16,
        wins: 9,
        losses: 7,
        volume: '285',
        pnl: 42.30,
        rank: 324,
      },
      {
        platform: 'DreamDEX Event Contracts',
        veritasScore: 260,
        winRate: 61.9,
        totalBets: 22,
        wins: 13,
        losses: 9,
        volume: '0.65',
        pnl: 0.0892,
        rank: 412,
      },
    ],
    globalRank: 298,
  },
  gold: {
    address: DEMO_ADDRESS,
    username: 'Demo Trader',
    veritasScore: 520,
    winRate: 68.5,
    totalBets: 127,
    wins: 87,
    losses: 40,
    totalVolume: { USD: 45200, STT: 12.5 },
    totalPnl: { USD: 8340, STT: 2.1 },
    platforms: [
      {
        platform: 'Polymarket',
        veritasScore: 520,
        winRate: 71.2,
        totalBets: 73,
        wins: 52,
        losses: 21,
        volume: '32500',
        pnl: 6200,
        rank: 42,
      },
      {
        platform: 'DreamDEX Event Contracts',
        veritasScore: 485,
        winRate: 64.8,
        totalBets: 54,
        wins: 35,
        losses: 19,
        volume: '12.5',
        pnl: 2.1,
        rank: 156,
      },
    ],
    globalRank: 38,
  },
  platinum: {
    address: DEMO_ADDRESS,
    username: 'Elite Predictor',
    veritasScore: 780,
    winRate: 73.8,
    totalBets: 156,
    wins: 112,
    losses: 44,
    totalVolume: { USD: 125400, STT: 6.85 },
    totalPnl: { USD: 18920, STT: 1.245 },
    platforms: [
      {
        platform: 'Polymarket',
        veritasScore: 780,
        winRate: 72.3,
        totalBets: 67,
        wins: 47,
        losses: 20,
        volume: '98500',
        pnl: 15680,
        rank: 12,
      },
      {
        platform: 'DreamDEX Event Contracts',
        veritasScore: 720,
        winRate: 74.7,
        totalBets: 89,
        wins: 65,
        losses: 24,
        volume: '6.85',
        pnl: 1.245,
        rank: 28,
      },
    ],
    globalRank: 8,
  },
  diamond: {
    address: DEMO_ADDRESS,
    username: 'Legendary Oracle',
    veritasScore: 1250,
    winRate: 79.8,
    totalBets: 342,
    wins: 267,
    losses: 75,
    totalVolume: { USD: 485000, STT: 22.5 },
    totalPnl: { USD: 89420, STT: 4.892 },
    platforms: [
      {
        platform: 'Polymarket',
        veritasScore: 1250,
        winRate: 79.3,
        totalBets: 144,
        wins: 111,
        losses: 33,
        volume: '385000',
        pnl: 72500,
        rank: 1,
      },
      {
        platform: 'DreamDEX Event Contracts',
        veritasScore: 1180,
        winRate: 80.4,
        totalBets: 198,
        wins: 156,
        losses: 42,
        volume: '22.5',
        pnl: 4.892,
        rank: 3,
      },
    ],
    globalRank: 1,
  },
};

// Platform configuration
const PLATFORM_CONFIG: Record<string, {
  icon: string;
  color: string;
  bgColor: string;
  explorer: string;
  chain: string;
  volumeCurrency: string;
}> = {
  'Polymarket': {
    icon: '🔮',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    explorer: 'https://polygonscan.com/address/',
    chain: 'Polygon',
    volumeCurrency: 'USD',
  },
  'DreamDEX Event Contracts': {
    icon: '🥞',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
    explorer: 'https://somniascan.com/address/',
    chain: 'Somnia',
    volumeCurrency: 'STT',
  },
  'Overtime': {
    icon: '⚽',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    explorer: 'https://optimistic.etherscan.io/address/',
    chain: 'Optimism',
    volumeCurrency: 'ETH',
  },
  'Speed Markets': {
    icon: '⚡',
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    explorer: 'https://optimistic.etherscan.io/address/',
    chain: 'Optimism',
    volumeCurrency: 'ETH',
  },
  'Limitless': {
    icon: '♾️',
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/20',
    explorer: 'https://basescan.org/address/',
    chain: 'Base',
    volumeCurrency: 'USD',
  },
};

interface PlatformData {
  platform: string;
  veritasScore: number;
  winRate: number;
  totalBets: number;
  wins: number;
  losses: number;
  volume: string;
  pnl?: number;
  rank?: number;
}

interface AggregatedProfile {
  address: string;
  username?: string;
  veritasScore: number;
  winRate: number;
  totalBets: number;
  wins: number;
  losses: number;
  totalVolume: Record<string, number>; // Currency -> amount
  totalPnl: Record<string, number>; // Currency -> amount
  platforms: PlatformData[];
  globalRank?: number;
}

function getTierFromScore(score: number): ReputationTier {
  if (score >= TIER_THRESHOLDS[ReputationTier.DIAMOND]) return ReputationTier.DIAMOND;
  if (score >= TIER_THRESHOLDS[ReputationTier.PLATINUM]) return ReputationTier.PLATINUM;
  if (score >= TIER_THRESHOLDS[ReputationTier.GOLD]) return ReputationTier.GOLD;
  if (score >= TIER_THRESHOLDS[ReputationTier.SILVER]) return ReputationTier.SILVER;
  return ReputationTier.BRONZE;
}

function ProfilePageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const [profileAddress, setProfileAddress] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [demoTier, setDemoTier] = useState<string>('gold');

  useEffect(() => {
    setMounted(true);
    if (params?.address) {
      setProfileAddress(params.address as string);
    }
    // Check for demo mode via URL param or demo address
    const demoParam = searchParams.get('demo');
    const isDemoAddress = params?.address === DEMO_ADDRESS;
    setIsDemo(!!demoParam || isDemoAddress);
    // Set demo tier from URL param (default to gold)
    if (demoParam && ['bronze', 'silver', 'gold', 'platinum', 'diamond'].includes(demoParam)) {
      setDemoTier(demoParam);
    }
  }, [params, searchParams]);

  if (!mounted || !profileAddress) {
    return (
      <div className="container px-4 py-12">
        <ProfileSkeleton />
      </div>
    );
  }

  return (
    <div className="relative">
      {isDemo && (
        <div className="fixed top-4 right-4 z-50">
          <Badge className="bg-warning text-warning-foreground font-mono text-xs">
            DEMO
          </Badge>
        </div>
      )}
      <ProfileContent address={profileAddress} copied={copied} setCopied={setCopied} isDemo={isDemo} demoTier={demoTier} />
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="container px-4 py-12">
        <ProfileSkeleton />
      </div>
    }>
      <ProfilePageContent />
    </Suspense>
  );
}

function ProfileSkeleton() {
  return (
    <div className={`space-y-6 ${PATTERNS.maxWidthMd}`}>
      <div className="flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}

function ProfileContent({ address, copied, setCopied, isDemo, demoTier }: { address: string; copied: boolean; setCopied: (v: boolean) => void; isDemo: boolean; demoTier: string }) {
  const [profile, setProfile] = useState<AggregatedProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      setLoading(true);
      setError(null);

      // Demo mode: use mock data based on tier
      if (isDemo || address === DEMO_ADDRESS) {
        const demoProfile = DEMO_PROFILES[demoTier] || DEMO_PROFILES.gold;
        setProfile(demoProfile);
        setLoading(false);
        return;
      }

      try {
        // Use unified leaderboard with address lookup - uses cached data, instant response
        const res = await fetch(`/api/unified-leaderboard?address=${address}`);

        if (!res.ok) {
          if (res.status === 404) {
            // 404 from unified-leaderboard means no simulated trades yet, but check Veritas on-chain (0x9035... has NFT 1)
            try {
              // Try to fetch Veritas on-chain profile directly via contract read API
              const veritasRes = await fetch(`/api/veritas/profile?address=${address}`);
              if (veritasRes.ok) {
                const veritasData = await veritasRes.json();
                if (veritasData.hasRegistered) {
                  setProfile({
                    address,
                    username: veritasData.username || null,
                    veritasScore: veritasData.veritasScore || 0,
                    winRate: veritasData.winRate || 0,
                    totalBets: veritasData.totalBets || veritasData.totalPredictions || 0,
                    wins: veritasData.wins || 0,
                    losses: veritasData.losses || 0,
                    totalVolume: veritasData.totalVolume || { STT: 0, USD: 0 },
                    totalPnl: veritasData.totalPnl || { STT: 0, USD: 0 },
                    platforms: [{ platform: 'DreamDEX Event Contracts', veritasScore: veritasData.veritasScore || 0, winRate: veritasData.winRate || 0, totalBets: veritasData.totalBets || 0, wins: veritasData.wins || 0, losses: veritasData.losses || 0, volume: '0', pnl: 0 }],
                    globalRank: veritasData.rank || null,
                  });
                  setLoading(false);
                  return;
                }
              }
            } catch {}
            // Fallback: show minimal Veritas profile for any address that has interacted (e.g., 0x9035 deployer)
            // Even with 0 score, show Bronze 0 instead of "No Profile Found"
            setProfile({
              address,
              username: undefined,
              veritasScore: 0,
              winRate: 0,
              totalBets: 0,
              wins: 0,
              losses: 0,
              totalVolume: { STT: 0, USD: 0 },
              totalPnl: { STT: 0, USD: 0 },
              platforms: [{ platform: 'DreamDEX Event Contracts', veritasScore: 0, winRate: 0, totalBets: 0, wins: 0, losses: 0, volume: '0', pnl: 0 }],
              globalRank: undefined,
            });
            setLoading(false);
            return;
          }
          throw new Error('Failed to fetch profile');
        }

        const { data: traderData } = await res.json();

        // Transform platform breakdown data
        const foundPlatforms: PlatformData[] = (traderData.platformBreakdown || []).map((p: any) => ({
          platform: p.platform,
          veritasScore: p.score || 0,
          winRate: p.winRate || 0,
          totalBets: p.bets || 0,
          wins: Math.round((p.bets || 0) * (p.winRate || 0) / 100),
          losses: Math.round((p.bets || 0) * (1 - (p.winRate || 0) / 100)),
          volume: p.volume || '0',
          pnl: p.pnl,
          rank: undefined,
        }));

        // Aggregate volume by currency (must be before early return to avoid TDZ)
        const totalVolume: Record<string, number> = {};
        const totalPnl: Record<string, number> = {};

        if (foundPlatforms.length === 0) {
          // No platform trades yet, but show Veritas on-chain profile if it exists (e.g., 0x9035... has NFT 1)
          // Fall back to on-chain VeritasCore data so deployer/tester never sees "No Profile Found"
          if (traderData.veritasScore !== undefined || traderData.totalBets !== undefined) {
            // Use traderData volumes if present, else empty
            const fallbackVolume = traderData.totalVolume && typeof traderData.totalVolume === 'object' ? traderData.totalVolume : totalVolume;
            const fallbackPnl = traderData.totalPnl && typeof traderData.totalPnl === 'object' ? traderData.totalPnl : totalPnl;
            setProfile({
              address,
              username: traderData.username || null,
              veritasScore: traderData.veritasScore || 0,
              winRate: traderData.winRate || 0,
              totalBets: traderData.totalBets || traderData.totalPredictions || 0,
              wins: traderData.wins || 0,
              losses: traderData.losses || 0,
              totalVolume: fallbackVolume as Record<string, number>,
              totalPnl: fallbackPnl as Record<string, number>,
              platforms: [{ platform: 'DreamDEX Event Contracts', veritasScore: traderData.veritasScore || 0, winRate: traderData.winRate || 0, totalBets: traderData.totalBets || 0, wins: traderData.wins || 0, losses: traderData.losses || 0, volume: '0', pnl: 0 }],
              globalRank: traderData.rank || null,
            });
            setLoading(false);
            return;
          }
          setProfile(null);
          setLoading(false);
          return;
        }

        foundPlatforms.forEach((p) => {
          const currency = PLATFORM_CONFIG[p.platform]?.volumeCurrency || 'USD';
          const vol = parseFloat(p.volume) || 0;
          totalVolume[currency] = (totalVolume[currency] || 0) + vol;
          if (p.pnl !== undefined) {
            totalPnl[currency] = (totalPnl[currency] || 0) + p.pnl;
          }
        });

        setProfile({
          address,
          username: traderData.username,
          veritasScore: traderData.veritasScore || 0,
          winRate: traderData.winRate || 0,
          totalBets: traderData.totalBets || traderData.totalPredictions || 0,
          wins: traderData.wins || 0,
          losses: traderData.losses || 0,
          totalVolume,
          totalPnl,
          platforms: foundPlatforms,
          globalRank: traderData.rank || undefined,
        });
      } catch (err: any) {
        console.error('Error fetching profile:', err);
        setError(err.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [address, isDemo, demoTier]);

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Veritas Profile',
        text: `Check out this Veritas profile!`,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  const formatVolume = (amount: number, currency: string) => {
    const symbol = currency === 'USD' ? '$' : '';
    const suffix = currency !== 'USD' ? ` ${currency}` : '';
    if (amount >= 1000000) return `${symbol}${(amount / 1000000).toFixed(1)}M${suffix}`;
    if (amount >= 1000) return `${symbol}${(amount / 1000).toFixed(1)}K${suffix}`;
    if (amount >= 1) return `${symbol}${amount.toFixed(1)}${suffix}`;
    return `${symbol}${amount.toFixed(2)}${suffix}`;
  };

  const formatPnL = (amount: number, currency: string) => {
    const prefix = amount >= 0 ? '+' : '';
    const symbol = currency === 'USD' ? '$' : '';
    const suffix = currency !== 'USD' ? ` ${currency}` : '';
    const abs = Math.abs(amount);
    if (abs >= 1000000) return `${prefix}${symbol}${(amount / 1000000).toFixed(1)}M${suffix}`;
    if (abs >= 1000) return `${prefix}${symbol}${(amount / 1000).toFixed(1)}K${suffix}`;
    if (abs >= 1) return `${prefix}${symbol}${amount.toFixed(1)}${suffix}`;
    return `${prefix}${symbol}${amount.toFixed(2)}${suffix}`;
  };

  if (loading) {
    return <ProfileSkeleton />;
  }

  if (error) {
    return (
      <div className={`container px-4 py-12 text-center ${PATTERNS.maxWidthMd}`}>
        <Card className="border-destructive/50">
          <CardContent className="py-12">
            <Activity className="w-12 h-12 mx-auto mb-4 text-destructive opacity-50" />
            <h2 className="text-xl font-bold mb-2">Error Loading Profile</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className={`container px-4 py-12 text-center ${PATTERNS.maxWidthMd}`}>
        <Card className="border-border/50">
          <CardContent className="py-12">
            <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-30" />
            <h2 className="text-xl font-bold mb-2">No Profile Found</h2>
            <p className="text-muted-foreground mb-4">
              This address hasn't been found on any supported prediction platforms.
            </p>
            <code className="text-xs font-mono text-muted-foreground bg-surface px-2 py-1 rounded">
              {address}
            </code>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tier = getTierFromScore(profile.veritasScore);
  const currentTierThreshold = TIER_THRESHOLDS[tier];
  const nextTier = tier < ReputationTier.DIAMOND ? (tier + 1) as ReputationTier : tier;
  const nextTierThreshold = TIER_THRESHOLDS[nextTier];
  const progressToNextTier = tier < ReputationTier.DIAMOND
    ? Math.min(100, ((profile.veritasScore - currentTierThreshold) / (nextTierThreshold - currentTierThreshold)) * 100)
    : 100;

  const primaryPlatform = profile.platforms[0]?.platform || 'DreamDEX Event Contracts';
  const primaryExplorer = PLATFORM_CONFIG[primaryPlatform]?.explorer || 'https://somniascan.com/address/';

  // Calculate total PnL status
  const hasPnL = Object.keys(profile.totalPnl).length > 0;
  const netPositive = Object.values(profile.totalPnl).reduce((a, b) => a + b, 0) >= 0;

  return (
    <div className={`container px-4 py-6 md:py-12 space-y-6 ${PATTERNS.maxWidthMd}`}>
      {/* Header Card - Diamond/Platinum get verification glow for premium feel */}
      <Card className={`border-border/50 overflow-hidden ${tier >= ReputationTier.PLATINUM ? 'verification-glow' : ''}`}>
        <div className={`relative p-6 ${TIER_COLORS[tier]} bg-opacity-10`} style={{
          background: `linear-gradient(135deg, hsl(var(--${tier === ReputationTier.DIAMOND ? 'primary' : tier === ReputationTier.GOLD ? 'secondary' : 'muted'})) 0%, transparent 100%)`
        }}>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16 border-2 border-white/20 shadow-lg">
                <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-white text-xl font-bold">
                  {address.slice(2, 4).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {profile.globalRank && profile.globalRank <= 10 && (
                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${
                      profile.globalRank === 1 ? 'bg-secondary/20 text-secondary' :
                      profile.globalRank <= 3 ? 'bg-amber-500/20 text-amber-400' :
                      'bg-primary/20 text-primary'
                    }`}>
                      {profile.globalRank === 1 ? <Crown className="w-3.5 h-3.5" /> : <Trophy className="w-3.5 h-3.5" />}
                      <span className="text-sm font-bold">#{profile.globalRank}</span>
                    </div>
                  )}
                  <Badge className={`${TIER_COLORS[tier]} text-white`}>
                    <Award className="w-3 h-3 mr-1" />
                    {TIER_NAMES[tier]}
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  <code className="text-sm md:text-base font-mono">{shortenAddress(address)}</code>
                  <Button variant="ghost" size="icon" onClick={handleCopyAddress} className="h-7 w-7">
                    {copied ? <CheckCircle2 className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {profile.platforms.map((p) => (
                    <span
                      key={p.platform}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${PLATFORM_CONFIG[p.platform]?.bgColor} ${PLATFORM_CONFIG[p.platform]?.color}`}
                    >
                      {PLATFORM_CONFIG[p.platform]?.icon} {p.platform.split(' ')[0]}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <CopyTradeButton
                traderAddress={address}
                traderStats={{
                  winRate: profile.winRate,
                  totalBets: profile.totalBets,
                  totalVolume: Object.entries(profile.totalVolume).map(([c, v]) => formatVolume(v, c)).join(' + '),
                  platforms: profile.platforms.map(p => p.platform),
                  veritasScore: profile.veritasScore,
                }}
                size="sm"
              />
              <Button variant="outline" size="sm" onClick={handleShare}>
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <CardContent className="p-0">
          <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-y md:divide-y-0 divide-border/50">
            <div className="p-4 text-center">
              <p className="text-2xl font-bold text-secondary">{profile.veritasScore}</p>
              <p className="text-xs text-muted-foreground">VeritasScore</p>
            </div>
            <div className="p-4 text-center">
              <p className="text-2xl font-bold text-success">{profile.winRate.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">Win Rate</p>
            </div>
            <div className="p-4 text-center">
              <p className="text-2xl font-bold">{profile.totalBets.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Total Bets</p>
            </div>
            <div className="p-4 text-center">
              <div className="text-lg font-bold text-primary">
                {Object.entries(profile.totalVolume).map(([currency, amount], idx) => (
                  <span key={currency}>
                    {idx > 0 && <span className="text-muted-foreground"> + </span>}
                    {formatVolume(amount, currency)}
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Volume</p>
            </div>
            <div className="p-4 text-center col-span-2 md:col-span-1">
              {hasPnL ? (
                <>
                  <div className={`text-lg font-bold flex items-center justify-center gap-1 ${netPositive ? 'text-success' : 'text-destructive'}`}>
                    {netPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    {Object.entries(profile.totalPnl).map(([currency, amount], idx) => (
                      <span key={currency}>
                        {idx > 0 && <span className="text-muted-foreground"> + </span>}
                        {formatPnL(amount, currency)}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">PnL</p>
                </>
              ) : (
                <>
                  <p className="text-lg font-bold text-success">{profile.wins}</p>
                  <p className="text-xs text-muted-foreground">Wins</p>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tier Progress */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="w-4 h-4 text-secondary" />
            Tier Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge className={`${TIER_COLORS[tier]} text-white`}>
                {TIER_NAMES[tier]}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {profile.veritasScore} / {nextTierThreshold} points
              </span>
            </div>
            {tier < ReputationTier.DIAMOND && (
              <Badge variant="outline">
                Next: {TIER_NAMES[nextTier]}
              </Badge>
            )}
          </div>

          {tier < ReputationTier.DIAMOND ? (
            <>
              <Progress value={progressToNextTier} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {nextTierThreshold - profile.veritasScore} points to {TIER_NAMES[nextTier]}
              </p>
            </>
          ) : (
            <div className="text-center py-2">
              <p className="text-sm font-medium text-secondary">
                Maximum tier achieved
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Platform Breakdown */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="w-4 h-4 text-primary" />
            Platform Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {profile.platforms.map((p) => {
            const config = PLATFORM_CONFIG[p.platform];
            const platformTier = getTierFromScore(p.veritasScore);
            const currency = config?.volumeCurrency || 'USD';
            const volume = parseFloat(p.volume) || 0;

            return (
              <div
                key={p.platform}
                className="flex items-center justify-between p-4 rounded-lg bg-surface/50 border border-border/30 hover:border-border/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{config?.icon || '📊'}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{p.platform}</p>
                      {p.rank && p.rank <= 10 && (
                        <span className="text-xs text-muted-foreground">#{p.rank}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{p.totalBets.toLocaleString()} bets</span>
                      <span>·</span>
                      <span>{formatVolume(volume, currency)}</span>
                      {p.pnl !== undefined && p.pnl !== 0 && (
                        <>
                          <span>·</span>
                          <span className={p.pnl >= 0 ? 'text-success' : 'text-destructive'}>
                            {formatPnL(p.pnl, currency)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-semibold text-success">{p.winRate.toFixed(1)}%</p>
                    <p className="text-[10px] text-muted-foreground">win rate</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-secondary">{p.veritasScore}</p>
                    <p className="text-[10px] text-muted-foreground">score</p>
                  </div>
                  <a
                    href={`${config?.explorer}${address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-md hover:bg-surface transition-colors"
                    title={`View on ${config?.chain} explorer`}
                  >
                    <ExternalLink className="w-4 h-4 text-muted-foreground" />
                  </a>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-success/30 bg-gradient-to-br from-success/5 to-transparent">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-success" />
              </div>
              <p className="text-xs text-muted-foreground">Wins</p>
            </div>
            <p className="text-2xl font-bold text-success">{profile.wins.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card className="border-destructive/30 bg-gradient-to-br from-destructive/5 to-transparent">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-destructive/20 flex items-center justify-center">
                <Target className="w-4 h-4 text-destructive" />
              </div>
              <p className="text-xs text-muted-foreground">Losses</p>
            </div>
            <p className="text-2xl font-bold text-destructive">{profile.losses.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <Activity className="w-4 h-4 text-primary" />
              </div>
              <p className="text-xs text-muted-foreground">Platforms</p>
            </div>
            <p className="text-2xl font-bold">{profile.platforms.length}</p>
          </CardContent>
        </Card>

        <Card className="border-secondary/30 bg-gradient-to-br from-secondary/5 to-transparent">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center">
                <Users className="w-4 h-4 text-secondary" />
              </div>
              <p className="text-xs text-muted-foreground">Global Rank</p>
            </div>
            <p className="text-2xl font-bold">
              {profile.globalRank ? `#${profile.globalRank}` : '-'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Explorer Links */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="w-4 h-4" />
            View on Explorers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {profile.platforms.map((p) => {
              const config = PLATFORM_CONFIG[p.platform];
              return (
                <Button
                  key={p.platform}
                  variant="outline"
                  size="sm"
                  asChild
                  className={`${config?.bgColor} border-0`}
                >
                  <a
                    href={`${config?.explorer}${address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="mr-1">{config?.icon}</span>
                    {config?.chain}
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
