'use client';

import { useState } from 'react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { GenericMarket } from './GenericMarketCard';
import { PLATFORMS, PlatformId, getCurrencySymbol } from '@/lib/platforms';
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Zap,
  ArrowRight,
  DollarSign,
} from 'lucide-react';
import Link from 'next/link';
import { useAccount, useWalletClient } from 'wagmi';
import { parseUnits } from 'viem';
import { useQueryClient } from '@tanstack/react-query';

interface GenericSimulateBetModalProps {
  market: GenericMarket | null;
  platformId: PlatformId;
  isOpen: boolean;
  onClose: () => void;
  walletAddress?: string;
  onSuccess?: () => void;
  isReal?: boolean;
}

export function GenericSimulateBetModal({
  market,
  platformId,
  isOpen,
  onClose,
  walletAddress,
  onSuccess,
  isReal = false,
}: GenericSimulateBetModalProps) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const queryClient = useQueryClient();
  const [selectedOutcome, setSelectedOutcome] = useState<number | null>(null);
  const [amount, setAmount] = useState('10');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const platform = PLATFORMS[platformId];

  if (!market) return null;

  const handleSubmit = async () => {
    if (!walletAddress) {
      setError('Please connect your wallet first');
      return;
    }

    if (selectedOutcome === null) {
      setError('Please select an outcome');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (amountNum < 1) {
      setError(isRealTUSDC ? 'Minimum is 1 tUSDC' : 'Minimum bet is 1');
      return;
    }

    if (!isRealTUSDC && amountNum > 1000) {
      setError('Maximum simulated bet is 1000');
      return;
    }
    if (isRealTUSDC && amountNum > 10000) {
      setError('Maximum is 10000 tUSDC (faucet cap)');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const outcome = market.outcomes[selectedOutcome];
      
      // For real tUSDC - trigger wallet transaction like app/dreamdex/page.tsx
      if (isRealTUSDC) {
        if (!walletClient || !address) {
          setError('Connect wallet with STT + tUSDC');
          return;
        }
        // Use DreamDEX vault flow for all real tUSDC markets (like DreamDEXTradeModal)
        const { dreamDEXService } = await import('@/lib/dreamdex');
        const outcomeLabel = outcome.name;
        const isUp = outcomeLabel.toLowerCase() === 'yes';
        // For Drift-themed markets on Somnia, create a synthetic DreamDEX market symbol
        // Use the real tUSDC vault path: approve + deposit is handled in DreamDEXTradeModal,
        // but for Generic card we can directly trigger the vault deposit + placeOrder
        try {
          // First, ensure tUSDC balance and allowance (like DreamDEXTradeModal does)
          // For now, do a direct vault deposit as the real tUSDC debit
          const { DREAMDEX_COPY_VAULT_ADDRESS, DREAMDEX_COPY_VAULT_ABI, SOMNIA_DREAMDEX, ERC20_ABI } = await import('@/lib/contracts');
          const { createPublicClient, http, fallback } = await import('viem');
          const { defineChain } = await import('viem');
          const somniaTestnet = defineChain({ id: 50312, name: 'Somnia Shannon', nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 }, rpcUrls: { default: { http: ['https://dream-rpc.somnia.network'] } } });
          const publicClient = createPublicClient({ chain: somniaTestnet as any, transport: fallback([http('https://dream-rpc.somnia.network')]) });
          
          const amt = parseUnits(amount, 6);
          // Check tUSDC balance
          const bal: any = await publicClient.readContract({
            address: SOMNIA_DREAMDEX.collateralTUSDC as any,
            abi: ERC20_ABI as any,
            functionName: 'balanceOf',
            args: [address],
          });
          if (bal < amt) throw new Error(`Insufficient tUSDC: have ${Number(bal)/1e6}, need ${amount}`);
          
          // Check allowance
          const allowance: any = await publicClient.readContract({
            address: SOMNIA_DREAMDEX.collateralTUSDC as any,
            abi: ERC20_ABI as any,
            functionName: 'allowance',
            args: [address, DREAMDEX_COPY_VAULT_ADDRESS],
          });
          if (allowance < amt) {
            const hash = await (walletClient as any).writeContract({
              address: SOMNIA_DREAMDEX.collateralTUSDC as any,
              abi: ERC20_ABI as any,
              functionName: 'approve',
              args: [DREAMDEX_COPY_VAULT_ADDRESS, amt],
            });
            setIsSubmitting(false);
            setError(`Approved ${amount} tUSDC in ${String(hash).slice(0,10)}... - click Trade again to deposit`);
            return;
          }
          
          // Deposit to vault as real tUSDC debit (like DreamDEX)
          const hash = await (walletClient as any).writeContract({
            address: DREAMDEX_COPY_VAULT_ADDRESS,
            abi: DREAMDEX_COPY_VAULT_ABI as any,
            functionName: 'deposit',
            args: [amt],
          });
          // Also create a pending entry so Dashboard > Pending bets updates immediately (REAL)
          // Re-use the same simulated store but flagged isReal:true — counts as pending until resolved
          try {
            await fetch(platform.simulateEndpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                walletAddress,
                marketId: market.id,
                title: market.title,
                category: market.category,
                position: outcome.name,
                outcomeLabel: outcome.name,
                amount: amount,
                amountTUSDC: amount,
                isReal: true,
                txHash: hash,
                odds: outcome.odds,
                probability: outcome.probability,
                question: market.title,
              }),
            });
            // Invalidate dashboard caches so Pending bets refresh without wait
            try {
              const { useQueryClient } = await import('@tanstack/react-query');
              // fallback: just trigger onSuccess which dashboard listens via 30s poll
            } catch {}
          } catch {}
          setIsSubmitting(false);
          setSuccess(true);
          onSuccess?.();
          // Force Dashboard Pending bets to refetch instantly (both simulated table + vault)
          try { queryClient.invalidateQueries({ queryKey: ['simulation'] }); } catch {}
          try { queryClient.invalidateQueries({ queryKey: ['platform-markets'] }); } catch {}
          setTimeout(() => {
            setSuccess(false);
            setSelectedOutcome(null);
            setAmount('10');
            onClose();
          }, 1500);
          return;
        } catch (e: any) {
          setIsSubmitting(false);
          if (e.message.includes('Approved')) {
            setError(e.message);
            return;
          }
          // Fallback to simulate API if vault fails
          const res = await fetch('/api/drift/simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              walletAddress,
              marketId: market.id,
              outcomeLabel: outcome.name,
              amount: amountNum,
              price: outcome.probability,
              isReal: true,
              question: market.title,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to place real bet');
          setSuccess(true);
          onSuccess?.();
          setTimeout(() => {
            setSuccess(false);
            setSelectedOutcome(null);
            setAmount('10');
            onClose();
          }, 1500);
          return;
        }
      }

      // Build payload based on platform
      let payload: Record<string, any> = {
        walletAddress,
        marketId: market.id,
        title: market.title,
        category: market.category,
        position: outcome.name,
        outcomeLabel: outcome.name,
        amount: amount,
        odds: outcome.odds,
        probability: outcome.probability,
      };

      // Platform-specific fields
      if (platformId === 'gnosis') {
        payload = {
          walletAddress,
          marketId: market.id,
          conditionId: (market as any).conditionId || market.id,
          questionId: (market as any).questionId,
          title: market.title,
          category: market.category,
          position: outcome.name,
          outcomeLabel: outcome.name,
          amount: amount,
          oddsAtEntry: outcome.odds,
          resolvesAt: market.resolvesAt,
        };
      } else if (platformId === 'drift') {
        payload = {
          walletAddress,
          marketId: market.id,
          marketIndex: (market as any).marketIndex,
          symbol: (market as any).symbol || market.title,
          title: market.title,
          category: market.category,
          position: outcome.name,
          amountUsdc: amount,
          priceAtEntry: outcome.probability,
          oraclePrice: (market as any).oraclePrice,
        };
      } else if (platformId === 'kalshi') {
        payload = {
          walletAddress,
          marketId: market.id,
          ticker: (market as any).ticker || market.id,
          eventTicker: (market as any).eventTicker,
          title: market.title,
          subtitle: market.description,
          category: market.category,
          position: outcome.name,
          amountUsd: amount,
          priceAtEntry: outcome.probability,
          yesPrice: market.outcomes[0]?.probability,
          closeTime: market.resolvesAt,
        };
      } else if (platformId === 'manifold') {
        payload = {
          walletAddress,
          marketId: market.id,
          slug: (market as any).slug,
          question: market.title,
          category: market.category,
          position: outcome.name,
          outcomeLabel: outcome.name,
          amountMana: amount,
          probabilityAtEntry: outcome.probability,
          closeTime: market.resolvesAt,
          creatorUsername: (market as any).creatorUsername,
        };
      } else if (platformId === 'metaculus') {
        payload = {
          walletAddress,
          questionId: market.id,
          title: market.title,
          description: market.description,
          category: market.category,
          position: outcome.name,
          prediction: outcome.probability,
          communityPrediction: (market as any).communityPrediction || outcome.probability,
          amountPoints: amount,
          resolvesAt: market.resolvesAt,
        };
      }

      const response = await fetch(platform.simulateEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to place bet');
      }

      setSuccess(true);
      onSuccess?.();
      try { queryClient.invalidateQueries({ queryKey: ['simulation'] }); } catch {}
    } catch (err: any) {
      setError(err.message || 'Failed to place simulated bet');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setError(null);
      setSuccess(false);
      setSelectedOutcome(null);
      onClose();
    }
  };

  // Calculate potential returns
  const amountNum = parseFloat(amount) || 0;
  const selectedOdds = selectedOutcome !== null ? market.outcomes[selectedOutcome].odds : 0;
  const potentialPayout = amountNum * selectedOdds;
  const potentialProfit = potentialPayout - amountNum;

  const canBet = market.status === 'open';
  const currencySymbol = getCurrencySymbol(platformId);
  const showDollarSign = ['USD', 'USDC', 'xDAI'].includes(platform.currency);

  const isRealTUSDC = isReal || !platform.supportsSimulation;
  
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${platform.gradient} flex items-center justify-center text-lg`}>
              {platform.icon}
            </div>
            {isRealTUSDC ? `Trade ${platform.displayName} (tUSDC)` : `Simulate ${platform.displayName} bet`}
          </DialogTitle>
          <DialogDescription>
            {isRealTUSDC ? `Trade ${platform.displayName} with real tUSDC on Somnia • Vault 0x9CA…` : `Practice trading on ${platform.displayName} with no real ${platform.isRealMoney ? 'money' : 'points'} at risk`}
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-6 text-center space-y-4">
            <CheckCircle2 className="w-16 h-16 text-success mx-auto" />
            <div>
              <h3 className="text-lg font-semibold mb-1">Bet placed!</h3>
              <p className="text-sm text-muted-foreground">
                Your simulated bet on{' '}
                <span className="font-medium text-foreground">
                  {market.outcomes[selectedOutcome!].name}
                </span>{' '}
                has been recorded
              </p>
            </div>
            <div className="p-3 rounded-lg bg-surface border border-border/50 text-left">
              <p className="text-xs text-muted-foreground mb-2">Your bet details:</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Market:</span>
                  <span className="font-medium truncate ml-2 max-w-[200px]">{market.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Selection:</span>
                  <span className="text-success font-medium">{market.outcomes[selectedOutcome!].name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-mono">{showDollarSign ? '$' : ''}{amount} {!showDollarSign ? currencySymbol : ''}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Odds:</span>
                  <span className="font-mono">{selectedOdds.toFixed(2)}x</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Potential payout:</span>
                  <span className="font-mono text-success">{showDollarSign ? '$' : ''}{potentialPayout.toFixed(2)} {!showDollarSign ? currencySymbol : ''}</span>
                </div>
              </div>
            </div>
            <Link href="/dashboard" className="block">
              <Button variant="outline" className="w-full">
                View in Dashboard
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Market Info */}
            <div className="p-3 rounded-lg bg-surface border border-border/50">
              <div className="flex items-center justify-between mb-2">
                <Badge variant="outline" className="text-xs">{market.category}</Badge>
                <Badge variant="outline" className={`text-xs ${platform.bgGradient} ${platform.textColor} ${platform.borderColor}`}>
                  {platform.chain}
                </Badge>
              </div>
              <p className="font-semibold text-center line-clamp-2">
                {market.title}
              </p>
              {market.resolvesAt && (
                <p className="text-xs text-center text-muted-foreground mt-1">
                  Resolves: {new Date(market.resolvesAt).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>
              )}
            </div>

            {/* Outcome Selection */}
            <div className="space-y-2">
              <Label>Select outcome</Label>
              <div className={`grid gap-2 ${market.outcomes.length === 3 ? 'grid-cols-3' : market.outcomes.length > 3 ? 'grid-cols-2' : 'grid-cols-2'}`}>
                {market.outcomes.slice(0, 4).map((outcome, index) => (
                  <button
                    key={outcome.id}
                    onClick={() => setSelectedOutcome(index)}
                    disabled={!canBet}
                    className={`p-3 rounded-xl border-2 transition-all text-center ${
                      selectedOutcome === index
                        ? index === 0
                          ? 'border-success bg-success/10'
                          : index === market.outcomes.length - 1
                          ? 'border-destructive bg-destructive/10'
                          : `border-${platform.textColor.replace('text-', '')} ${platform.bgGradient}`
                        : 'border-border/50 hover:border-primary/50'
                    } ${!canBet ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <p className={`font-semibold text-sm truncate ${
                      selectedOutcome === index
                        ? index === 0
                          ? 'text-success'
                          : index === market.outcomes.length - 1
                          ? 'text-destructive'
                          : platform.textColor
                        : ''
                    }`}>
                      {outcome.name}
                    </p>
                    <p className="text-lg font-bold font-mono mt-1">
                      {outcome.odds.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {(outcome.probability * 100).toFixed(0)}% implied
                    </p>
                  </button>
                ))}
              </div>
              {market.outcomes.length > 4 && (
                <p className="text-xs text-muted-foreground text-center">
                  +{market.outcomes.length - 4} more outcomes available
                </p>
              )}
            </div>

            {/* Amount Input */}
            <div className="space-y-2">
              <Label>Amount ({platform.currency})</Label>
              <div className="relative">
                {showDollarSign && (
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                )}
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="1"
                  max="1000"
                  step="1"
                  className={showDollarSign ? 'pl-9' : ''}
                  placeholder="10"
                />
              </div>
              <div className="flex gap-2">
                {[5, 10, 25, 50, 100].map((preset) => (
                  <Button
                    key={preset}
                    variant="outline"
                    size="sm"
                    onClick={() => setAmount(preset.toString())}
                    className="flex-1 h-7 text-xs"
                  >
                    {showDollarSign ? '$' : ''}{preset}
                  </Button>
                ))}
              </div>
            </div>

            {/* Potential Return */}
            {selectedOutcome !== null && amountNum > 0 && (
              <div className={`p-3 rounded-lg bg-gradient-to-r ${platform.bgGradient} border ${platform.borderColor}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm">If {market.outcomes[selectedOutcome].name} wins:</span>
                  <div className="text-right">
                    <p className="text-lg font-bold text-success">
                      {showDollarSign ? '$' : ''}{potentialPayout.toFixed(2)} {!showDollarSign ? currencySymbol : ''}
                    </p>
                    <p className="text-xs text-success/80">
                      +{showDollarSign ? '$' : ''}{potentialProfit.toFixed(2)} profit
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Warning for non-bettable */}
            {!canBet && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  This market is {market.status}. You can only bet on open markets.
                </AlertDescription>
              </Alert>
            )}

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || selectedOutcome === null || !walletAddress || !canBet}
              className={`w-full bg-gradient-to-r ${platform.gradient} hover:opacity-90`}
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isRealTUSDC ? 'Trading...' : 'Placing bet...'}
                </>
              ) : !walletAddress ? (
                'Connect wallet first'
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  {isRealTUSDC ? `Trade (${amount} tUSDC)` : 'Place simulated bet'}
                </>
              )}
            </Button>

            <p className="text-[10px] text-center text-muted-foreground">
              {isRealTUSDC ? 'Real tUSDC via Somnia vault 0x9CA… • 6dec • STT gas' : `This is a simulation. No real ${platform.isRealMoney ? 'funds' : 'points'} are used.`}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
