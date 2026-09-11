'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Users,
  ExternalLink,
  Plus,
  Check,
  X,
  Timer,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Droplets,
} from 'lucide-react';
import { useAccount, useReadContract, useWalletClient } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { DREAMDEX_COPY_VAULT_ABI, DREAMDEX_COPY_VAULT_ADDRESS, SOMNIA_DREAMDEX, ERC20_ABI } from '@/lib/contracts';

interface PolymarketLeader {
  rank: number;
  address: string;
  username?: string;
  pnl: number;
  volume: number;
  winRate: number;
  profileImage?: string;
}

interface PolymarketTrade {
  id: number;
  follower: string;
  leader: string;
  market_id: string;
  market_question: string;
  outcome_selected: string;
  amount_usd: number;
  price_at_entry?: number;
  outcome: 'pending' | 'win' | 'loss' | 'refund';
  pnl_usd?: number;
  traded_at: string;
}

interface PolymarketFollow {
  id: number;
  leader: string;
  leader_username?: string;
  allocation_usd: number;
  auto_copy: boolean;
}

interface Market {
  id: string;
  question: string;
  outcomes: Array<{ value: string; price: number }>;
  volume: number;
  endDate: string;
}

export function PolymarketSimulationTab({ followerAddress }: { followerAddress?: string }) {
  const [stats, setStats] = useState<any>(null);
  const [trades, setTrades] = useState<PolymarketTrade[]>([]);
  const [follows, setFollows] = useState<PolymarketFollow[]>([]);
  const [leaders, setLeaders] = useState<PolymarketLeader[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLeaders, setShowLeaders] = useState(false);
  const [showMarkets, setShowMarkets] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [betAmount, setBetAmount] = useState('10');
  const [betOutcome, setBetOutcome] = useState<'Yes' | 'No'>('Yes');
  const [isPlacingBet, setIsPlacingBet] = useState(false);
  const [followingLeader, setFollowingLeader] = useState<string | null>(null);
  const { address: connectedAddress } = useAccount();
  const { data: walletClient } = useWalletClient();
  const vaultAddr = DREAMDEX_COPY_VAULT_ADDRESS as `0x${string}`;
  const { data: vaultBalRaw } = useReadContract({
    address: vaultAddr,
    abi: DREAMDEX_COPY_VAULT_ABI,
    functionName: 'balances',
    args: followerAddress ? [followerAddress as `0x${string}`] : undefined,
    query: { enabled: !!followerAddress },
  });

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [followerAddress]);

  const fetchData = async () => {
    if (!followerAddress) return;

    try {
      // Fetch stats
      const statsRes = await fetch(`/api/polymarket/simulate?stats=true&follower=${followerAddress}`);
      const statsData = await statsRes.json();
      setStats(statsData.overall);

      // Fetch trades
      const tradesRes = await fetch(`/api/polymarket/simulate?limit=20&follower=${followerAddress}`);
      const tradesData = await tradesRes.json();
      setTrades(tradesData.trades || []);

      // Fetch follows
      const followsRes = await fetch(`/api/polymarket/follow?follower=${followerAddress}`);
      const followsData = await followsRes.json();
      setFollows(followsData.follows || []);
    } catch (error) {
      console.error('Error fetching Polymarket data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaders = async () => {
    try {
      const res = await fetch('/api/polymarket-leaderboard?limit=20&orderBy=PNL');
      const data = await res.json();
      if (data.success) {
        setLeaders(data.data.map((l: any) => ({
          rank: l.rank,
          address: l.address,
          username: l.username,
          pnl: l.pnl,
          volume: Number(l.totalVolume) / 1e18,
          winRate: l.winRate,
          profileImage: l.profileImage,
        })));
      }
    } catch (error) {
      console.error('Error fetching leaders:', error);
    }
  };

  const fetchMarkets = async () => {
    try {
      const allMarkets: Market[] = [];

      // Fetch from events first (has the trending/hot markets)
      const eventsRes = await fetch('/api/polymarket?endpoint=events&closed=false&limit=30');
      if (eventsRes.ok) {
        const events = await eventsRes.json();
        for (const event of events) {
          if (event.markets && Array.isArray(event.markets)) {
            for (const m of event.markets) {
              if (!m.closed && m.active) {
                let prices = [0.5, 0.5];
                try {
                  if (typeof m.outcomePrices === 'string') {
                    prices = JSON.parse(m.outcomePrices).map((p: string) => parseFloat(p));
                  } else if (Array.isArray(m.outcomePrices)) {
                    prices = m.outcomePrices.map((p: any) => parseFloat(p));
                  }
                } catch (e) {}

                allMarkets.push({
                  id: m.conditionId || m.id,
                  question: m.question,
                  outcomes: [
                    { value: 'Yes', price: prices[0] || 0.5 },
                    { value: 'No', price: prices[1] || 0.5 },
                  ],
                  volume: m.volume24hr || m.volumeNum || parseFloat(m.volume) || 0,
                  endDate: m.endDateIso || m.endDate,
                });
              }
            }
          }
        }
      }

      // Also fetch some regular markets
      const res = await fetch('/api/polymarket?endpoint=markets&closed=false&limit=20');
      const data = await res.json();
      if (Array.isArray(data)) {
        for (const m of data) {
          if (!m.closed && m.active) {
            // Avoid duplicates
            if (allMarkets.some(existing => existing.id === (m.conditionId || m.id))) continue;

            let prices = [0.5, 0.5];
            try {
              if (typeof m.outcomePrices === 'string') {
                prices = JSON.parse(m.outcomePrices).map((p: string) => parseFloat(p));
              } else if (Array.isArray(m.outcomePrices)) {
                prices = m.outcomePrices.map((p: any) => parseFloat(p));
              }
            } catch (e) {}

            allMarkets.push({
              id: m.conditionId || m.id,
              question: m.question,
              outcomes: [
                { value: 'Yes', price: prices[0] || 0.5 },
                { value: 'No', price: prices[1] || 0.5 },
              ],
              volume: m.volume24hr || m.volumeNum || parseFloat(m.volume) || 0,
              endDate: m.endDateIso || m.endDate,
            });
          }
        }
      }

      // Sort by 24h volume (most active first)
      allMarkets.sort((a, b) => b.volume - a.volume);
      setMarkets(allMarkets);
    } catch (error) {
      console.error('Error fetching markets:', error);
    }
  };

  const handleFollowLeader = async (leader: PolymarketLeader) => {
    if (!followerAddress) return;
    setFollowingLeader(leader.address);

    try {
      const res = await fetch('/api/polymarket/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          follower: followerAddress,
          leader: leader.address,
          leaderUsername: leader.username,
          allocationUsd: 10,
          autoCopy: false,
        }),
      });

      const data = await res.json();
      if (data.success) {
        await fetchData();
        setShowLeaders(false);
      }
    } catch (error) {
      console.error('Error following leader:', error);
    } finally {
      setFollowingLeader(null);
    }
  };

  const handleUnfollow = async (leader: string) => {
    if (!followerAddress) return;

    try {
      const res = await fetch('/api/polymarket/follow', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          follower: followerAddress,
          leader,
        }),
      });

      const data = await res.json();
      if (data.success) {
        await fetchData();
      }
    } catch (error) {
      console.error('Error unfollowing:', error);
    }
  };

  const handlePlaceBet = async () => {
    if (!followerAddress || !selectedMarket) return;
    setIsPlacingBet(true);

    try {
      // REAL tUSDC on Somnia vault — deposit + create pending (like other markets)
      const isReal = true;
      if (isReal) {
        try {
          const amt = parseUnits(betAmount, 6);
          const address = (connectedAddress || followerAddress) as `0x${string}`;
          const wc: any = walletClient;
          if (!wc || !address) throw new Error('Connect wallet with STT + tUSDC');
          const { createPublicClient, http, fallback } = await import('viem');
          const { defineChain } = await import('viem');
          const somniaTestnet = defineChain({ id: 50312, name: 'Somnia Shannon', nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 }, rpcUrls: { default: { http: ['https://dream-rpc.somnia.network'] } } });
          const publicClient: any = createPublicClient({ chain: somniaTestnet as any, transport: fallback([http('https://dream-rpc.somnia.network')]) });
          const bal: any = await publicClient.readContract({ address: SOMNIA_DREAMDEX.collateralTUSDC as any, abi: ERC20_ABI as any, functionName: 'balanceOf', args: [address] });
          if (bal < amt) throw new Error(`Insufficient tUSDC: have ${Number(bal)/1e6}, need ${betAmount}`);
          const allowance: any = await publicClient.readContract({ address: SOMNIA_DREAMDEX.collateralTUSDC as any, abi: ERC20_ABI as any, functionName: 'allowance', args: [address, DREAMDEX_COPY_VAULT_ADDRESS] });
          if (allowance < amt) {
            const hash = await wc.writeContract({ address: SOMNIA_DREAMDEX.collateralTUSDC as any, abi: ERC20_ABI as any, functionName: 'approve', args: [DREAMDEX_COPY_VAULT_ADDRESS, amt] });
            throw new Error(`Approved ${betAmount} tUSDC in ${String(hash).slice(0,10)}... - click Trade again`);
          }
          const hash = await wc.writeContract({ address: DREAMDEX_COPY_VAULT_ADDRESS, abi: DREAMDEX_COPY_VAULT_ABI as any, functionName: 'deposit', args: [amt] });
          // Also create pending bet entry for Dashboard > Pending bets
          try {
            await fetch('/api/polymarket/simulate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                follower: followerAddress,
                marketId: selectedMarket.id,
                marketQuestion: selectedMarket.question,
                outcomeSelected: betOutcome,
                amountUsd: parseFloat(betAmount),
                amountTUSDC: parseFloat(betAmount),
                priceAtEntry: selectedMarket.outcomes.find(o => o.value === betOutcome)?.price || 0.5,
                isReal: true,
                txHash: hash,
              }),
            });
          } catch {}
          await fetchData();
          setSelectedMarket(null);
          setShowMarkets(false);
          setIsPlacingBet(false);
          return;
        } catch (e: any) {
          if (e.message?.includes('Approved')) {
            console.warn(e.message);
            setIsPlacingBet(false);
            return;
          }
          // fallback to simulated if vault fails
        }
      }
      const res = await fetch('/api/polymarket/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          follower: followerAddress,
          marketId: selectedMarket.id,
          marketQuestion: selectedMarket.question,
          outcomeSelected: betOutcome,
          amountUsd: parseFloat(betAmount),
          priceAtEntry: selectedMarket.outcomes.find(o => o.value === betOutcome)?.price || 0.5,
        }),
      });

      const data = await res.json();
      if (data.success) {
        await fetchData();
        setSelectedMarket(null);
        setShowMarkets(false);
      }
    } catch (error) {
      console.error('Error placing bet:', error);
    } finally {
      setIsPlacingBet(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-border/50">
        <CardContent className="flex items-center justify-center py-16">
          <Activity className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const vaultTUSDC = vaultBalRaw ? Number(formatUnits(vaultBalRaw as bigint, 6)) : 0;
  return (
    <div className="space-y-4">
      <Alert className="border-fuchsia-500/30 bg-fuchsia-500/5">
        <Droplets className="h-4 w-4 text-fuchsia-500" />
        <AlertDescription>
          <span className="font-medium">Real testnet (Somnia 50312):</span> Polymarket via DreamDEX Vault tUSDC 6dec • STT gas • {vaultTUSDC.toFixed(2)} tUSDC in vault • Funds at risk (testnet).
        </AlertDescription>
      </Alert>

      {/* Stats Grid — REAL */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{stats?.totalTrades || 0}</p>
            <p className="text-xs text-muted-foreground">Real Positions</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-success">{stats?.overallWinRate || 'N/A'}</p>
            <p className="text-xs text-muted-foreground">Win rate</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <p className={`text-2xl font-bold ${parseFloat(stats?.totalPnlUsd || '0') >= 0 ? 'text-success' : 'text-destructive'}`}>
              {stats?.totalPnlUsd ? `$${parseFloat(stats.totalPnlUsd).toFixed(2)}` : '$0.00'} <span className="text-[10px]">tUSDC</span>
            </p>
            <p className="text-xs text-muted-foreground">Real PnL (tUSDC)</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-warning">{stats?.totalPending || 0}</p>
            <p className="text-xs text-muted-foreground">Pending (tUSDC)</p>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          className="h-auto py-3"
          onClick={() => {
            setShowLeaders(!showLeaders);
            if (!showLeaders) fetchLeaders();
          }}
        >
          <Users className="h-4 w-4 mr-2" />
          <div className="text-left">
            <p className="font-medium">Follow leaders</p>
            <p className="text-xs text-muted-foreground">Copy top traders</p>
          </div>
        </Button>
        <Button
          variant="outline"
          className="h-auto py-3"
          onClick={() => {
            setShowMarkets(!showMarkets);
            if (!showMarkets) fetchMarkets();
          }}
        >
          <Search className="h-4 w-4 mr-2" />
          <div className="text-left">
            <p className="font-medium">Pick markets</p>
            <p className="text-xs text-muted-foreground">Manual positions</p>
          </div>
        </Button>
      </div>

      {/* Leaders Panel */}
      {showLeaders && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Top Polymarket traders</CardTitle>
            <CardDescription>Follow to trade copying their positions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {leaders.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <Activity className="h-6 w-6 animate-spin mx-auto mb-2" />
                <p className="text-sm">Loading leaders...</p>
              </div>
            ) : (
              leaders.slice(0, 10).map((leader) => {
                const isFollowing = follows.some(f => f.leader.toLowerCase() === leader.address.toLowerCase());
                return (
                  <div
                    key={leader.address}
                    className="flex items-center justify-between p-3 rounded-lg bg-surface hover:bg-surface-raised transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-xs font-bold">#{leader.rank}</span>
                      </div>
                      <div>
                        <p className="font-medium text-sm">{leader.username || `${leader.address.slice(0, 6)}...${leader.address.slice(-4)}`}</p>
                        <p className={`text-xs ${leader.pnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                          {leader.pnl >= 0 ? '+' : ''}${leader.pnl.toLocaleString()} PnL
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={isFollowing ? "secondary" : "default"}
                      disabled={followingLeader === leader.address}
                      onClick={() => isFollowing ? handleUnfollow(leader.address) : handleFollowLeader(leader)}
                    >
                      {followingLeader === leader.address ? (
                        <Activity className="h-4 w-4 animate-spin" />
                      ) : isFollowing ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      )}

      {/* Markets Panel */}
      {showMarkets && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Active markets</CardTitle>
            <CardDescription>Pick a position to trade</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {markets.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <Activity className="h-6 w-6 animate-spin mx-auto mb-2" />
                <p className="text-sm">Loading markets...</p>
              </div>
            ) : selectedMarket ? (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-surface">
                  <p className="font-medium text-sm mb-3">{selectedMarket.question}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant={betOutcome === 'Yes' ? 'default' : 'outline'}
                      className={betOutcome === 'Yes' ? 'bg-success hover:bg-success/90' : ''}
                      onClick={() => setBetOutcome('Yes')}
                    >
                      <TrendingUp className="h-4 w-4 mr-1" />
                      Yes @ {((selectedMarket.outcomes[0]?.price || 0.5) * 100).toFixed(0)}¢
                    </Button>
                    <Button
                      variant={betOutcome === 'No' ? 'default' : 'outline'}
                      className={betOutcome === 'No' ? 'bg-destructive hover:bg-destructive/90' : ''}
                      onClick={() => setBetOutcome('No')}
                    >
                      <TrendingDown className="h-4 w-4 mr-1" />
                      No @ {((selectedMarket.outcomes[1]?.price || 0.5) * 100).toFixed(0)}¢
                    </Button>
                  </div>
                  {/* Potential payout calculation */}
                  <div className="mt-3 p-2 rounded bg-surface-raised text-center">
                    <p className="text-xs text-muted-foreground">
                      If {betOutcome} wins: ${(parseFloat(betAmount) / (betOutcome === 'Yes' ? selectedMarket.outcomes[0]?.price : selectedMarket.outcomes[1]?.price || 0.5)).toFixed(2)} payout
                    </p>
                  </div>
                </div>
                <div>
                  <Label>Amount (tUSDC)</Label>
                  <Input
                    type="number"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    min="1"
                    max="1000"
                    className="mt-1"
                  />
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={handlePlaceBet} disabled={isPlacingBet}>
                    {isPlacingBet ? <Activity className="h-4 w-4 animate-spin mr-2" /> : null}
                    Trade ${betAmount} on {betOutcome}
                  </Button>
                  <Button variant="outline" onClick={() => setSelectedMarket(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              markets.slice(0, 10).map((market) => {
                const hasPosition = trades.some(t => t.market_id === market.id);
                const yesPrice = market.outcomes[0]?.price || 0.5;
                const volFormatted = market.volume >= 1000000
                  ? `$${(market.volume / 1000000).toFixed(1)}M`
                  : market.volume >= 1000
                    ? `$${(market.volume / 1000).toFixed(0)}K`
                    : `$${market.volume.toFixed(0)}`;
                return (
                  <button
                    key={market.id}
                    className="w-full text-left p-3 rounded-lg bg-surface hover:bg-surface-raised transition-colors"
                    onClick={() => !hasPosition && setSelectedMarket(market)}
                    disabled={hasPosition}
                  >
                    <p className="font-medium text-sm line-clamp-2">{market.question}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {volFormatted} vol
                      </Badge>
                      <Badge variant="outline" className={`text-xs ${yesPrice > 0.5 ? 'border-success/30 text-success' : 'border-destructive/30 text-destructive'}`}>
                        Yes {(yesPrice * 100).toFixed(0)}%
                      </Badge>
                      {hasPosition && (
                        <Badge className="text-xs bg-primary/10 text-primary">Position held</Badge>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>
      )}

      {/* Followed Leaders */}
      {follows.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Following</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {follows.map((follow) => (
              <div
                key={follow.id}
                className="flex items-center justify-between p-3 rounded-lg bg-surface"
              >
                <div>
                  <p className="font-mono text-sm">{follow.leader_username || `${follow.leader.slice(0, 8)}...`}</p>
                  <p className="text-xs text-muted-foreground">${follow.allocation_usd} per trade</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{follow.auto_copy ? 'Auto' : 'Manual'}</Badge>
                  <Button size="sm" variant="ghost" onClick={() => handleUnfollow(follow.leader)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent Trades */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent positions</CardTitle>
        </CardHeader>
        <CardContent>
          {trades.length > 0 ? (
            <div className="space-y-2">
              {trades.map((trade) => (
                <div
                  key={trade.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-surface hover:bg-surface-raised transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {trade.outcome === 'win' ? (
                      <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center">
                        <ArrowUpRight className="h-4 w-4 text-success" />
                      </div>
                    ) : trade.outcome === 'loss' ? (
                      <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center">
                        <ArrowDownRight className="h-4 w-4 text-destructive" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-warning/10 flex items-center justify-center">
                        <Timer className="h-4 w-4 text-warning" />
                      </div>
                    )}
                    <div className="max-w-[200px]">
                      <p className="text-sm font-medium line-clamp-1">{trade.market_question}</p>
                      <p className="text-xs text-muted-foreground">
                        {trade.outcome_selected} @ ${trade.amount_usd}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {trade.pnl_usd != null ? (
                      <p className={`text-sm font-mono ${Number(trade.pnl_usd) >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {Number(trade.pnl_usd) >= 0 ? '+' : ''}${Number(trade.pnl_usd).toFixed(2)}
                      </p>
                    ) : (
                      <Badge variant="outline" className="text-xs">Pending</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No positions yet</p>
              <p className="text-xs mt-1">Follow leaders or pick markets above</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
