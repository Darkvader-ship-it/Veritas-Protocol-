'use client';

import { useAccount, useWalletClient } from 'wagmi';
import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LimitlessPredictionMarket } from '@/lib/limitless';
import {
  TrendingUp,
  TrendingDown,
  ExternalLink,
  Zap,
  Clock,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  DollarSign,
  BarChart3,
} from 'lucide-react';
import Link from 'next/link';

interface LimitlessMarketCardProps {
  market: LimitlessPredictionMarket;
  walletAddress?: string;
  onBetPlaced?: () => void;
}

// Category colors
const categoryColors: Record<string, { bg: string; text: string }> = {
  Crypto: { bg: 'from-orange-500 to-amber-500', text: 'text-orange-400' },
  Politics: { bg: 'from-blue-500 to-indigo-500', text: 'text-blue-400' },
  Economics: { bg: 'from-green-500 to-emerald-500', text: 'text-green-400' },
  Stocks: { bg: 'from-purple-500 to-pink-500', text: 'text-purple-400' },
  General: { bg: 'from-gray-500 to-slate-500', text: 'text-gray-400' },
};

export function LimitlessMarketCard({ market, walletAddress, onBetPlaced }: LimitlessMarketCardProps) {
  const { address: connectedAddress } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [isBetModalOpen, setIsBetModalOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<'Yes' | 'No' | null>(null);
  const [amount, setAmount] = useState('10');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(market.timeRemaining);

  // Countdown timer
  useEffect(() => {
    if (market.status !== 'active' || timeRemaining <= 0) return;
    const timer = setInterval(() => {
      setTimeRemaining(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [market.status, timeRemaining]);

  useEffect(() => {
    setTimeRemaining(market.timeRemaining);
  }, [market.timeRemaining]);

  const handleSubmit = async () => {
    if (!walletAddress) {
      setError('Please connect your wallet first');
      return;
    }

    if (!selectedPosition) {
      setError('Please select Yes or No');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum < 1 || amountNum > 1000) {
      setError('Amount must be between $1 and $1000');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    // Real tUSDC on Somnia - no simulate fallback
    try {
      const { parseUnits } = await import('viem');
      const { createPublicClient, http, fallback } = await import('viem');
      const { defineChain } = await import('viem');
      const { DREAMDEX_COPY_VAULT_ADDRESS, DREAMDEX_COPY_VAULT_ABI, SOMNIA_DREAMDEX, ERC20_ABI } = await import('@/lib/contracts');
      const address = connectedAddress || walletAddress;
      const wc: any = walletClient;
      if (!wc) throw new Error('Connect wallet with STT + tUSDC');
      const somniaTestnet = defineChain({ id: 50312, name: 'Somnia Shannon', nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 }, rpcUrls: { default: { http: ['https://dream-rpc.somnia.network'] } } });
      const publicClient: any = createPublicClient({ chain: somniaTestnet as any, transport: fallback([http('https://dream-rpc.somnia.network')]) });
      const amt = parseUnits(amount, 6);
      const bal: any = await publicClient.readContract({ address: SOMNIA_DREAMDEX.collateralTUSDC as any, abi: ERC20_ABI as any, functionName: 'balanceOf', args: [walletAddress] });
      if (bal < amt) throw new Error(`Insufficient tUSDC: have ${Number(bal)/1e6}, need ${amount}`);
      const allowance: any = await publicClient.readContract({ address: SOMNIA_DREAMDEX.collateralTUSDC as any, abi: ERC20_ABI as any, functionName: 'allowance', args: [walletAddress, DREAMDEX_COPY_VAULT_ADDRESS] });
      if (allowance < amt) {
        const hash = await wc.writeContract({ address: SOMNIA_DREAMDEX.collateralTUSDC as any, abi: ERC20_ABI as any, functionName: 'approve', args: [DREAMDEX_COPY_VAULT_ADDRESS, amt] });
        throw new Error(`Approved ${amount} tUSDC in ${String(hash).slice(0,10)}... - click Trade again to deposit`);
      }
      const hash = await wc.writeContract({ address: DREAMDEX_COPY_VAULT_ADDRESS, abi: DREAMDEX_COPY_VAULT_ABI as any, functionName: 'deposit', args: [amt] });
      setIsSubmitting(false);
      setSuccess(true);
      onSuccess?.();
      setTimeout(() => { setSuccess(false); setSelectedPosition(null); setAmount('10'); }, 1500);
      return;
    } catch (e: any) {
      setIsSubmitting(false);
      if (e.message.includes('Approved')) { setError(e.message); return; }
      setError(e.message || 'Real tUSDC vault failed');
      return;
    }

    try {
      const response = await fetch('/api/limitless/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          marketId: market.id,
          marketSlug: market.slug,
          marketQuestion: market.question,
          category: market.category,
          position: selectedPosition,
          amount: amount,
          priceAtEntry: selectedPosition === 'Yes' ? market.yesPrice : market.noPrice,
          expiresAt: market.expiresAt,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to place bet');
      }

      setSuccess(true);
      onBetPlaced?.();
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
      setSelectedPosition(null);
      setIsBetModalOpen(false);
    }
  };

  const formatVolume = (vol: number) => {
    if (vol >= 1000000) return `$${(vol / 1000000).toFixed(1)}M`;
    if (vol >= 1000) return `$${(vol / 1000).toFixed(0)}K`;
    return `$${vol.toFixed(0)}`;
  };

  const formatTime = () => {
    if (timeRemaining <= 0) return 'Expired';

    const hours = Math.floor(timeRemaining / 3600);
    const minutes = Math.floor((timeRemaining % 3600) / 60);

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d`;
    }

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }

    return `${minutes}m`;
  };

  const colors = categoryColors[market.category] || categoryColors.General;
  const yesPercent = market.probabilities[0];
  const noPercent = market.probabilities[1];

  const amountNum = parseFloat(amount) || 0;
  const selectedPrice = selectedPosition === 'Yes' ? market.yesPrice : market.noPrice;
  const potentialPayout = amountNum / selectedPrice;

  return (
    <>
      <Card className="group border-border/50 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 transition-all duration-300 overflow-hidden">
        <CardContent className="p-0">
          {/* Header */}
          <div className="px-4 py-3 flex items-center justify-between border-b border-border/30">
            <Badge variant="outline" className={`${colors.text} bg-transparent border-current/30`}>
              {market.category}
            </Badge>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              {formatTime()}
            </div>
          </div>

          {/* Question */}
          <div className="px-4 py-3">
            <p className="font-medium text-sm leading-tight line-clamp-2">{market.question}</p>
          </div>

          {/* Probability Bar */}
          <div className="px-4 pb-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-success font-medium">Yes {yesPercent.toFixed(0)}%</span>
              <span className="text-destructive font-medium">{noPercent.toFixed(0)}% No</span>
            </div>
            <div className="h-2.5 rounded-full overflow-hidden flex bg-muted/20">
              <div
                className="bg-gradient-to-r from-success to-emerald-400 transition-all duration-500"
                style={{ width: `${yesPercent}%` }}
              />
              <div
                className="bg-gradient-to-r from-rose-500 to-destructive transition-all duration-500"
                style={{ width: `${noPercent}%` }}
              />
            </div>
          </div>

          {/* Stats */}
          <div className="px-4 py-2 border-t border-border/30 flex items-center justify-between text-xs bg-muted/10">
            <div className="flex items-center gap-1">
              <BarChart3 className="w-3 h-3 text-muted-foreground" />
              <span className="text-muted-foreground">Vol:</span>
              <span className="font-medium">{formatVolume(market.volume)}</span>
            </div>
            <span className="text-muted-foreground">Liq: {formatVolume(market.liquidity)}</span>
          </div>

          {/* Action */}
          <div className="px-4 pb-4 pt-3 flex gap-2">
            <Button
              onClick={() => setIsBetModalOpen(true)}
              disabled={market.status !== 'active'}
              className="flex-1 h-10 font-semibold bg-gradient-to-r from-primary to-blue-500 hover:from-primary hover:to-blue-400 shadow-lg shadow-primary/25"
              size="sm"
            >
              <Zap className="w-4 h-4 mr-1.5" />
              Trade
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-10 w-10 p-0"
              onClick={() => window.open('https://limitless.exchange', '_blank')}
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bet Modal */}
      <Dialog open={isBetModalOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${colors.bg} flex items-center justify-center`}>
                <BarChart3 className="w-4 h-4 text-white" />
              </div>
              Limitless Market
            </DialogTitle>
            <DialogDescription>
              Trade on this prediction market
            </DialogDescription>
          </DialogHeader>

          {success ? (
            <div className="py-6 text-center space-y-4">
              <CheckCircle2 className="w-16 h-16 text-success mx-auto" />
              <div>
                <h3 className="text-lg font-semibold mb-1">Bet placed!</h3>
                <p className="text-sm text-muted-foreground">
                  Your <span className={selectedPosition === 'Yes' ? 'text-success' : 'text-destructive'}>{selectedPosition}</span> position has been recorded
                </p>
              </div>
              <div className="p-3 rounded-lg bg-surface border border-border/50 text-left">
                <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{market.question}</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Position:</span>
                    <span className={selectedPosition === 'Yes' ? 'text-success font-medium' : 'text-destructive font-medium'}>{selectedPosition}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount:</span>
                    <span className="font-mono">${amount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Entry price:</span>
                    <span className="font-mono">{(selectedPrice * 100).toFixed(0)}%</span>
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
                <Badge variant="outline" className="text-xs mb-2">{market.category}</Badge>
                <p className="font-medium text-sm">{market.question}</p>
                {market.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{market.description}</p>
                )}
              </div>

              {/* Position Selection */}
              <div className="space-y-2">
                <Label>Select outcome</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSelectedPosition('Yes')}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      selectedPosition === 'Yes'
                        ? 'border-success bg-success/10'
                        : 'border-border/50 hover:border-success/50'
                    }`}
                  >
                    <TrendingUp className={`w-6 h-6 mx-auto mb-1 ${selectedPosition === 'Yes' ? 'text-success' : 'text-muted-foreground'}`} />
                    <p className="font-bold text-success">Yes</p>
                    <p className="text-lg font-mono">{(market.yesPrice * 100).toFixed(0)}%</p>
                  </button>
                  <button
                    onClick={() => setSelectedPosition('No')}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      selectedPosition === 'No'
                        ? 'border-destructive bg-destructive/10'
                        : 'border-border/50 hover:border-destructive/50'
                    }`}
                  >
                    <TrendingDown className={`w-6 h-6 mx-auto mb-1 ${selectedPosition === 'No' ? 'text-destructive' : 'text-muted-foreground'}`} />
                    <p className="font-bold text-destructive">No</p>
                    <p className="text-lg font-mono">{(market.noPrice * 100).toFixed(0)}%</p>
                  </button>
                </div>
              </div>

              {/* Amount */}
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
                    className="pl-9"
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

              {/* Potential Payout */}
              {selectedPosition && amountNum > 0 && (
                <div className="p-3 rounded-lg bg-gradient-to-r from-success/5 to-primary/5 border border-success/20">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">If {selectedPosition} wins:</span>
                    <div className="text-right">
                      <p className="text-lg font-bold text-success">${potentialPayout.toFixed(2)}</p>
                      <p className="text-xs text-success/80">+${(potentialPayout - amountNum).toFixed(2)} profit</p>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !selectedPosition || !walletAddress || market.status !== 'active'}
                className="w-full"
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
                    Place traded bet
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
    </>
  );
}
