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
import { SXBetMarket } from '@/lib/sxbet';
import { useAccount, useWalletClient } from 'wagmi';
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Zap,
  ArrowRight,
  DollarSign,
  Trophy,
} from 'lucide-react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';

interface SXBetTradeBetModalProps {
  market: SXBetMarket | null;
  isOpen: boolean;
  onClose: () => void;
  walletAddress?: string;
  onSuccess?: () => void;
}

// Convert American odds to decimal
function americanToDecimal(american: string | number): number {
  const odds = typeof american === 'string' ? parseFloat(american) : american;
  if (isNaN(odds)) return 2.0;
  if (odds > 0) {
    return (odds / 100) + 1;
  } else {
    return (100 / Math.abs(odds)) + 1;
  }
}

export function SXBetTradeBetModal({
  market,
  isOpen,
  onClose,
  walletAddress,
  onSuccess,
}: SXBetTradeBetModalProps) {
  const { address: connectedAddress } = useAccount();
  const { data: walletClient } = useWalletClient();
  const queryClient = useQueryClient();
  const [selectedOutcome, setSelectedOutcome] = useState<1 | 2 | null>(null);
  const [amount, setAmount] = useState('10');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!market) return null;

  const outcomes = [
    { id: 1, name: market.teamOne, odds: market.outcomeOne },
    { id: 2, name: market.teamTwo, odds: market.outcomeTwo },
  ];

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
      setError('Minimum is $1');
      return;
    }

    if (amountNum > 1000) {
      setError('Maximum traded bet is $1000');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    // Real tUSDC for SX Bet on Somnia - trigger wallet transaction like Drift/DreamDEX
    const isReal = true;
    if (isReal) {
      try {
        const { parseUnits } = await import('viem');
        const { createPublicClient, http, fallback } = await import('viem');
        const { defineChain } = await import('viem');
        const { DREAMDEX_COPY_VAULT_ADDRESS, DREAMDEX_COPY_VAULT_ABI, SOMNIA_DREAMDEX, ERC20_ABI } = await import('@/lib/contracts');
        const address = connectedAddress || walletAddress;
        const wc: any = walletClient;
        if (!wc || !address) throw new Error('Connect wallet with STT + tUSDC');
        const somniaTestnet = defineChain({ id: 50312, name: 'Somnia Shannon', nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 }, rpcUrls: { default: { http: ['https://dream-rpc.somnia.network'] } } });
        const publicClient: any = createPublicClient({ chain: somniaTestnet as any, transport: fallback([http('https://dream-rpc.somnia.network')]) });
        const amt = parseUnits(amount, 6);
        const bal: any = await publicClient.readContract({ address: SOMNIA_DREAMDEX.collateralTUSDC as any, abi: ERC20_ABI as any, functionName: 'balanceOf', args: [address] });
        if (bal < amt) throw new Error(`Insufficient tUSDC: have ${Number(bal)/1e6}, need ${amount}`);
        const allowance: any = await publicClient.readContract({ address: SOMNIA_DREAMDEX.collateralTUSDC as any, abi: ERC20_ABI as any, functionName: 'allowance', args: [address, DREAMDEX_COPY_VAULT_ADDRESS] });
        if (allowance < amt) {
          const hash = await wc.writeContract({ address: SOMNIA_DREAMDEX.collateralTUSDC as any, abi: ERC20_ABI as any, functionName: 'approve', args: [DREAMDEX_COPY_VAULT_ADDRESS, amt] });
          throw new Error(`Approved ${amount} tUSDC in ${String(hash).slice(0,10)}... - click Trade again to deposit`);
        }
        const hash = await wc.writeContract({ address: DREAMDEX_COPY_VAULT_ADDRESS, abi: DREAMDEX_COPY_VAULT_ABI as any, functionName: 'deposit', args: [amt] });
        try {
          const outcome = outcomes[selectedOutcome! - 1];
          await fetch('/api/sxbet/simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              walletAddress,
              marketHash: market.marketHash,
              marketQuestion: `${market.teamOne} vs ${market.teamTwo}`,
              outcomeSelected: outcome.name,
              outcomeLabel: outcome.name,
              amountUsd: amount,
              priceAtEntry: outcome.odds,
              isReal: true,
              txHash: hash,
            }),
          });
          try { queryClient.invalidateQueries({ queryKey: ['simulation'] }); } catch {}
        } catch {}
        setIsSubmitting(false);
        setSuccess(true);
        onSuccess?.();
        setTimeout(() => { setSuccess(false); setSelectedOutcome(null); setAmount('10'); onClose(); }, 1500);
        return;
      } catch (e: any) {
        setIsSubmitting(false);
        if (e.message.includes('Approved')) { setError(e.message); return; }
        setError(e.message || 'Real tUSDC vault failed - check STT gas + tUSDC balance');
        return;
      }
    }

    // Should not reach here - real tUSDC only, no simulate fallback
    setError('Real tUSDC only - use Trade (tUSDC) flow');
    setIsSubmitting(false);
    return;
    try {
      const outcome = outcomes[selectedOutcome - 1];
      const response = await fetch('/api/sxbet/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          marketHash: market.marketHash,
          type: market.type,
          sport: market.sport,
          league: market.league,
          teamOne: market.teamOne,
          teamTwo: market.teamTwo,
          outcome: selectedOutcome,
          outcomeLabel: outcome.name,
          amount: amount,
          odds: outcome.odds,
          line: market.line,
          gameTime: market.gameTime,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to place bet');
      }

      setSuccess(true);
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || 'Failed to place traded bet');
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
  const selectedOddsAmerican = selectedOutcome ? outcomes[selectedOutcome - 1].odds : '0';
  const selectedOddsDecimal = americanToDecimal(selectedOddsAmerican);
  const potentialPayout = amountNum * selectedOddsDecimal;
  const potentialProfit = potentialPayout - amountNum;

  const canBet = ['active', 'upcoming', 'live', 'open'].includes(market.status?.toLowerCase() || '') || !market.status;

  const marketTypeLabel = market.type === 'spread' ? 'Spread' : market.type === 'total' ? 'Over/Under' : 'Moneyline';

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-white" />
            </div>
            Trade SX Bet
          </DialogTitle>
          <DialogDescription>
            Trade {market.sport} with real tUSDC on Somnia • Vault 0x9CA…
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-6 text-center space-y-4">
            <CheckCircle2 className="w-16 h-16 text-success mx-auto" />
            <div>
              <h3 className="text-lg font-semibold mb-1">Bet placed!</h3>
              <p className="text-sm text-muted-foreground">
                Your traded bet on{' '}
                <span className="font-medium text-foreground">
                  {outcomes[selectedOutcome! - 1].name}
                </span>{' '}
                has been recorded
              </p>
            </div>
            <div className="p-3 rounded-lg bg-surface border border-border/50 text-left">
              <p className="text-xs text-muted-foreground mb-2">Your bet details:</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Match:</span>
                  <span className="font-medium">{market.teamOne} vs {market.teamTwo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type:</span>
                  <span className="font-medium">{marketTypeLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Selection:</span>
                  <span className="text-success font-medium">{outcomes[selectedOutcome! - 1].name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-mono">${amount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Odds:</span>
                  <span className="font-mono">{selectedOddsAmerican} ({selectedOddsDecimal.toFixed(2)}x)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Potential payout:</span>
                  <span className="font-mono text-success">${potentialPayout.toFixed(2)}</span>
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
            {/* Match Info */}
            <div className="p-3 rounded-lg bg-surface border border-border/50">
              <div className="flex items-center justify-between mb-2">
                <Badge variant="outline" className="text-xs">{market.league}</Badge>
                <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/30">{marketTypeLabel}</Badge>
              </div>
              <p className="font-semibold text-center">
                {market.teamOne} vs {market.teamTwo}
              </p>
              {market.line !== undefined && market.type !== 'moneyline' && (
                <p className="text-xs text-center text-muted-foreground mt-1">
                  Line: {market.line > 0 ? '+' : ''}{market.line}
                </p>
              )}
              <p className="text-xs text-center text-muted-foreground mt-1">
                {new Date(market.gameTime * 1000).toLocaleString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>
            </div>

            {/* Outcome Selection */}
            <div className="space-y-2">
              <Label>Select outcome</Label>
              <div className="grid grid-cols-2 gap-2">
                {outcomes.map((outcome, index) => {
                  const decimalOdds = americanToDecimal(outcome.odds);
                  const impliedProb = (1 / decimalOdds) * 100;

                  return (
                    <button
                      key={outcome.id}
                      onClick={() => setSelectedOutcome(outcome.id as 1 | 2)}
                      disabled={!canBet}
                      className={`p-3 rounded-xl border-2 transition-all text-center ${
                        selectedOutcome === outcome.id
                          ? index === 0
                            ? 'border-success bg-success/10'
                            : 'border-destructive bg-destructive/10'
                          : 'border-border/50 hover:border-emerald-500/50'
                      } ${!canBet ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <p className={`font-semibold text-sm truncate ${
                        selectedOutcome === outcome.id
                          ? index === 0
                            ? 'text-success'
                            : 'text-destructive'
                          : ''
                      }`}>
                        {outcome.name}
                      </p>
                      <p className="text-lg font-bold font-mono mt-1">
                        {outcome.odds}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {decimalOdds.toFixed(2)}x | {impliedProb.toFixed(0)}%
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Amount Input */}
            <div className="space-y-2">
              <Label>Amount (tUSDC)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="1"
                  max="1000"
                  step="1"
                  className="pl-9"
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
                    ${preset}
                  </Button>
                ))}
              </div>
            </div>

            {/* Potential Return */}
            {selectedOutcome !== null && amountNum > 0 && (
              <div className="p-3 rounded-lg bg-gradient-to-r from-success/5 to-emerald-500/5 border border-success/20">
                <div className="flex items-center justify-between">
                  <span className="text-sm">If {outcomes[selectedOutcome - 1].name} wins:</span>
                  <div className="text-right">
                    <p className="text-lg font-bold text-success">${potentialPayout.toFixed(2)}</p>
                    <p className="text-xs text-success/80">+${potentialProfit.toFixed(2)} profit</p>
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
                  This market has {market.status}. You can only bet on active markets.
                </AlertDescription>
              </Alert>
            )}

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || selectedOutcome === null || !walletAddress || !canBet}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400"
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Placing bet...
                </>
              ) : !walletAddress ? (
                'Connect wallet first'
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Trade (tUSDC)
                </>
              )}
            </Button>

            <p className="text-[10px] text-center text-muted-foreground">
              Real tUSDC via Somnia vault 0x9CA… • 6dec • STT gas
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
