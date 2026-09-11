'use client';

import { useAccount } from 'wagmi';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PolymarketMarket } from '@/lib/polymarket';
import {
  TrendingUp,
  DollarSign,
  Clock,
  ExternalLink,
  BarChart3,
  Info,
  AlertCircle,
  Wallet,
} from 'lucide-react';

interface MarketDetailModalProps {
  market: PolymarketMarket | null;
  isOpen: boolean;
  onClose: () => void;
}

export function MarketDetailModal({ market, isOpen, onClose }: MarketDetailModalProps) {
  const { isConnected, address } = useAccount();

  if (!market) return null;

  // Parse outcomes and prices (API may return them as JSON strings)
  const outcomes = typeof market.outcomes === 'string' ? JSON.parse(market.outcomes) : market.outcomes;
  const prices = typeof market.outcomePrices === 'string' ? JSON.parse(market.outcomePrices) : market.outcomePrices;

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) {
      return `$${(volume / 1000000).toFixed(2)}M`;
    }
    if (volume >= 1000) {
      return `$${(volume / 1000).toFixed(1)}K`;
    }
    return `$${volume.toFixed(0)}`;
  };

  const probabilities = Array.isArray(prices) ? prices.map(price => parseFloat(price) * 100) : [];

  const getProbabilityColor = (probability: number) => {
    if (probability >= 70) return 'text-green-500';
    if (probability >= 50) return 'text-yellow-500';
    if (probability >= 30) return 'text-orange-500';
    return 'text-red-500';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gradient-to-b from-surface-raised to-surface border-border/50">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold pr-8 leading-tight">
            {market.question}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status Badges */}
          <div className="flex flex-wrap gap-2">
            {market.active && (
              <Badge className="bg-success/15 text-success border-success/30 font-medium">
                <span className="relative flex h-2 w-2 mr-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                </span>
                Active
              </Badge>
            )}
            {market.closed && (
              <Badge className="bg-muted/50 text-muted-foreground border-muted font-medium">
                Closed
              </Badge>
            )}
            {market.negRisk && (
              <Badge className="bg-warning/15 text-warning border-warning/30 font-medium">
                <AlertCircle className="w-3 h-3 mr-1" />
                Negative Risk
              </Badge>
            )}
            {market.acceptingOrders && (
              <Badge className="bg-primary/15 text-primary border-primary/30 font-medium">
                Accepting Orders
              </Badge>
            )}
          </div>

          {/* Description */}
          {market.description && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <div className="w-6 h-6 rounded-lg bg-muted/50 flex items-center justify-center">
                  <Info className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                Description
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{market.description}</p>
            </div>
          )}

          <Separator />

          {/* Outcomes */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <div className="w-6 h-6 rounded-lg bg-primary/20 flex items-center justify-center">
                <BarChart3 className="w-3.5 h-3.5 text-primary" />
              </div>
              Market Outcomes
            </div>
            {(Array.isArray(outcomes) ? outcomes : []).map((outcome: any, index) => {
              const probability = probabilities[index];
              const outcomeStr = typeof outcome === 'string' ? outcome : outcome?.label || outcome?.name || String(outcome);
              const isYes = outcomeStr.toLowerCase() === 'yes';
              const isNo = outcomeStr.toLowerCase() === 'no';
              const bgColor = isYes ? 'from-success/10 to-success/5' : isNo ? 'from-destructive/10 to-destructive/5' : 'from-primary/10 to-primary/5';
              const borderColor = isYes ? 'border-success/20' : isNo ? 'border-destructive/20' : 'border-primary/20';
              const barColor = isYes ? 'bg-gradient-to-r from-success to-emerald-400' : isNo ? 'bg-gradient-to-r from-destructive to-rose-400' : 'bg-gradient-to-r from-primary to-blue-400';

              return (
                <div key={index} className={`p-4 rounded-xl bg-gradient-to-br ${bgColor} border ${borderColor} space-y-3`}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-lg">{outcome}</span>
                    <span className={`text-3xl font-bold ${getProbabilityColor(probability)}`}>
                      {probability.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-3 rounded-full overflow-hidden bg-muted/30">
                    <div
                      className={`h-full ${barColor} transition-all duration-500 relative`}
                      style={{ width: `${probability}%` }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Current probability based on market prices
                  </p>
                </div>
              );
            })}
          </div>

          <Separator />

          {/* Market Statistics */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <div className="w-6 h-6 rounded-lg bg-secondary/20 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-secondary" />
              </div>
              Market Statistics
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-gradient-to-br from-surface to-surface-raised border border-border/30">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-success/15 flex items-center justify-center">
                    <DollarSign className="w-4 h-4 text-success" />
                  </div>
                  <span className="text-sm text-muted-foreground">Total Volume</span>
                </div>
                <p className="text-2xl font-bold text-success">{formatVolume(market.volumeNum)}</p>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-br from-surface to-surface-raised border border-border/30">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm text-muted-foreground">Liquidity</span>
                </div>
                <p className="text-2xl font-bold text-primary">{formatVolume(market.liquidityNum)}</p>
              </div>
            </div>
          </div>

          {/* Dates */}
          {(market.endDate || market.gameStartTime) && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <div className="w-6 h-6 rounded-lg bg-warning/20 flex items-center justify-center">
                    <Clock className="w-3.5 h-3.5 text-warning" />
                  </div>
                  Timeline
                </div>
                <div className="p-3 rounded-xl bg-muted/10 border border-border/30 space-y-2">
                  {market.gameStartTime && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Start Time</span>
                      <span className="font-medium font-mono text-xs bg-muted/30 px-2 py-1 rounded">
                        {new Date(market.gameStartTime).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {market.endDate && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">End Date</span>
                      <span className="font-medium font-mono text-xs bg-warning/20 text-warning px-2 py-1 rounded">
                        {new Date(market.endDate).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Tags */}
          {market.tags && market.tags.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="text-sm font-semibold">Tags</div>
                <div className="flex flex-wrap gap-2">
                  {market.tags.map((tag, index) => (
                    <Badge key={index} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="space-y-3 pt-4">
            {isConnected && (
              <Alert className="border-blue-500/50 bg-blue-500/10">
                <Wallet className="h-4 w-4 text-blue-400" />
                <AlertDescription className="text-blue-300">
                  Wallet connected: {address?.slice(0, 6)}...{address?.slice(-4)}
                  <br />
                  <span className="text-xs">Connect your wallet on Polymarket to trade with the same address</span>
                </AlertDescription>
              </Alert>
            )}

            <Button
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 h-12 text-lg font-semibold"
              onClick={() => window.open(`https://polymarket.com/event/${market.marketSlug}`, '_blank', 'noopener,noreferrer')}
            >
              <ExternalLink className="w-5 h-5 mr-2" />
              Trade on Polymarket
            </Button>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs space-y-1">
                <p>🔗 Direct link to this specific market</p>
                <p>💼 Connect your wallet on Polymarket to place bets</p>
                <p>📊 Polymarket uses Polygon network (USDC)</p>
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
