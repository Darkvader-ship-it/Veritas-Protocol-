'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { PolymarketMarket } from '@/lib/polymarket';
import { TrendingUp, TrendingDown, Activity, Zap, DollarSign, CheckCircle2, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';

interface TradeBetModalProps {
  market: PolymarketMarket | null;
  isOpen: boolean;
  onClose: () => void;
  walletAddress?: string;
  onSuccess?: () => void;
}

export function TradeBetModal({
  market,
  isOpen,
  onClose,
  walletAddress,
  onSuccess,
}: TradeBetModalProps) {
  const [betAmount, setBetAmount] = useState('10');
  const [betOutcome, setBetOutcome] = useState<'Yes' | 'No'>('Yes');
  const [isPlacing, setIsPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const queryClient = useQueryClient();

  // Reset success when market changes or modal reopens
  useEffect(() => {
    setSuccess(false);
    setError(null);
    setBetAmount('10');
    setBetOutcome('Yes');
  }, [market?.id, market?.conditionId, isOpen]);

  if (!market) return null;

  // Parse prices
  const prices = typeof market.outcomePrices === 'string'
    ? JSON.parse(market.outcomePrices).map((p: string) => parseFloat(p))
    : market.outcomePrices?.map((p: any) => parseFloat(p)) || [0.5, 0.5];

  const yesPrice = prices[0] || 0.5;
  const noPrice = prices[1] || 0.5;
  const selectedPrice = betOutcome === 'Yes' ? yesPrice : noPrice;

  // Calculate potential payout
  const amount = parseFloat(betAmount) || 0;
  const potentialPayout = amount / selectedPrice;
  const potentialProfit = potentialPayout - amount;

  const handlePlaceBet = async () => {
    if (!walletAddress) {
      setError('Please connect your wallet first');
      return;
    }

    if (amount <= 0) {
      setError('Enter a valid amount');
      return;
    }

    // Real tUSDC on Somnia - 0¢ markets capped to 1¢ for realistic payout
    const isZeroCent = selectedPrice < 0.01;
    if (isZeroCent && amount / 0.01 > 5000) {
      setError('Payout capped: 0¢ markets max 5000 tUSDC payout (try smaller amount)');
      return;
    }

    setIsPlacing(true);
    setError(null);

    // Real tUSDC vault path - trigger wallet transaction like Drift
    const isReal = true;
    if (isReal) {
      try {
        const { parseUnits } = await import('viem');
        const { createPublicClient, http, fallback } = await import('viem');
        const { defineChain } = await import('viem');
        const { DREAMDEX_COPY_VAULT_ADDRESS, DREAMDEX_COPY_VAULT_ABI, SOMNIA_DREAMDEX, ERC20_ABI } = await import('@/lib/contracts');
        const { getWalletClient } = await import('wagmi/actions');
        const { config } = await import('@/lib/wagmi');
        const wc: any = await getWalletClient(config as any).catch(() => null);
        const address = walletAddress;
        if (!wc || !address) throw new Error('Connect wallet with STT + tUSDC');
        const somniaTestnet = defineChain({ id: 50312, name: 'Somnia Shannon', nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 }, rpcUrls: { default: { http: ['https://dream-rpc.somnia.network'] } } });
        const publicClient: any = createPublicClient({ chain: somniaTestnet as any, transport: fallback([http('https://dream-rpc.somnia.network')]) });
        const amt = parseUnits(String(amount), 6);
        const bal: any = await publicClient.readContract({ address: SOMNIA_DREAMDEX.collateralTUSDC as any, abi: ERC20_ABI as any, functionName: 'balanceOf', args: [address] });
        if (bal < amt) throw new Error(`Insufficient tUSDC: have ${Number(bal)/1e6}, need ${amount}`);
        const allowance: any = await publicClient.readContract({ address: SOMNIA_DREAMDEX.collateralTUSDC as any, abi: ERC20_ABI as any, functionName: 'allowance', args: [address, DREAMDEX_COPY_VAULT_ADDRESS] });
        if (allowance < amt) {
          const hash = await wc.writeContract({ address: SOMNIA_DREAMDEX.collateralTUSDC as any, abi: ERC20_ABI as any, functionName: 'approve', args: [DREAMDEX_COPY_VAULT_ADDRESS, amt] });
          throw new Error(`Approved ${amount} tUSDC in ${String(hash).slice(0,10)}... - click Trade again to deposit`);
        }
        const hash = await wc.writeContract({ address: DREAMDEX_COPY_VAULT_ADDRESS, abi: DREAMDEX_COPY_VAULT_ABI as any, functionName: 'deposit', args: [amt] });
        // Also create pending bet so Dashboard > Pending bets updates with Yes/No immediately (REAL)
        try {
          await fetch('/api/polymarket/simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              follower: walletAddress,
              marketId: market.conditionId || market.id,
              marketQuestion: market.question,
              outcomeSelected: betOutcome,
              amountUsd: amount,
              priceAtEntry: selectedPrice,
              isReal: true,
              txHash: hash,
            }),
          });
          try { queryClient.invalidateQueries({ queryKey: ['simulation'] }); } catch {}
        } catch {}
        setIsPlacing(false);
        setSuccess(true);
        onSuccess?.();
        return;
      } catch (e: any) {
        setIsPlacing(false);
        if (e.message.includes('Approved')) { setError(e.message); return; }
        setError(e.message || 'Real tUSDC vault failed');
        return;
      }
    }

    try {
      const res = await fetch('/api/polymarket/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          follower: walletAddress,
          marketId: market.conditionId || market.id,
          marketQuestion: market.question,
          outcomeSelected: betOutcome,
          amountUsd: amount,
          priceAtEntry: selectedPrice,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(true);
        onSuccess?.();
        // Don't auto-close - let user see confirmation and click Dashboard link
      } else {
        setError(data.message || 'Failed to place traded bet');
      }
    } catch (err) {
      console.error('Error placing bet:', err);
      setError('Failed to place bet. Try again.');
    } finally {
      setIsPlacing(false);
    }
  };

  const formatVolume = (vol: number) => {
    if (vol >= 1000000) return `$${(vol / 1000000).toFixed(1)}M`;
    if (vol >= 1000) return `$${(vol / 1000).toFixed(0)}K`;
    return `$${vol.toFixed(0)}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Trade Polymarket (tUSDC) — Real
          </DialogTitle>
          <DialogDescription>
            Trade with real tUSDC on Somnia • Vault 0x9CAadc… • 6dec • STT gas • No simulation
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Market Info */}
          <div className="p-3 rounded-lg bg-surface border border-border/50">
            <p className="font-medium text-sm leading-tight">{market.question}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                {formatVolume(market.volumeNum)} vol
              </Badge>
              {market.endDate && (
                <Badge variant="outline" className="text-xs">
                  Ends {new Date(market.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Badge>
              )}
            </div>
          </div>

          {/* Outcome Selection */}
          <div className="space-y-2">
            <Label>Select outcome</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={betOutcome === 'Yes' ? 'default' : 'outline'}
                className={`h-16 flex-col ${betOutcome === 'Yes' ? 'bg-success hover:bg-success/90 border-success' : 'hover:border-success/50'}`}
                onClick={() => setBetOutcome('Yes')}
              >
                <TrendingUp className="h-5 w-5 mb-1" />
                <span className="font-bold">Yes</span>
                <span className="text-xs opacity-80">{(yesPrice * 100).toFixed(0)}¢</span>
              </Button>
              <Button
                type="button"
                variant={betOutcome === 'No' ? 'default' : 'outline'}
                className={`h-16 flex-col ${betOutcome === 'No' ? 'bg-destructive hover:bg-destructive/90 border-destructive' : 'hover:border-destructive/50'}`}
                onClick={() => setBetOutcome('No')}
              >
                <TrendingDown className="h-5 w-5 mb-1" />
                <span className="font-bold">No</span>
                <span className="text-xs opacity-80">{(noPrice * 100).toFixed(0)}¢</span>
              </Button>
            </div>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (tUSDC)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground">tUSDC</span>
              <Input
                id="amount"
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                min="1"
                max="1000"
                step="1"
                className="pl-9"
                placeholder="10"
              />
            </div>
            <div className="flex gap-2">
              {[5, 10, 25, 50, 100].map((amt) => (
                <Button
                  key={amt}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 h-7 text-xs"
                  onClick={() => setBetAmount(amt.toString())}
                >
                  {amt} tUSDC
                </Button>
              ))}
            </div>
          </div>

          {/* Potential Payout - cap unrealistic 0¢ */}
          {(() => {
            const isZeroCent = selectedPrice < 0.01;
            const displayPrice = isZeroCent ? 0.01 : selectedPrice;
            const displayPayout = amount / displayPrice;
            const displayProfit = displayPayout - amount;
            return (
              <div className="p-3 rounded-lg bg-gradient-to-r from-success/5 to-primary/5 border border-success/20">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">If {betOutcome} wins:</span>
                  <div className="text-right">
                    <p className="text-lg font-bold text-success">{displayPayout.toFixed(2)} tUSDC</p>
                    <p className="text-xs text-success/80">+{displayProfit.toFixed(2)} profit {isZeroCent ? '(capped 1¢)' : ''}</p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          {/* Success */}
          {success && (
            <div className="space-y-4 py-4">
              <div className="text-center">
                <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-2" />
                <h3 className="font-semibold">Bet placed!</h3>
              </div>
              <div className="p-3 rounded-lg bg-surface border border-border/50 text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Position:</span>
                  <span className={betOutcome === 'Yes' ? 'text-success font-medium' : 'text-destructive font-medium'}>{betOutcome}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-mono">${amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Entry price:</span>
                  <span className="font-mono">{(selectedPrice * 100).toFixed(0)}¢</span>
                </div>
              </div>
              <Link href="/dashboard" className="block">
                <Button variant="outline" className="w-full">
                  View in Dashboard
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          )}

          {/* Submit Button */}
          <Button
            onClick={handlePlaceBet}
            disabled={isPlacing || !walletAddress || success}
            className="w-full h-12"
          >
            {isPlacing ? (
              <>
                <Activity className="w-4 h-4 mr-2 animate-spin" />
                Trading...
              </>
            ) : !walletAddress ? (
              'Connect wallet to trade'
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Trade ${betAmount} on {betOutcome}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
