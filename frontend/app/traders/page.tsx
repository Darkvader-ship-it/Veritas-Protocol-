'use client'


import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { TIER_NAMES, TIER_COLORS, TIER_THRESHOLDS, ReputationTier } from '@/lib/contracts';
import {
  useDiscoveryTraders,
  useTraderSearch,
  useTraderFollowStatus,
  TraderSearchResult,
  TraderBet,
} from '@/lib/queries';
import {
  Search,
  Trophy,
  Activity,
  Users,
  Copy,
  UserPlus,
  ArrowRight,
  ArrowLeft,
  History,
  X,
  Flame,
  Crown,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { isAddress } from 'viem';
import Link from 'next/link';
import { shortenAddress } from '@/components/ui/design-tokens';
import { PlatformBadge, PlatformBadgeList } from '@/components/ui/platform-badge';

// Re-export types for internal use (mapped from React Query hook types)
type TraderStats = TraderSearchResult;
type Bet = TraderBet;

interface LeaderboardEntry {
  wallet_address: string;
  username?: string;
  total_bets: number;
  wins: number;
  win_rate: number;
  veritas_score: number;
  total_volume: string;
}

function getTierFromScore(score: number): ReputationTier {
  if (score >= TIER_THRESHOLDS[ReputationTier.DIAMOND]) return ReputationTier.DIAMOND;
  if (score >= TIER_THRESHOLDS[ReputationTier.PLATINUM]) return ReputationTier.PLATINUM;
  if (score >= TIER_THRESHOLDS[ReputationTier.GOLD]) return ReputationTier.GOLD;
  if (score >= TIER_THRESHOLDS[ReputationTier.SILVER]) return ReputationTier.SILVER;
  return ReputationTier.BRONZE;
}

const SEARCH_HISTORY_KEY = 'veritas_search_history';
const MAX_HISTORY = 5;

export default function TraderSearchPage() {
  const account = useAccount();
  const [mounted, setMounted] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [activeSearchAddress, setActiveSearchAddress] = useState<string | undefined>(undefined);
  const [validationError, setValidationError] = useState('');
  const [showAllStats, setShowAllStats] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  // React Query hooks - declarative data fetching with caching
  const { topTraders: discoveryTopTraders, recentlyActive: discoveryRecentlyActive, isLoading: loadingDiscovery } = useDiscoveryTraders(8);

  // Trader search with React Query - only fetches when activeSearchAddress is set
  const {
    data: searchData,
    isLoading: searchLoading,
    isFetching: searchFetching,
  } = useTraderSearch(activeSearchAddress);

  // Extract data from search results
  const traderStats = searchData?.profile || null;
  const bets = searchData?.bets || [];
  const searchError = searchData?.error || validationError;
  const loading = searchLoading || searchFetching;

  // Check follow status using React Query
  const { data: followData } = useTraderFollowStatus(account.address, traderStats?.wallet_address);
  const isFollowing = followData?.isFollowing || false;

  // Map to local component's LeaderboardEntry format
  const topTraders: LeaderboardEntry[] = discoveryTopTraders.map(t => ({
    wallet_address: t.wallet_address,
    username: t.username,
    total_bets: t.total_bets,
    wins: t.wins,
    win_rate: t.win_rate,
    veritas_score: t.veritas_score,
    total_volume: t.total_volume,
  }));
  const recentlyActive: LeaderboardEntry[] = discoveryRecentlyActive.map(t => ({
    wallet_address: t.wallet_address,
    username: t.username,
    total_bets: t.total_bets,
    wins: t.wins,
    win_rate: t.win_rate,
    veritas_score: t.veritas_score,
    total_volume: t.total_volume,
  }));

  useEffect(() => {
    setMounted(true);
    loadSearchHistory();
  }, []);

  const isConnected = mounted && !!account.address;
  const userAddress = account.address;

  function loadSearchHistory() {
    try {
      const history = localStorage.getItem(SEARCH_HISTORY_KEY);
      if (history) setSearchHistory(JSON.parse(history));
    } catch (e) {
      console.error('Failed to load search history:', e);
    }
  }

  function saveToHistory(address: string) {
    const normalized = address.toLowerCase();
    const newHistory = [normalized, ...searchHistory.filter(a => a !== normalized)].slice(0, MAX_HISTORY);
    setSearchHistory(newHistory);
    try {
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(newHistory));
    } catch (e) {}
  }

  function removeFromHistory(address: string) {
    const newHistory = searchHistory.filter(a => a !== address);
    setSearchHistory(newHistory);
    try {
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(newHistory));
    } catch (e) {}
  }

  // Simplified search handler - triggers React Query hook by setting activeSearchAddress
  function handleSearch(address?: string) {
    const targetAddress = address || searchInput;

    // Validate before triggering the query
    if (!targetAddress.trim()) {
      setValidationError('Please enter an address');
      return;
    }
    if (!isAddress(targetAddress)) {
      setValidationError('Invalid Ethereum address');
      return;
    }

    // Clear any previous validation error
    setValidationError('');

    // Save to history
    saveToHistory(targetAddress);

    // Trigger React Query fetch by setting the address
    setActiveSearchAddress(targetAddress);
  }

  function formatSTT(wei: string): string {
    return (Number(wei) / 1e18).toFixed(4);
  }

  function calculateProfit(amount: string, claimedAmount: string | null, won: boolean | null): string {
    if (won === null || claimedAmount === null) return '0';
    return ((Number(claimedAmount) - Number(amount)) / 1e18).toFixed(4);
  }

  if (!mounted) return null;

  const featuredTrader = topTraders[0];
  const otherTopTraders = topTraders.slice(1, 7);

  return (
    <div className="container mx-auto px-4 sm:px-6 py-6 max-w-6xl">
      {/* Header + Search - Always visible */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">Find traders</h1>
        <p className="text-sm text-muted-foreground">Search by address or discover top performers</p>
      </div>

      {/* Search Bar */}
      <div className="flex gap-2 sm:gap-3 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Enter wallet address (0x...)"
            value={searchInput}
            onChange={(e) => { setSearchInput(e.target.value); setValidationError(''); }}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-9 h-11"
          />
        </div>
        <Button onClick={() => handleSearch()} disabled={loading} className="h-11 px-5">
          {loading ? <Activity className="h-4 w-4 animate-spin" /> : <><Search className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Search</span></>}
        </Button>
      </div>

      {searchError && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription className="text-sm">{searchError}</AlertDescription>
        </Alert>
      )}

      {/* RESULTS VIEW - Split layout on desktop */}
      {traderStats ? (
        <div className="lg:grid lg:grid-cols-[340px_1fr] lg:gap-6">
          {/* Left: Sticky Trader Card */}
          <div className="lg:sticky lg:top-20 lg:h-fit mb-6 lg:mb-0">
            <Card className="border-border/50 overflow-hidden">
              <div className="bg-gradient-to-br from-surface to-surface-raised p-4">
                <div className="flex items-center gap-3 mb-4">
                  <Avatar className="h-14 w-14 border-2 border-primary/30 shadow-lg">
                    <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-white font-bold text-lg">
                      {traderStats.wallet_address.slice(2, 4).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold truncate">{traderStats.username || shortenAddress(traderStats.wallet_address)}</p>
                      <Badge className={`${TIER_COLORS[getTierFromScore(traderStats.total_score)]} text-white text-xs shrink-0`}>
                        {TIER_NAMES[getTierFromScore(traderStats.total_score)]}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <code className="text-xs text-muted-foreground font-mono">{shortenAddress(traderStats.wallet_address)}</code>
                      <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => navigator.clipboard.writeText(traderStats.wallet_address)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Key Stats - Always visible */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-center">
                    <p className="text-2xl font-bold text-success">{traderStats.win_rate.toFixed(1)}%</p>
                    <p className="text-xs text-muted-foreground">Win rate</p>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/10 border border-secondary/20 text-center">
                    <p className="text-2xl font-bold text-secondary">{traderStats.total_score}</p>
                    <p className="text-xs text-muted-foreground">VeritasScore</p>
                  </div>
                </div>

                {/* Expandable Stats */}
                <button
                  onClick={() => setShowAllStats(!showAllStats)}
                  className="w-full flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground py-2 transition-colors"
                >
                  {showAllStats ? 'Show less' : 'Show more stats'}
                  {showAllStats ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>

                {showAllStats && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50 animate-in slide-in-from-top-2 duration-200">
                    <div className="p-2 rounded-lg bg-surface/50 text-center">
                      <p className="text-lg font-bold">{traderStats.total_bets}</p>
                      <p className="text-xs text-muted-foreground">Total bets</p>
                    </div>
                    <div className="p-2 rounded-lg bg-surface/50 text-center">
                      <p className="text-lg font-bold text-primary">{formatSTT(traderStats.total_volume)}</p>
                      <p className="text-xs text-muted-foreground">Volume (STT)</p>
                    </div>
                    <div className="p-2 rounded-lg bg-surface/50 text-center">
                      <p className="text-lg font-bold text-success">{traderStats.wins}</p>
                      <p className="text-xs text-muted-foreground">Wins</p>
                    </div>
                    <div className="p-2 rounded-lg bg-surface/50 text-center">
                      <p className="text-lg font-bold text-destructive">{traderStats.losses}</p>
                      <p className="text-xs text-muted-foreground">Losses</p>
                    </div>
                  </div>
                )}
              </div>

              <CardContent className="p-4 space-y-3">
                {/* Platforms */}
                <PlatformBadgeList platforms={traderStats.platforms} size="sm" max={5} />

                {/* Actions */}
                <div className="flex gap-2">
                  <Link href={`/profile/${traderStats.wallet_address}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                      Profile
                    </Button>
                  </Link>
                  {isConnected && userAddress?.toLowerCase() !== traderStats.wallet_address.toLowerCase() && (
                    <Button size="sm" className="flex-1" disabled={isFollowing}>
                      <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                      {isFollowing ? 'Following' : 'Copy'}
                    </Button>
                  )}
                </div>

                <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => { setActiveSearchAddress(undefined); setSearchInput(''); }}>
                  <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                  New search
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right: Bet History */}
          <div>
            <h3 className="font-semibold mb-4">Bet history</h3>
            <Tabs defaultValue="all">
              <TabsList className="w-full justify-start mb-4 h-9 bg-surface/50">
                <TabsTrigger value="all" className="text-xs">All ({bets.length})</TabsTrigger>
                <TabsTrigger value="wins" className="text-xs">Wins ({bets.filter(b => b.won === true).length})</TabsTrigger>
                <TabsTrigger value="losses" className="text-xs">Losses ({bets.filter(b => b.won === false).length})</TabsTrigger>
                <TabsTrigger value="pending" className="text-xs">Pending ({bets.filter(b => b.won === null).length})</TabsTrigger>
              </TabsList>

              {['all', 'wins', 'losses', 'pending'].map((tab) => {
                const filtered = bets.filter((b) => {
                  if (tab === 'all') return true;
                  if (tab === 'wins') return b.won === true;
                  if (tab === 'losses') return b.won === false;
                  return b.won === null;
                });

                return (
                  <TabsContent key={tab} value={tab} className="space-y-2 mt-0">
                    {filtered.length === 0 ? (
                      <div className="py-12 text-center text-muted-foreground border border-dashed border-border/50 rounded-xl">
                        <Activity className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">No bets in this category</p>
                      </div>
                    ) : (
                      filtered.map((bet) => (
                        <div key={bet.id} className="flex items-center justify-between p-3 rounded-lg bg-surface/30 border border-border/30 hover:bg-surface/50 transition-colors">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">{bet.position}</Badge>
                            <PlatformBadge platform={bet.platform} size="xs" />
                            {bet.won === true && <Badge className="bg-success text-xs">Won</Badge>}
                            {bet.won === false && <Badge className="bg-destructive text-xs">Lost</Badge>}
                            {bet.won === null && <Badge variant="outline" className="text-xs">Pending</Badge>}
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-sm font-medium">{formatSTT(bet.amount)} STT</p>
                            {bet.claimed_amount && (
                              <p className={`text-xs font-mono ${Number(calculateProfit(bet.amount, bet.claimed_amount, bet.won)) >= 0 ? 'text-success' : 'text-destructive'}`}>
                                {Number(calculateProfit(bet.amount, bet.claimed_amount, bet.won)) >= 0 ? '+' : ''}{calculateProfit(bet.amount, bet.claimed_amount, bet.won)}
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </TabsContent>
                );
              })}
            </Tabs>
          </div>
        </div>
      ) : (
        /* DISCOVERY VIEW - Dynamic layout */
        <div className="space-y-8">
          {/* Recent Searches */}
          {searchHistory.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <History className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-medium">Recent searches</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {searchHistory.map((addr) => (
                  <div key={addr} className="flex items-center gap-1 bg-surface rounded-lg px-3 py-1.5 border border-border/50 group">
                    <button onClick={() => { setSearchInput(addr); handleSearch(addr); }} className="text-xs font-mono hover:text-primary transition-colors">
                      {shortenAddress(addr)}
                    </button>
                    <button onClick={() => removeFromHistory(addr)} className="text-muted-foreground hover:text-destructive transition-colors ml-1 opacity-0 group-hover:opacity-100">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Featured + Grid Layout */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-secondary" />
                <h2 className="text-sm font-medium">Top performers</h2>
              </div>
              <Link href="/leaderboard">
                <Button variant="ghost" size="sm" className="text-xs h-7">View all <ArrowRight className="h-3 w-3 ml-1" /></Button>
              </Link>
            </div>

            {loadingDiscovery ? (
              <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr] gap-3">
                <Skeleton className="h-40 rounded-xl md:row-span-2" />
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-[72px] rounded-xl" />)}
              </div>
            ) : topTraders.length === 0 ? (
              <Card className="border-border/50"><CardContent className="py-12 text-center text-muted-foreground"><Users className="h-8 w-8 mx-auto mb-2 opacity-40" /><p className="text-sm">No traders found</p></CardContent></Card>
            ) : (
              /* Bento-style grid: Featured large card + smaller cards */
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {/* Featured #1 - Spans 2 rows on md+ */}
                {featuredTrader && (
                  <button
                    onClick={() => { setSearchInput(featuredTrader.wallet_address); handleSearch(featuredTrader.wallet_address); }}
                    className="col-span-2 md:col-span-1 md:row-span-2 p-4 sm:p-5 rounded-xl border border-border/50 bg-card hover:border-primary/30 hover:bg-surface-raised transition-all text-left group"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-full bg-secondary/20 text-secondary flex items-center justify-center font-bold">1</div>
                      <Badge className={`${TIER_COLORS[getTierFromScore(featuredTrader.veritas_score)]} text-white`}>{TIER_NAMES[getTierFromScore(featuredTrader.veritas_score)]}</Badge>
                    </div>
                    <p className="font-mono text-sm text-muted-foreground group-hover:text-foreground transition-colors mb-3">{shortenAddress(featuredTrader.wallet_address)}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="text-center p-2 rounded-lg bg-success/10 border border-success/20">
                        <p className="text-xl font-bold text-success">{featuredTrader.win_rate.toFixed(1)}%</p>
                        <p className="text-xs text-muted-foreground">Win rate</p>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-secondary/10 border border-secondary/20">
                        <p className="text-xl font-bold text-secondary">{featuredTrader.veritas_score}</p>
                        <p className="text-xs text-muted-foreground">Score</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">{featuredTrader.total_bets} total bets</p>
                  </button>
                )}

                {/* Other top traders - Compact cards */}
                {otherTopTraders.map((trader, i) => {
                  const tier = getTierFromScore(trader.veritas_score);
                  return (
                    <button
                      key={trader.wallet_address}
                      onClick={() => { setSearchInput(trader.wallet_address); handleSearch(trader.wallet_address); }}
                      className="p-3 rounded-xl border border-border/50 bg-card hover:border-primary/30 hover:bg-surface-raised transition-all text-left group"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-surface-raised text-xs flex items-center justify-center font-medium text-muted-foreground">{i + 2}</span>
                          <Badge className={`${TIER_COLORS[tier]} text-white text-[10px]`}>{TIER_NAMES[tier]}</Badge>
                        </div>
                        <span className="text-success text-sm font-medium">{trader.win_rate.toFixed(1)}%</span>
                      </div>
                      <p className="font-mono text-xs text-muted-foreground group-hover:text-foreground transition-colors">{shortenAddress(trader.wallet_address)}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Most Active - Horizontal scroll on mobile */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Flame className="h-4 w-4 text-warning" />
              <h2 className="text-sm font-medium">Most active</h2>
            </div>

            {loadingDiscovery ? (
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 md:grid-cols-4">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 min-w-[200px] sm:min-w-0 rounded-xl" />)}
              </div>
            ) : recentlyActive.length === 0 ? (
              <Card className="border-border/50"><CardContent className="py-6 text-center text-muted-foreground"><p className="text-sm">No active traders</p></CardContent></Card>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 md:grid-cols-4 snap-x snap-mandatory sm:snap-none">
                {recentlyActive.map((trader) => {
                  const tier = getTierFromScore(trader.veritas_score);
                  return (
                    <button
                      key={trader.wallet_address}
                      onClick={() => { setSearchInput(trader.wallet_address); handleSearch(trader.wallet_address); }}
                      className="min-w-[200px] sm:min-w-0 p-3 rounded-xl border border-border/50 bg-card hover:border-primary/30 hover:bg-surface-raised transition-all snap-center"
                    >
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-white text-xs font-medium">
                            {trader.wallet_address.slice(2, 4).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="font-mono text-xs truncate">{shortenAddress(trader.wallet_address)}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Badge className={`${TIER_COLORS[tier]} text-white text-[10px]`}>{TIER_NAMES[tier]}</Badge>
                            <span className="text-[10px] text-muted-foreground">{trader.total_bets} bets</span>
                          </div>
                        </div>
                        <p className="text-sm font-semibold text-success">{trader.win_rate.toFixed(0)}%</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Quick Links - Bottom cards */}
          <section className="grid grid-cols-2 gap-3">
            <Link href="/leaderboard" className="block">
              <Card className="border-border/50 hover:border-secondary/30 hover:bg-surface-raised transition-all h-full group">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center group-hover:bg-secondary/20 transition-colors">
                    <Trophy className="h-5 w-5 text-secondary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Leaderboard</p>
                    <p className="text-xs text-muted-foreground">View rankings</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/copy-trading" className="block">
              <Card className="border-border/50 hover:border-primary/30 hover:bg-surface-raised transition-all h-full group">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Copy trading</p>
                    <p className="text-xs text-muted-foreground">Follow traders</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </section>
        </div>
      )}
    </div>
  );
}
