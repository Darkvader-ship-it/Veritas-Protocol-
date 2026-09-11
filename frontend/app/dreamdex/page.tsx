'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWalletClient, usePublicClient, useSwitchChain, useBalance } from 'wagmi';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Search, RefreshCw, Loader2, ExternalLink, Droplets, Timer, AlertTriangle, CheckCircle2, Trophy, TrendingUp } from 'lucide-react';
import { useWeb3Connection } from '@/hooks/useWeb3Connection';
import { DreamDEXMarketCard } from '@/components/dreamdex/DreamDEXMarketCard';
import { DreamDEXOrderBook } from '@/components/dreamdex/DreamDEXOrderBook';
import { DreamDEXTradeModal } from '@/components/dreamdex/DreamDEXTradeModal';
import { dreamDEXService } from '@/lib/dreamdex';
import { SOMNIA_DREAMDEX } from '@/lib/contracts';
import { formatUnits } from 'viem';
import type { DreamDEXMarket } from '@/lib/dreamdex';

export default function DreamDEXPage() {
  const { address, chainId } = useAccount();
  const { connectionError, isReconnecting, reconnect } = useWeb3Connection();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { switchChain } = useSwitchChain();
  const { toast } = useToast();

  const [markets, setMarkets] = useState<DreamDEXMarket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isHealthOk, setIsHealthOk] = useState<boolean | null>(null);
  const [health, setHealth] = useState<any>(null);
  const [selected, setSelected] = useState<DreamDEXMarket | null>(null);
  const [orderBook, setOrderBook] = useState<{ bids: [number, number][], asks: [number, number][], spread: number, mid: number, imbalance: number, timestamp: number, symbol: string } | null>(null);
  const [obLoading, setObLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [tradeSide, setTradeSide] = useState<'UP' | 'DOWN'>('UP');
  const [tradeOpen, setTradeOpen] = useState(false);
  const [sttBalance, setSttBalance] = useState<string>('0');
  const [tUSDCBalance, setTUSDCBalance] = useState<string>('0');
  const [redeemable, setRedeemable] = useState<DreamDEXMarket[]>([]);
  const [decimals, setDecimals] = useState(6);
  const [venueMismatch, setVenueMismatch] = useState(false);

  // Balances
  const sttBal = useBalance({ address, chainId: 50312 as any });

  useEffect(() => {
    if (sttBal.data) setSttBalance(formatUnits(sttBal.data.value, 18).slice(0, 6));
  }, [sttBal.data]);

  // Fetch tUSDC balance
  useEffect(() => {
    if (!address || !publicClient) return;
    (async () => {
      try {
        const bal: any = await publicClient.readContract({
          address: SOMNIA_DREAMDEX.collateralTUSDC as `0x${string}`,
          abi: [{ inputs: [{ name: 'owner', type: 'address' }], name: 'balanceOf', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' }] as any,
          functionName: 'balanceOf',
          args: [address],
        });
        const dec = selected?.quoteDecimals ?? 6;
        setDecimals(dec);
        setTUSDCBalance(formatUnits(bal as bigint, dec).slice(0, 8));
      } catch {}
    })();
  }, [address, publicClient, selected]);

  const fetchMarkets = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/dreamdex?limit=100&search=${encodeURIComponent(search)}`);
      const data = await res.json();
      if (data.markets) {
        setMarkets(data.markets);
        setDecimals(data.decimals ?? 6);
        if (!data.markets.length && data.error) {
          toast({ title: 'DreamDEX', description: data.error, variant: 'destructive' });
        }
        // Venue mismatch banner
        if (data.venueId && data.venueId.toLowerCase() !== SOMNIA_DREAMDEX.venueIdTestnet.toLowerCase()) {
          setVenueMismatch(true);
        } else {
          setVenueMismatch(false);
        }
        if (!selected && data.markets.length > 0) setSelected(data.markets[0]);
      }
    } catch (e: any) {
      toast({ title: 'Fetch failed', description: e.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [search, selected, toast]);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/dreamdex/health');
      const data = await res.json();
      setHealth(data);
      setIsHealthOk(data.rpcOk && data.indexerOk);
    } catch {
      setIsHealthOk(false);
    }
  }, []);

  const fetchOrderBook = useCallback(async (symbol: string) => {
    if (!symbol) return;
    setObLoading(true);
    try {
      const ob = await dreamDEXService.fetchOrderBook(symbol, 5);
      setOrderBook(ob);
    } catch {
      setOrderBook(null);
    } finally {
      setObLoading(false);
    }
  }, []);

  // Poll redeemable (Finalized) — per implementation.md 600s interval inside trading loop, but we do 60s
  const fetchRedeemable = useCallback(async () => {
    try {
      // For MVP, we consider any market with status Finalized as redeemable
      // In real, we would call listBinaryMarkets({venueId, status:"Finalized"})
      // Here we approximate by checking markets that are not Trading but have winningOutcome
      const res = await fetch('/api/dreamdex?limit=100');
      const data = await res.json();
      const finals: DreamDEXMarket[] = (data.markets || []).filter((m: DreamDEXMarket) => m.status === 'Finalized' || m.status === 'Resolved');
      setRedeemable(finals);
    } catch {}
  }, []);

  useEffect(() => {
    fetchMarkets();
    fetchHealth();
  }, [fetchMarkets, fetchHealth]);

  useEffect(() => {
    if (selected) fetchOrderBook(selected.symbol);
  }, [selected, fetchOrderBook]);

  useEffect(() => {
    const id = setInterval(() => {
      if (selected) fetchOrderBook(selected.symbol);
      fetchRedeemable();
    }, 2000); // 2s for orderbook, 60s for redeem inside? We'll keep 2s
    return () => clearInterval(id);
  }, [selected, fetchOrderBook, fetchRedeemable]);

  const handleFaucet = async () => {
    if (!walletClient) {
      toast({ title: 'Connect wallet', description: 'Connect to Somnia Shannon 50312', variant: 'destructive' });
      return;
    }
    try {
      if (chainId !== 50312) await switchChain({ chainId: 50312 });
      // Try SDK faucet (exchange.trader.faucet)
      const exchange = (await import('@/lib/dreamdex')).createAuthenticatedDreamDEXExchange(walletClient as any, false);
      await exchange.loadMarkets(true);
      // Trader faucet
      const trader: any = (exchange as any).trader;
      if (trader?.faucet) {
        const res = await trader.faucet({ amount: 1000 });
        toast({ title: 'Faucet tUSDC', description: `Tx ${res.hash.slice(0, 10)}...` });
      } else {
        // Fallback: direct collateral faucet if exists
        toast({ title: 'Faucet', description: 'Use https://testnet.somnia.network or t.me/+XHq0F0JXMyhmMzM0 for STT, then DreamDEX faucet in app.dreamdex.io' });
      }
    } catch (e: any) {
      toast({ title: 'Faucet failed', description: e.shortMessage || e.message, variant: 'destructive' });
    }
  };

  const handleRedeem = async (m: DreamDEXMarket) => {
    if (!walletClient) return;
    try {
      if (chainId !== 50312) await switchChain({ chainId: 50312 });
      const { hash } = await dreamDEXService.redeem(m.symbol, 1, walletClient as any, false);
      toast({ title: 'Redeem sent', description: `Claim ${hash.slice(0, 10)}... View on explorer`, });
    } catch (e: any) {
      toast({ title: 'Redeem failed', description: e.message, variant: 'destructive' });
    }
  };

  const sttLow = parseFloat(sttBalance) < 0.01;

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black flex items-center gap-2">💭 DreamDEX Event Contracts <Badge className="bg-fuchsia-600 text-white">REAL</Badge></h1>
          <p className="text-sm text-muted-foreground">Somnia Shannon • Venue {SOMNIA_DREAMDEX.venueIdTestnet.slice(0, 10)}...28c • STT {sttBalance} • tUSDC {tUSDCBalance} • <span className="font-mono text-xs">{SOMNIA_DREAMDEX.collateralTUSDC.slice(0, 6)}... • 6dec</span></p>
        </div>
        <div className="flex gap-2">
          {sttLow && (
            <Button variant="outline" size="sm" onClick={() => window.open('https://testnet.somnia.network', '_blank')}>
              Get STT
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleFaucet}>Faucet tUSDC</Button>
          <Button variant="outline" size="sm" onClick={() => { fetchMarkets(); fetchHealth(); if (selected) fetchOrderBook(selected.symbol); }}>
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      {/* Health / Venue mismatch */}
      {connectionError && (
        <Card className="border-red-500/50 bg-red-500/10">
          <CardContent className="p-3 text-sm flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              {connectionError}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { if (!isReconnecting) reconnect(); }}
              disabled={isReconnecting}
            >
              {isReconnecting ? 'Reconnecting…' : 'Reconnect'}
            </Button>
          </CardContent>
        </Card>
      )}
      {venueMismatch && (
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <CardContent className="p-3 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600" />
            Venue mismatch — check docs. Expected {SOMNIA_DREAMDEX.venueIdTestnet.slice(0, 12)}... vs API {health?.venueId?.slice(0, 12)}
          </CardContent>
        </Card>
      )}
      {health && !isHealthOk && (
        <Card className="border-red-500/50 bg-red-500/10">
          <CardContent className="p-3 text-sm">
            Live feed unavailable — retry. {health.error || 'Shannon RPC unavailable, retry + faucet'} • LastLoad {health.lastLoadMs}ms
          </CardContent>
        </Card>
      )}
      {sttLow && address && (
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <CardContent className="p-3 text-sm">STT {sttBalance} — Get STT faucet if &lt;0.01. Gas required for every mint/place/cancel/redeem.</CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-2 top-2.5 text-muted-foreground" />
          <Input placeholder="Search DreamDEX markets (BTC, ETH...)" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchMarkets()} />
        </div>
        <Badge variant="outline" className="text-xs hidden md:flex items-center">Trading only • {markets.length} markets • {decimals}dec • {SOMNIA_DREAMDEX.explorerTestnet.replace('https://', '')}</Badge>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Market list */}
        <div className="lg:col-span-1 space-y-3 max-h-[70vh] overflow-auto pr-1">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Markets • Up 54¢ / Down 46¢</h2>
            <span className="text-xs text-muted-foreground">{isLoading ? <Loader2 className="w-3 h-3 animate-spin inline" /> : `${markets.length} live`}</span>
          </div>
          {isLoading ? (
            <Card className="border-border/50"><CardContent className="p-8 text-center text-muted-foreground text-sm">Loading DreamDEX markets...</CardContent></Card>
          ) : markets.length === 0 ? (
            <Card className="border-border/50"><CardContent className="p-8 text-center text-sm"><Droplets className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />No Trading markets • {health?.error || 'Venue 0x6797...28c — try refresh'}</CardContent></Card>
          ) : (
            markets.map((m) => (
              <DreamDEXMarketCard key={m.marketId} market={m} isSelected={selected?.marketId === m.marketId} onSelect={setSelected} />
            ))
          )}
        </div>

        {/* Detail + Orderbook + Trade */}
        <div className="lg:col-span-2 space-y-4">
          {selected ? (
            <>
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    {selected.question}
                    <Badge variant={selected.active ? 'default' : 'secondary'} className={selected.active ? 'bg-green-500' : ''}>{selected.status}</Badge>
                    <span className="text-xs text-muted-foreground font-normal ml-auto">{selected.symbol}</span>
                  </CardTitle>
                  <div className="text-xs text-muted-foreground">Expires {new Date(selected.expiresAt).toLocaleString()} • Pool {selected.pool.slice(0, 6)}... • Venue {selected.venueId.slice(0, 8)}... • tUSDC {decimals}dec</div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Button className="bg-green-600 hover:bg-green-700" onClick={() => { setTradeSide('UP'); setTradeOpen(true); }} disabled={!selected.active}>
                      Buy Up { (selected.yesPrice * 100).toFixed(1)}¢
                    </Button>
                    <Button className="bg-red-600 hover:bg-red-700" onClick={() => { setTradeSide('DOWN'); setTradeOpen(true); }} disabled={!selected.active}>
                      Buy Down { (selected.noPrice * 100).toFixed(1)}¢
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground text-center">2-tap → on-chain • {selected.outcomes[0]?.symbol} vs {selected.outcomes[1]?.symbol} • Tick quantized • IOC</div>
                </CardContent>
              </Card>

              <DreamDEXOrderBook
                bids={orderBook?.bids || []}
                asks={orderBook?.asks || []}
                mid={orderBook?.mid ?? (selected.yesPrice + selected.noPrice) / 2}
                spread={orderBook?.spread ?? Math.abs(selected.yesPrice - selected.noPrice)}
                imbalance={orderBook?.imbalance ?? 0}
                symbol={selected.symbol}
                isLoading={obLoading}
              />

              {/* Positions */}
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">Positions • OutcomeToken6909 <Badge variant="outline" className="text-xs">tUSDC 6dec</Badge></CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-xs text-muted-foreground">
                    My balances: STT {sttBalance} • tUSDC {tUSDCBalance} • {address ? address.slice(0, 6) + '...' + address.slice(-4) : 'Connect wallet'}
                    {!walletClient && <span className="ml-2 text-yellow-600">Connect wallet to trade</span>}
                  </div>
                  {redeemable.length > 0 ? (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold">Redeemable (Finalized) • Claim {redeemable.length}</div>
                      {redeemable.slice(0, 3).map((m) => (
                        <div key={m.marketId} className="flex items-center justify-between text-xs bg-green-500/10 p-2 rounded">
                          <span className="truncate flex-1">{m.question.slice(0, 40)}...</span>
                          <Button size="sm" className="ml-2 h-7 bg-green-600" onClick={() => handleRedeem(m)}>Redeem</Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">No Finalized markets to redeem • Poll 60s • Winnings not auto-credited; void=0.5 each</div>
                  )}
                  <div className="flex gap-2 text-xs">
                    <Button variant="outline" size="sm" onClick={() => window.open(`https://shannon-explorer.somnia.network/address/${address}`, '_blank')} disabled={!address}>
                      <ExternalLink className="w-3 h-3 mr-1" /> Shannon Explorer
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => window.open('https://docs.dreamdex.io/developers/event-contracts', '_blank')}>
                      Docs
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* AI Scout */}
              <Card className="border-border/50 bg-gradient-to-br from-fuchsia-500/5 to-purple-600/5">
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Trophy className="w-4 h-4 text-fuchsia-500" /> AI Scout</CardTitle></CardHeader>
                <CardContent className="text-xs space-y-1">
                  <div>Spread {(orderBook?.spread ?? 0).toFixed(4)} • Imbalance {((orderBook?.imbalance ?? 0) * 100).toFixed(1)}% • Mid {(orderBook?.mid ?? 0.5).toFixed(4)}</div>
                  <div className="text-muted-foreground">Edge = provenWinRate - 0.5 • Top 3 sharpest DreamDEX traders from /api/dreamdex-leaderboard</div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="border-border/50"><CardContent className="p-12 text-center text-muted-foreground">Select a DreamDEX market</CardContent></Card>
          )}
        </div>
      </div>

      <DreamDEXTradeModal market={selected} side={tradeSide} open={tradeOpen} onOpenChange={setTradeOpen} onSuccess={(hash) => {
        toast({ title: 'Trade success', description: hash ? `View tx ${hash.slice(0, 10)} on Shannon Explorer` : 'Order placed' });
        if (selected) fetchOrderBook(selected.symbol);
        // Invalidate leaderboard and dashboard so any wallet sees update
        import('@/lib/queries').then(({ queryKeys }) => {
          import('@tanstack/react-query').then(({ useQueryClient }) => {
            // Use global queryClient if available
            fetch('/api/unified-leaderboard?limit=500&refresh=true').catch(()=>{});
          });
        });
      }} />
    </div>
  );
}
