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
import { OvertimePredictionMarket } from '@/lib/overtime';
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
import { useAccount, useWalletClient } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';

interface OvertimeSimulateBetModalProps {
  market: OvertimePredictionMarket | null;
  isOpen: boolean;
  onClose: () => void;
  walletAddress?: string;
  onSuccess?: () => void;
}

export function OvertimeSimulateBetModal({
  market,
  isOpen,
  onClose,
  walletAddress,
  onSuccess,
}: OvertimeSimulateBetModalProps) {
  const { address: connectedAddress } = useAccount();
  const { data: walletClient } = useWalletClient();
  const queryClient = useQueryClient();
  const [selectedPosition, setSelectedPosition] = useState<number | null>(null);
  const [amount, setAmount] = useState('10');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!market) return null;

  const handleSubmit = async () => {
    if (!walletAddress) {
      setError('Please connect your wallet first');
      return;
    }

    if (selectedPosition === null) {
      setError('Please select an outcome');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (amountNum < 1) {
      setError('Minimum is 1 tUSDC');
      return;
    }

    if (amountNum > 10000) {
      setError('Maximum is 10000 tUSDC (faucet cap)');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    // Real tUSDC for Sports - trigger wallet transaction like Drift/DreamDEX
    const isReal = true;
    if (isReal) {
      try {
        const { parseUnits } = await import('viem');
        const { createPublicClient, http, fallback } = await import('viem');
        const { defineChain } = await import('viem');
        const { DREAMDEX_COPY_VAULT_ADDRESS, DREAMDEX_COPY_VAULT_ABI, SOMNIA_DREAMDEX, ERC20_ABI } = await import('@/lib/contracts');
        const wc: any = walletClient;
        const address = connectedAddress || walletAddress;
        if (!wc || !address) throw new Error('Connect wallet with STT + tUSDC');
        
        const somniaTestnet = defineChain({ id: 50312, name: 'Somnia Shannon', nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 }, rpcUrls: { default: { http: ['https://dream-rpc.somnia.network'] } } });
        const publicClient: any = createPublicClient({ chain: somniaTestnet as any, transport: fallback([http('https://dream-rpc.somnia.network')]) });
        const amt = parseUnits(amount, 6);
        const bal: any = await publicClient.readContract({ address: SOMNIA_DREAMDEX.collateralTUSDC as any, abi: ERC20_ABI as any, functionName: 'balanceOf', args: [address] });
        if (bal < amt) throw new Error(`Insufficient tUSDC: have ${Number(bal)/1e6}, need ${amount}`);
        const allowance: any = await publicClient.readContract({ address: SOMNIA_DREAMDEX.collateralTUSDC as any, abi: ERC20_ABI as any, functionName: 'allowance', args: [address, DREAMDEX_COPY_VAULT_ADDRESS] });
        if (allowance < amt) {
          const hash = await wc.writeContract({ address: SOMNIA_DREAMDEX.collateralTUSDC as any, abi: ERC20_ABI as any, functionName: 'approve', args: [DREAMDEX_COPY_VAULT_ADDRESS, amt] });
          setIsSubmitting(false);
          setError(`Approved ${amount} tUSDC in ${String(hash).slice(0,10)}... - click Trade again to deposit`);
          return;
        }
        const hash = await wc.writeContract({ address: DREAMDEX_COPY_VAULT_ADDRESS, abi: DREAMDEX_COPY_VAULT_ABI as any, functionName: 'deposit', args: [amt] });
        try {
          const outcomeLabel = typeof market.outcomes[selectedPosition!] === 'string' ? market.outcomes[selectedPosition!] : (market.outcomes[selectedPosition!] as any)?.name;
          await fetch('/api/overtime/simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              walletAddress,
              gameId: market.gameId,
              marketQuestion: `${market.homeTeam} vs ${market.awayTeam}`,
              outcomeSelected: outcomeLabel,
              outcomeLabel,
              amountUsd: amount,
              priceAtEntry: market.odds[selectedPosition!],
              isReal: true,
              txHash: hash,
            }),
          });
          try { queryClient.invalidateQueries({ queryKey: ['simulation'] }); } catch {}
        } catch {}
        setIsSubmitting(false);
        setSuccess(true);
        onSuccess?.();
        setTimeout(() => { setSuccess(false); setSelectedPosition(null); setAmount('10'); onClose(); }, 1500);
        return;
      } catch (e: any) {
        setIsSubmitting(false);
        if (e.message.includes('Approved')) { setError(e.message); return; }
        setError(e.message || 'Real tUSDC vault failed - check STT gas + tUSDC balance');
        return;
      }
    }

    // Should not reach here - real tUSDC only, no simulate fallback
    setError('Real tUSDC only - use Trade (tUSDC) flow above');
    return;
    try {
      const outcomeLabel = typeof market.outcomes[selectedPosition] === 'string' ? market.outcomes[selectedPosition] : (market.outcomes[selectedPosition] as any)?.name;
      const response = await fetch('/api/overtime/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          gameId: market.gameId,
          sportId: market.sportId,
          sportName: market.sportName,
          leagueName: market.leagueName,
          homeTeam: market.homeTeam,
          awayTeam: market.awayTeam,
          position: selectedPosition,
          outcomeLabel,
          amount: amount,
          odds: market.odds[selectedPosition],
          maturity: market.maturity,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to place bet');
      }

      setSuccess(true);
      onSuccess?.();
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
      setSelectedPosition(null);
      onClose();
    }
  };

  // Calculate potential returns
  const amountNum = parseFloat(amount) || 0;
  const selectedOdds = selectedPosition !== null ? market.odds[selectedPosition] : 0;
  const potentialPayout = amountNum * selectedOdds;
  const potentialProfit = potentialPayout - amountNum;

  const canBet = market.status === 'upcoming' || market.status === 'live';

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-blue-500 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-white" />
            </div>
            Trade {market.sportName} (tUSDC) — Real
          </DialogTitle>
          <DialogDescription>
            Real tUSDC on Somnia • Vault 0x9CAadc… • 6dec • STT gas • No simulation
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
                  {typeof market.outcomes[selectedPosition!] === 'string' ? market.outcomes[selectedPosition!] : (market.outcomes[selectedPosition!] as any)?.name}
                </span>{' '}
                has been recorded
              </p>
            </div>
            <div className="p-3 rounded-lg bg-surface border border-border/50 text-left">
              <p className="text-xs text-muted-foreground mb-2">Your bet details:</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Match:</span>
                  <span className="font-medium">{market.homeTeam} vs {market.awayTeam}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Selection:</span>
                  <span className="text-success font-medium">{typeof market.outcomes[selectedPosition!] === 'string' ? market.outcomes[selectedPosition!] : (market.outcomes[selectedPosition!] as any)?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-mono">${amount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Odds:</span>
                  <span className="font-mono">{selectedOdds.toFixed(2)}x</span>
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
                <Badge variant="outline" className="text-xs">{market.leagueName}</Badge>
                <Badge variant="outline" className="text-xs">{market.sportName}</Badge>
              </div>
              <p className="font-semibold text-center">
                {market.homeTeam} vs {market.awayTeam}
              </p>
              <p className="text-xs text-center text-muted-foreground mt-1">
                {new Date(market.maturity * 1000).toLocaleString('en-US', {
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
              <div className={`grid gap-2 ${market.outcomes.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                {market.outcomes.map((outcome, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedPosition(index)}
                    disabled={!canBet}
                    className={`p-3 rounded-xl border-2 transition-all text-center ${
                      selectedPosition === index
                        ? index === 0
                          ? 'border-success bg-success/10'
                          : index === market.outcomes.length - 1
                          ? 'border-destructive bg-destructive/10'
                          : 'border-primary bg-primary/10'
                        : 'border-border/50 hover:border-primary/50'
                    } ${!canBet ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <p className={`font-semibold text-sm truncate ${
                      selectedPosition === index
                        ? index === 0
                          ? 'text-success'
                          : index === market.outcomes.length - 1
                          ? 'text-destructive'
                          : 'text-primary'
                        : ''
                    }`}>
                      {typeof outcome === 'string' ? outcome : (outcome as any)?.name}
                    </p>
                    <p className="text-lg font-bold font-mono mt-1">
                      {market.odds[index].toFixed(2)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {market.probabilities[index].toFixed(0)}% implied
                    </p>
                  </button>
                ))}
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
            {selectedPosition !== null && amountNum > 0 && (
              <div className="p-3 rounded-lg bg-gradient-to-r from-success/5 to-primary/5 border border-success/20">
                <div className="flex items-center justify-between">
                  <span className="text-sm">If {typeof market.outcomes[selectedPosition] === 'string' ? market.outcomes[selectedPosition] : (market.outcomes[selectedPosition] as any)?.name} wins:</span>
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
                  This match has {market.status}. You can only bet on upcoming or live matches.
                </AlertDescription>
              </Alert>
            )}

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || selectedPosition === null || !walletAddress || !canBet}
              className="w-full bg-gradient-to-r from-primary to-blue-600"
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Trading...
                </>
              ) : !walletAddress ? (
                'Connect wallet first'
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Trade ({amount} tUSDC)
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
