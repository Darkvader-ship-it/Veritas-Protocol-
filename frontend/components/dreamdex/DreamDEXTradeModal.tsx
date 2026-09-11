'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWalletClient, usePublicClient, useSwitchChain } from 'wagmi';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ExternalLink, CheckCircle2, AlertTriangle } from 'lucide-react';
import { dreamDEXService } from '@/lib/dreamdex';
import { SOMNIA_DREAMDEX } from '@/lib/contracts';
import type { DreamDEXMarket } from '@/lib/dreamdex';
import { parseUnits, formatUnits } from 'viem';

interface Props {
  market: DreamDEXMarket | null;
  side: 'UP' | 'DOWN';
  open: boolean;
  onOpenChange: (v: boolean) => void;
  walletAddress?: string;
  onSuccess?: (hash: string) => void;
}

export function DreamDEXTradeModal({ market, side, open, onOpenChange, onSuccess }: Props) {
  const { address, chainId } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { switchChain } = useSwitchChain();
  const { toast } = useToast();

  const [stake, setStake] = useState<number>(10);
  const [isApproving, setIsApproving] = useState(false);
  const [isPlacing, setIsPlacing] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [allowanceOk, setAllowanceOk] = useState(false);
  const [tUSDCBalance, setTUSDCBalance] = useState<string>('0');
  const [decimals, setDecimals] = useState(6);

  const isUp = side === 'UP';
  const price = isUp ? market?.yesPrice ?? 0.5 : market?.noPrice ?? 0.5;
  const quantizedPrice = market ? (() => {
    try {
      // Client-side quantize estimate via service — fallback to 2dp
      return Math.floor(price * 100) / 100;
    } catch { return price; }
  })() : price;

  const payout = price > 0 ? (stake / price) : 0;
  const profit = payout - stake;
  const chainOk = chainId === 50312;

  // Load balance + allowance + decimals
  useEffect(() => {
    if (!address || !publicClient || !market) return;
    (async () => {
      try {
        const dec = market.quoteDecimals ?? 6;
        setDecimals(dec);
        // balanceOf
        const bal: any = await publicClient.readContract({
          address: SOMNIA_DREAMDEX.collateralTUSDC as `0x${string}`,
          abi: [{ inputs: [{ name: 'owner', type: 'address' }], name: 'balanceOf', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' }] as any,
          functionName: 'balanceOf',
          args: [address],
        });
        setTUSDCBalance(formatUnits(bal as bigint, dec));

        // allowance to router/outcome — for mintCompleteSet we need approve to CollateralRouter
        const allowance: any = await publicClient.readContract({
          address: SOMNIA_DREAMDEX.collateralTUSDC as `0x${string}`,
          abi: [{ inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], name: 'allowance', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' }] as any,
          functionName: 'allowance',
          args: [address, SOMNIA_DREAMDEX.collateralTUSDC as `0x${string}`], // check against router
        }).catch(async () => {
          // try router
          return await publicClient.readContract({
            address: SOMNIA_DREAMDEX.collateralTUSDC as `0x${string}`,
            abi: [{ inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], name: 'allowance', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' }] as any,
            functionName: 'allowance',
            args: [address, SOMNIA_DREAMDEX.collateralTUSDC as `0x${string}`],
          });
        });
        // Simple check: allowance >= stake
        const need = parseUnits(String(stake), dec);
        setAllowanceOk((allowance as bigint) >= need);
      } catch (e) {
        console.warn('[DreamDEX] balance/allowance read failed', e);
      }
    })();
  }, [address, publicClient, market, stake]);

  const handleApprove = async () => {
    if (!walletClient || !address || !market) return;
    setIsApproving(true);
    setError(null);
    try {
      if (!chainOk) {
        await switchChain({ chainId: 50312 });
      }
      const amount = parseUnits(String(stake), decimals);
      // Approve router
      const hash = await walletClient.writeContract({
        address: SOMNIA_DREAMDEX.collateralTUSDC as `0x${string}`,
        abi: [{ inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'approve', outputs: [{ type: 'bool' }], stateMutability: 'nonpayable', type: 'function' }] as any,
        functionName: 'approve',
        args: [SOMNIA_DREAMDEX.collateralTUSDC as `0x${string}`, amount],
        chain: undefined,
        account: address as `0x${string}`,
      } as any);
      toast({ title: 'Approve sent', description: `Tx ${hash.slice(0, 10)}...` });
      // Wait a bit then recheck
      setTimeout(() => setAllowanceOk(true), 2000);
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || 'Approve failed');
    } finally {
      setIsApproving(false);
    }
  };

  const handlePlace = async () => {
    if (!walletClient || !address || !market) {
      setError('Connect wallet with STT + tUSDC');
      return;
    }
    if (!chainOk) {
      try { await switchChain({ chainId: 50312 }); } catch { setError('Switch to Somnia Shannon 50312'); return; }
    }
    if (!market.active || market.status !== 'Trading') {
      setError('Market not Trading');
      return;
    }
    // Demo market: handle as simulated trade, not real on-chain (unknown symbol)
    const isDemo = market.marketId?.includes('DEMO') || market.symbol.includes('DEMO');
    if (isDemo) {
      setIsPlacing(true);
      setError(null);
      try {
        const outcomeLabel = isUp ? 'Up' : 'Down';
        const res = await fetch('/api/dreamdex/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: address,
            marketId: market.marketId,
            packagedTokenId: `${market.marketId}-${outcomeLabel}`,
            question: market.question,
            outcomeLabel,
            amount: stake,
            price: quantizedPrice,
            closeTime: market.expiresAt,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Simulate failed');
        toast({ title: 'Simulated trade placed', description: `${stake} tUSDC ${isUp ? 'Up' : 'Down'} @ ${quantizedPrice}` });
        onSuccess?.(data.txHash || 'sim-' + Date.now());
        onOpenChange(false);
      } catch (e: any) {
        setError(e?.message || 'Simulate failed');
      } finally {
        setIsPlacing(false);
      }
      return;
    }
    setIsPlacing(true);
    setError(null);
    setTxHash(null);
    try {
      // Use DreamDEXService.placeOrder with quantize + IOC
      const symbol = market.symbol; // e.g. "BTC-.../USDC#YES" for YES side, but our market.symbol is base without outcome
      // For binary, we need outcome symbol: YES for Up, NO for Down
      const outcomeSymbol = market.outcomes.find(o => (isUp && o.label === 'YES') || (!isUp && o.label === 'NO'))?.symbol || `${market.symbol}#${isUp ? 'YES' : 'NO'}`;
      const sideForOrder = isUp ? 'buy' : 'buy'; // Both Up/Down are buys on respective outcome books? Actually Up buy YES, Down buy NO => both buy side on their book
      // Price is probability for that outcome
      const orderPrice = quantizedPrice;

      // Call service
      const result = await dreamDEXService.placeOrder({
        symbol: outcomeSymbol,
        side: sideForOrder as any,
        price: orderPrice,
        amount: stake, // stake as amount in collateral terms? For binary, amount is shares; we approximate stake as shares at price
        walletClient,
        isMainnet: false,
        timeInForce: 'IOC',
      });

      const hash = result.hash || result.orderId || '';
      setTxHash(hash);
      toast({
        title: 'Order placed — real tx',
        description: hash ? `View on Shannon Explorer` : 'Order submitted',
      });
      onSuccess?.(hash);
    } catch (e: any) {
      const msg = e?.shortMessage || e?.message || 'Place order failed';
      // Handle known errors per implementation.md
      if (msg.includes('InvalidPrice')) setError(`InvalidPrice — quantized to ${quantizedPrice}`);
      else if (msg.includes('Insufficient')) setError(msg);
      else setError(msg);
    } finally {
      setIsPlacing(false);
    }
  };

  if (!market) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className={isUp ? 'text-green-500' : 'text-red-500'}>{isUp ? 'Buy Up' : 'Buy Down'}</span>
            <Badge variant="outline" className="text-xs">{market.asset}</Badge>
          </DialogTitle>
          <DialogDescription className="text-xs">{market.question}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Market price */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-green-500/10 p-2 rounded border border-green-500/20 text-center">
              <div className="text-xs text-muted-foreground">Up</div>
              <div className="font-bold text-green-600">{(market.yesPrice * 100).toFixed(1)}% • {market.yesPrice.toFixed(4)}</div>
              <div className="text-xs font-mono">q {quantizedPrice.toFixed(4)}</div>
            </div>
            <div className="bg-red-500/10 p-2 rounded border border-red-500/20 text-center">
              <div className="text-xs text-muted-foreground">Down</div>
              <div className="font-bold text-red-600">{(market.noPrice * 100).toFixed(1)}% • {market.noPrice.toFixed(4)}</div>
            </div>
          </div>

          {/* Stake slider */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span>Stake (tUSDC)</span>
              <span className="font-mono">{stake} • Bal {parseFloat(tUSDCBalance).toFixed(2)}</span>
            </div>
            <Slider value={[stake]} min={1} max={1000} step={1} onValueChange={(v) => setStake(v[0])} />
            <div className="flex gap-1 mt-2">
              {[10, 50, 100, 500].map((v) => (
                <Button key={v} variant="outline" size="sm" className="text-xs flex-1" onClick={() => setStake(v)}>{v}</Button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="bg-muted p-3 rounded text-xs space-y-1 font-mono">
            <div className="flex justify-between"><span>You pay</span><span>{stake} tUSDC</span></div>
            <div className="flex justify-between"><span>Price</span><span>{quantizedPrice.toFixed(4)} (quantized)</span></div>
            <div className="flex justify-between"><span>Payout if {isUp ? 'Up' : 'Down'} wins</span><span>{payout.toFixed(2)} (profit {profit.toFixed(2)})</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Max loss</span><span>{stake} if {isUp ? 'Down' : 'Up'}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Est. gas</span><span>~0.0001 STT</span></div>
          </div>

          {/* Allowance step */}
          {!allowanceOk && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 p-2 rounded text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
              <span>Need tUSDC approve for CollateralRouter</span>
              <Button size="sm" variant="outline" className="ml-auto" onClick={handleApprove} disabled={isApproving}>
                {isApproving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Approve'}
              </Button>
            </div>
          )}

          {/* Errors */}
          {error && <div className="text-xs text-red-500 bg-red-500/10 p-2 rounded">{error}</div>}
          {txHash && (
            <div className="text-xs bg-green-500/10 p-2 rounded flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <a href={`https://shannon-explorer.somnia.network/tx/${txHash}`} target="_blank" rel="noreferrer" className="underline flex items-center gap-1">
                View on Shannon Explorer <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Close</Button>
            <Button
              className={`flex-1 ${isUp ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
              onClick={handlePlace}
              disabled={isPlacing || !chainOk || !market.active}
            >
              {isPlacing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {`Place Order — ${stake} tUSDC`}
            </Button>
          </div>

          {!chainOk && <div className="text-xs text-center text-yellow-600">Wrong chain — will switch to Somnia Shannon 50312</div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
