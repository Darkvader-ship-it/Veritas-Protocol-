'use client'


import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TIER_NAMES, TIER_COLORS, ReputationTier, TIER_THRESHOLDS } from '@/lib/contracts';
import { useLeaderboard, useRefreshLeaderboard } from '@/lib/queries';
import { useQuery } from '@tanstack/react-query';
import {
  PAGE_HEADER,
  PATTERNS,
  formatVolume as formatVolumeFromTokens,
  shortenAddress as shortenAddressFromTokens,
  getTierFromScore as getTierFromScoreToken,
  TierName,
} from '@/components/ui/design-tokens';
import { TraderCard } from '@/components/ui/trader-card';
import { SectionDivider } from '@/components/ui/section-divider';
import { PlatformBadgeList } from '@/components/ui/platform-badge';
import {
  Trophy,
  Medal,
  Search,
  Copy,
  Check,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Users,
  ExternalLink,
  Crown,
  Radio,
  FlaskConical,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { UserDetailModal } from '@/components/UserDetailModal';
import { CopyTradeButton } from '@/components/CopyTradeButton';
import { formatEther } from 'viem';

interface LeaderboardEntry {
  rank: number;
  address: string;
  veritasScore: number;
  rawScore: number;  // Original platform score
  normalizedScore: number;  // Percentile-normalized score (0-1300)
  percentileRank: number;  // Percentile within platform (0-100)
  tier: number;
  winRate: number;
  totalPredictions: number;
  totalBets?: number;
  wins?: number;
  losses?: number;
  correctPredictions: number;
  totalVolume: string;
  nftTokenId: number;
  platforms?: string[];
  username?: string;
  pnl?: number;
  platformBreakdown?: any[];
  profileImage?: string;
}

const ITEMS_PER_PAGE = 20;

// Map TierName to ReputationTier for compatibility with existing code
const TIER_NAME_TO_ENUM: Record<TierName, ReputationTier> = {
  diamond: ReputationTier.DIAMOND,
  platinum: ReputationTier.PLATINUM,
  gold: ReputationTier.GOLD,
  silver: ReputationTier.SILVER,
  bronze: ReputationTier.BRONZE,
};

function getTierFromScore(score: number): ReputationTier {
  const tierName = getTierFromScoreToken(score);
  return TIER_NAME_TO_ENUM[tierName];
}

const TIER_FILTER_MAP: Record<string, ReputationTier | null> = {
  all: null,
  diamond: ReputationTier.DIAMOND,
  platinum: ReputationTier.PLATINUM,
  gold: ReputationTier.GOLD,
  silver: ReputationTier.SILVER,
  bronze: ReputationTier.BRONZE,
};

// Platforms available for simulated leaderboard
const SIMULATED_PLATFORMS = [
  { value: 'polymarket', label: 'Polymarket' },
  { value: 'dreamdex', label: 'DreamDEX' },
  { value: 'azuro', label: 'Azuro' },
  { value: 'sxbet', label: 'SX Bet' },
  { value: 'limitless', label: 'Limitless' },
  { value: 'overtime', label: 'Overtime' },
  { value: 'speedmarkets', label: 'Speed Markets' },
  { value: 'gnosis', label: 'Gnosis/Omen' },
  { value: 'drift', label: 'Drift' },
  { value: 'kalshi', label: 'Kalshi' },
  { value: 'manifold', label: 'Manifold' },
  { value: 'metaculus', label: 'Metaculus' },
];

export default function LeaderboardPage() {
  const router = useRouter();
  const { toast } = useToast();

  // UI state only - data state managed by React Query
  const [leaderboardMode, setLeaderboardMode] = useState<'live' | 'simulated'>('live');
  const [sortBy, setSortBy] = useState('score');
  const [tierFilter, setTierFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [simulatedPlatform, setSimulatedPlatform] = useState('polymarket');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<LeaderboardEntry | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // React Query hooks - automatic caching, retry, and deduplication
  const { data: unifiedLeaderboard, isLoading: isLoadingLive, refetch: refetchLive } = useLeaderboard(500);
  const refreshMutation = useRefreshLeaderboard();

  // Simulated leaderboard query (separate, only runs when needed)
  const { data: simulatedResult, isLoading: isLoadingSimulated, refetch: refetchSimulated } = useQuery({
    queryKey: ['simulated-leaderboard', simulatedPlatform],
    queryFn: async () => {
      const res = await fetch(`/api/simulated-leaderboard?platform=${simulatedPlatform}&limit=100`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    staleTime: 60 * 1000, // 1 minute
    enabled: leaderboardMode === 'simulated', // Only fetch when in simulated mode
  });

  const isLoading = leaderboardMode === 'simulated' ? isLoadingSimulated : isLoadingLive;

  // Transform unified leaderboard data from API to component format
  const leaderboardData: LeaderboardEntry[] = useMemo(() => {
    if (!unifiedLeaderboard?.data) return [];
    return (unifiedLeaderboard.data || []).map((entry: any, index: number) => ({
      ...entry,
      rank: entry.rank || index + 1,
      totalPredictions: entry.totalBets || entry.totalPredictions || 0,
      correctPredictions: entry.wins || 0,
      rawScore: entry.veritasScore,
      normalizedScore: entry.veritasScore,
      tier: getTierFromScore(entry.veritasScore),
      nftTokenId: 0,
      platforms: entry.platforms || [],
      platformBreakdown: entry.platformBreakdown || [],
    }));
  }, [unifiedLeaderboard]);

  // Transform simulated leaderboard data
  const simulatedData: LeaderboardEntry[] = useMemo(() => {
    if (!simulatedResult?.data) return [];
    return (simulatedResult.data || []).map((entry: any, index: number) => ({
      ...entry,
      rank: entry.rank || index + 1,
      totalPredictions: entry.totalBets || 0,
      correctPredictions: entry.wins || 0,
      rawScore: entry.veritasScore,
      normalizedScore: entry.veritasScore,
      tier: getTierFromScore(entry.veritasScore),
      nftTokenId: 0,
      platforms: entry.platforms || [simulatedResult.platform],
      platformBreakdown: [{
        platform: simulatedResult.platform,
        bets: entry.totalBets || 0,
        winRate: entry.winRate || 0,
        score: entry.veritasScore || 0,
        volume: entry.totalVolume,
        pnl: entry.pnl || 0,
      }],
    }));
  }, [simulatedResult]);

  // Refresh handler for manual refresh button
  const handleRefresh = useCallback(() => {
    if (leaderboardMode === 'simulated') {
      refetchSimulated();
    } else {
      refetchLive();
    }
  }, [leaderboardMode, refetchSimulated, refetchLive]);

  // Data fetching removed - now using React Query hooks above (useLeaderboard, useQuery)
  // The /api/unified-leaderboard endpoint handles aggregation server-side
  // Old fetchLeaderboard() and fetchSimulatedLeaderboard() replaced with React Query

  // When filtering by platform, use raw scores and re-rank within platform
  const filteredData = (() => {
    // Use simulated data when in simulated mode
    let data = leaderboardMode === 'simulated' ? simulatedData : leaderboardData;

    // Platform filter
    if (platformFilter !== 'all') {
      data = data.filter(entry => {
        const platforms = entry.platforms || [];
        if (platformFilter === 'polymarket') return platforms.includes('Polymarket');
        if (platformFilter === 'dreamdex') return platforms.includes('DreamDEX Event Contracts');
        if (platformFilter === 'overtime') return platforms.includes('Overtime');
        if (platformFilter === 'speedmarkets') return platforms.includes('Speed Markets');
        if (platformFilter === 'limitless') return platforms.includes('Limitless');
        if (platformFilter === 'azuro') return platforms.includes('Azuro');
        if (platformFilter === 'sxbet') return platforms.includes('SX Bet');
        if (platformFilter === 'gnosis') return platforms.includes('Gnosis/Omen') || platforms.includes('Gnosis') || platforms.includes('Omen');
        if (platformFilter === 'drift') return platforms.includes('Drift BET') || platforms.includes('Drift');
        if (platformFilter === 'kalshi') return platforms.includes('Kalshi');
        if (platformFilter === 'manifold') return platforms.includes('Manifold Markets') || platforms.includes('Manifold');
        if (platformFilter === 'metaculus') return platforms.includes('Metaculus');
        return true;
      });

      // When filtering by platform, use raw scores and re-rank
      data = data.map(entry => ({
        ...entry,
        veritasScore: entry.rawScore, // Show raw platform score
        tier: getTierFromScore(entry.rawScore),
      }));
    }

    // Search filter - by address or username
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      data = data.filter(entry =>
        entry.address.toLowerCase().includes(query) ||
        (entry.username && entry.username.toLowerCase().includes(query))
      );
    }

    // Tier filter (applied after platform filter)
    if (tierFilter !== 'all') {
      data = data.filter(entry => entry.tier === TIER_FILTER_MAP[tierFilter]);
    }

    // Apply sorting
    data = [...data].sort((a, b) => {
      switch (sortBy) {
        case 'winRate':
          return b.winRate - a.winRate;
        case 'predictions':
          return b.totalPredictions - a.totalPredictions;
        case 'score':
        default:
          return b.veritasScore - a.veritasScore;
      }
    });

    // Re-rank after all filters and sorting
    data = data.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));

    return data;
  })();

  useEffect(() => {
    setCurrentPage(1);
  }, [tierFilter, platformFilter, sortBy, searchQuery, leaderboardMode, simulatedPlatform]);

  const handleCopyAddress = (address: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    toast({ title: 'Copied', description: 'Address copied to clipboard' });
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  // Use design token utilities
  const shortenAddress = shortenAddressFromTokens;
  const formatVolume = formatVolumeFromTokens;

  // Separate top 3 and rest
  const top3 = filteredData.slice(0, 3);
  const restData = filteredData.slice(3);

  const totalPages = Math.ceil(restData.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentPageData = restData.slice(startIndex, startIndex + ITEMS_PER_PAGE);


  return (
    <div className="flex flex-col min-h-screen">
      {/* Compact Header Bar - title, toggle, and stats in one row */}
      <section className="border-b border-border/50 bg-background">
        <div className={`container px-5 md:px-6 ${PATTERNS.maxWidthLg}`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-4">
            {/* Left: Title */}
            <div className="flex items-center gap-4">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                {leaderboardMode === 'simulated'
                  ? `${SIMULATED_PLATFORMS.find(p => p.value === simulatedPlatform)?.label || 'Simulated'} Leaderboard`
                  : platformFilter === 'all' ? 'Leaderboard' :
                    platformFilter === 'polymarket' ? 'Polymarket' :
                    platformFilter === 'dreamdex' ? 'DreamDEX' :
                    platformFilter === 'overtime' ? 'Overtime' :
                    platformFilter === 'speedmarkets' ? 'Speed Markets' :
                    platformFilter === 'limitless' ? 'Limitless' :
                    platformFilter === 'azuro' ? 'Azuro' :
                    platformFilter === 'sxbet' ? 'SX Bet' : platformFilter === 'gnosis' ? 'Gnosis/Omen' : platformFilter === 'drift' ? 'Drift BET' : platformFilter === 'kalshi' ? 'Kalshi' : platformFilter === 'manifold' ? 'Manifold' : platformFilter === 'metaculus' ? 'Metaculus' : 'Leaderboard'}
              </h1>
              {/* Mode Toggle - inline with title */}
              <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-surface/50 border border-border/50">
                <button
                  onClick={() => setLeaderboardMode('live')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    leaderboardMode === 'live'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                  }`}
                >
                  <Radio className="w-3 h-3" />
                  Live
                </button>
                <button
                  onClick={() => setLeaderboardMode('simulated')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    leaderboardMode === 'simulated'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                  }`}
                >
                  <FlaskConical className="w-3 h-3" />
                  Simulated
                </button>
              </div>
            </div>

            {/* Right: Stats */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="font-semibold">{filteredData.length}</span>
                <span className="text-muted-foreground">traders</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-secondary" />
                <span className="font-semibold text-secondary">{filteredData[0]?.veritasScore || 0}</span>
                <span className="text-muted-foreground">top</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Section */}
      <section className="py-4">
        <div className={`container px-5 md:px-6 ${PATTERNS.maxWidthLg}`}>
          {/* Sticky Filters */}
      <div className="sticky top-16 z-10 bg-background/95 backdrop-blur-sm py-3 -mx-4 px-4 sm:-mx-6 sm:px-6 border-b border-border/50">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[130px] h-9 text-sm">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="score">VeritasScore</SelectItem>
              <SelectItem value="winRate">Win Rate</SelectItem>
              <SelectItem value="predictions">Predictions</SelectItem>
            </SelectContent>
          </Select>

          {leaderboardMode === 'simulated' ? (
            <Select value={simulatedPlatform} onValueChange={setSimulatedPlatform}>
              <SelectTrigger className="w-[140px] h-9 text-sm">
                <SelectValue placeholder="Platform" />
              </SelectTrigger>
              <SelectContent>
                {SIMULATED_PLATFORMS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="w-[140px] h-9 text-sm">
                <SelectValue placeholder="Platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Platforms</SelectItem>
                <SelectItem value="polymarket">Polymarket</SelectItem>
                <SelectItem value="dreamdex">DreamDEX</SelectItem>
                <SelectItem value="overtime">Overtime</SelectItem>
                <SelectItem value="speedmarkets">Speed Markets</SelectItem>
                <SelectItem value="limitless">Limitless</SelectItem>
                <SelectItem value="azuro">Azuro</SelectItem>
                <SelectItem value="sxbet">SX Bet</SelectItem>
                <SelectItem value="gnosis">Gnosis/Omen</SelectItem>
                <SelectItem value="drift">Drift BET</SelectItem>
                <SelectItem value="kalshi">Kalshi</SelectItem>
                <SelectItem value="manifold">Manifold</SelectItem>
                <SelectItem value="metaculus">Metaculus</SelectItem>
              </SelectContent>
            </Select>
          )}

          <Select value={tierFilter} onValueChange={setTierFilter}>
            <SelectTrigger className="w-[120px] h-9 text-sm">
              <SelectValue placeholder="Tier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tiers</SelectItem>
              <SelectItem value="diamond">Diamond</SelectItem>
              <SelectItem value="platinum">Platinum</SelectItem>
              <SelectItem value="gold">Gold</SelectItem>
              <SelectItem value="silver">Silver</SelectItem>
              <SelectItem value="bronze">Bronze</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isLoading}
            className="h-9 w-9 shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
          </div>
          <div className="space-y-2">
            {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
        </div>
      ) : filteredData.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="py-16 text-center">
            <Trophy className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-30" />
            <p className="text-muted-foreground mb-1">No traders on the leaderboard yet</p>
            <p className="text-sm text-muted-foreground/70 mb-6">
              The leaderboard fills up with real trades placed through the DreamDEX Terminal.
            </p>
            <Button asChild size="sm">
              <a href="/dreamdex">
                Start Trading
                <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
              </a>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Podium - Top 3 - Using TraderCard component */}
          {/* Mobile: single column with 1st on top. Desktop: traditional podium 2nd|1st|3rd */}
          {top3.length > 0 && currentPage === 1 && tierFilter === 'all' && !searchQuery && (
            <div className={`grid gap-3 sm:gap-4 mb-6 pt-6 ${
              top3.length === 1 ? 'grid-cols-1 max-w-md mx-auto' :
              top3.length === 2 ? 'grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto' :
              'grid-cols-1 sm:grid-cols-3 sm:items-end'
            }`}>
              {/* For 3 traders: 2nd | 1st | 3rd (podium order) - items-end for staggered heights */}
              {/* For 2 traders: 1st | 2nd (side by side, equal) - items-start for top alignment */}
              {/* For 1 trader: just 1st centered */}

              {top3.length >= 3 ? (
                <>
                  {/* 1st Place - Mobile: first, Desktop: center */}
                  <TraderCard
                    key={top3[0].address}
                    address={top3[0].address}
                    username={top3[0].username}
                    rank={1}
                    veritasScore={top3[0].veritasScore}
                    winRate={top3[0].winRate}
                    totalPredictions={top3[0].totalPredictions}
                    totalVolume={top3[0].totalVolume}
                    platforms={top3[0].platforms}
                    variant="podium"
                    featured
                    onClick={() => { setSelectedUser(top3[0]); setIsModalOpen(true); }}
                    customFormatVolume={formatVolume}
                    className="order-1 sm:order-2"
                  />
                  {/* 2nd Place - Mobile: second, Desktop: left */}
                  <TraderCard
                    key={top3[1].address}
                    address={top3[1].address}
                    username={top3[1].username}
                    rank={2}
                    veritasScore={top3[1].veritasScore}
                    winRate={top3[1].winRate}
                    totalPredictions={top3[1].totalPredictions}
                    totalVolume={top3[1].totalVolume}
                    platforms={top3[1].platforms}
                    variant="podium"
                    onClick={() => { setSelectedUser(top3[1]); setIsModalOpen(true); }}
                    customFormatVolume={formatVolume}
                    className="order-2 sm:order-1"
                  />
                  {/* 3rd Place - Mobile: third, Desktop: right */}
                  <TraderCard
                    key={top3[2].address}
                    address={top3[2].address}
                    username={top3[2].username}
                    rank={3}
                    veritasScore={top3[2].veritasScore}
                    winRate={top3[2].winRate}
                    totalPredictions={top3[2].totalPredictions}
                    totalVolume={top3[2].totalVolume}
                    platforms={top3[2].platforms}
                    variant="podium"
                    onClick={() => { setSelectedUser(top3[2]); setIsModalOpen(true); }}
                    customFormatVolume={formatVolume}
                    className="order-3"
                  />
                </>
              ) : top3.length === 2 ? (
                <>
                  {/* 1st Place - Left (same size as 2nd for balanced 2-card layout) */}
                  <TraderCard
                    key={top3[0].address}
                    address={top3[0].address}
                    username={top3[0].username}
                    rank={1}
                    veritasScore={top3[0].veritasScore}
                    winRate={top3[0].winRate}
                    totalPredictions={top3[0].totalPredictions}
                    totalVolume={top3[0].totalVolume}
                    platforms={top3[0].platforms}
                    variant="podium"
                    onClick={() => { setSelectedUser(top3[0]); setIsModalOpen(true); }}
                    customFormatVolume={formatVolume}
                  />
                  {/* 2nd Place - Right */}
                  <TraderCard
                    key={top3[1].address}
                    address={top3[1].address}
                    username={top3[1].username}
                    rank={2}
                    veritasScore={top3[1].veritasScore}
                    winRate={top3[1].winRate}
                    totalPredictions={top3[1].totalPredictions}
                    totalVolume={top3[1].totalVolume}
                    platforms={top3[1].platforms}
                    variant="podium"
                    onClick={() => { setSelectedUser(top3[1]); setIsModalOpen(true); }}
                    customFormatVolume={formatVolume}
                  />
                </>
              ) : (
                /* Single trader - centered */
                <TraderCard
                  key={top3[0].address}
                  address={top3[0].address}
                  username={top3[0].username}
                  rank={1}
                  veritasScore={top3[0].veritasScore}
                  winRate={top3[0].winRate}
                  totalPredictions={top3[0].totalPredictions}
                  totalVolume={top3[0].totalVolume}
                  platforms={top3[0].platforms}
                  variant="podium"
                  featured
                  onClick={() => { setSelectedUser(top3[0]); setIsModalOpen(true); }}
                  customFormatVolume={formatVolume}
                />
              )}
            </div>
          )}

          {/* Rest of Leaderboard */}
          {(currentPageData.length > 0 || currentPage > 1 || tierFilter !== 'all' || searchQuery) && (
            <Card className="border-border/50 overflow-hidden">
              <CardContent className="p-0">
                <div className="divide-y divide-border/30">
                  {(tierFilter === 'all' && !searchQuery && currentPage === 1 ? currentPageData : filteredData.slice(startIndex, startIndex + ITEMS_PER_PAGE)).map((entry) => {
                    const tier = getTierFromScore(entry.veritasScore);
                    const isTop3 = entry.rank <= 3;

                    return (
                      <div
                        key={entry.address}
                        onClick={() => { setSelectedUser(entry); setIsModalOpen(true); }}
                        className="flex items-center gap-3 p-3 sm:p-4 hover:bg-surface/50 cursor-pointer transition-colors group"
                      >
                        {/* Rank */}
                        <div className="w-8 text-center shrink-0">
                          {isTop3 ? (
                            <div className={`w-7 h-7 mx-auto rounded-full flex items-center justify-center ${
                              entry.rank === 1 ? 'bg-secondary/20 text-secondary' :
                              entry.rank === 2 ? 'bg-gray-400/20 text-gray-400' :
                              'bg-amber-600/20 text-amber-600'
                            }`}>
                              {entry.rank === 1 ? <Trophy className="w-4 h-4" /> : <Medal className="w-4 h-4" />}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">{entry.rank}</span>
                          )}
                        </div>

                        {/* Avatar */}
                        <Avatar className="h-9 w-9 shrink-0 hidden sm:flex">
                          <AvatarFallback className="bg-gradient-to-br from-primary/80 to-secondary/80 text-white text-xs">
                            {entry.address.slice(2, 4).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            {entry.username ? (
                              <span className="text-sm font-medium truncate">{entry.username}</span>
                            ) : (
                              <code className="text-sm font-mono truncate">{shortenAddress(entry.address)}</code>
                            )}
                            <button onClick={(e) => handleCopyAddress(entry.address, e)} className="p-1 hover:bg-white/10 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                              {copiedAddress === entry.address ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
                            </button>
                            <Badge className={`${TIER_COLORS[tier]} text-white text-[10px] px-1.5 py-0`}>
                              {TIER_NAMES[tier]}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <TrendingUp className="w-3 h-3 text-success" />
                              {entry.winRate.toFixed(1)}%
                            </span>
                            <span>{entry.totalPredictions.toLocaleString()} bets</span>
                            <span className="hidden sm:inline">{formatVolume(entry.totalVolume, entry.platforms)} vol</span>
                            <PlatformBadgeList platforms={entry.platforms || []} size="sm" max={3} />
                          </div>
                        </div>

                        {/* Score */}
                        <div className="text-right shrink-0">
                          <p className="text-lg font-bold text-secondary">{entry.veritasScore}</p>
                          {platformFilter === 'all' && entry.percentileRank !== undefined && (
                            <p className="text-[10px] text-muted-foreground hidden sm:block">
                              Top {(100 - entry.percentileRank).toFixed(0)}%
                            </p>
                          )}
                          {platformFilter !== 'all' && (
                            <p className="text-[10px] text-muted-foreground hidden sm:block">Raw Score</p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="hidden md:flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <CopyTradeButton
                            traderAddress={entry.address}
                            traderStats={{
                              winRate: entry.winRate,
                              totalBets: entry.totalBets || entry.totalPredictions,
                              totalVolume: entry.totalVolume,
                              platforms: entry.platforms,
                              veritasScore: entry.veritasScore,
                            }}
                            size="sm"
                            variant="outline"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.push(`/profile/${entry.address}`)}
                            className="h-8 w-8"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between p-4 border-t border-border/50">
                    <span className="text-sm text-muted-foreground">
                      {startIndex + 1 + (tierFilter === 'all' && !searchQuery ? 3 : 0)}-{Math.min(startIndex + ITEMS_PER_PAGE + (tierFilter === 'all' && !searchQuery ? 3 : 0), filteredData.length)} of {filteredData.length}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="h-8"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="h-8"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
        </div>
      </section>

      {/* User Detail Modal */}
      <UserDetailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        userData={selectedUser}
      />
    </div>
  );
}
