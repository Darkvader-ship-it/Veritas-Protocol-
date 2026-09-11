'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PolymarketMarket } from '@/lib/polymarket';
import { ExternalLink, Zap } from 'lucide-react';

interface MarketCardProps {
  market: PolymarketMarket;
  onSelect?: (market: PolymarketMarket) => void;
  onSimulate?: (market: PolymarketMarket) => void;
  showActions?: boolean;
}

function getPolymarketUrl(market: PolymarketMarket): string {
  // Try event slug first (most reliable for multi-outcome events)
  if (market.events && market.events.length > 0 && market.events[0].slug) {
    return `https://polymarket.com/event/${market.events[0].slug}`;
  }

  // Try conditionId for individual markets
  if (market.conditionId) {
    return `https://polymarket.com/market/${market.conditionId}`;
  }

  // Fallback to marketSlug
  if (market.marketSlug) {
    return `https://polymarket.com/event/${market.marketSlug}`;
  }

  // Last resort: use questionID (might be unreliable)
  if (market.questionID) {
    return `https://polymarket.com/event/${market.questionID}`;
  }

  // Ultimate fallback
  return 'https://polymarket.com';
}

export function MarketCard({ market, onSelect, onSimulate, showActions = true }: MarketCardProps) {
  const outcomes = typeof market.outcomes === 'string' ? JSON.parse(market.outcomes) : market.outcomes;
  const prices = typeof market.outcomePrices === 'string' ? JSON.parse(market.outcomePrices) : market.outcomePrices;
  const probabilities = Array.isArray(prices) ? prices.map(price => parseFloat(price) * 100) : [];

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) return `$${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `$${(volume / 1000).toFixed(0)}K`;
    return `$${volume.toFixed(0)}`;
  };

  const openPolymarket = () => {
    window.open(getPolymarketUrl(market), '_blank');
  };

  // Get the two main outcomes (Yes/No or first two)
  const yesProb = probabilities[0] || 0;
  const noProb = probabilities[1] || (100 - yesProb);

  const statusBadge = () => {
    if (market.archived) return <Badge variant="outline" className="text-[10px] bg-muted/20">ARCHIVED</Badge>;
    if (market.closed) return <Badge variant="outline" className="text-[10px] bg-info/20 text-info">CLOSED</Badge>;
    if (market.active) return <Badge className="text-[10px] bg-success text-white">LIVE</Badge>;
    return null;
  };

  return (
    <Card
      className="border-border/50 hover:border-primary/30 transition-colors cursor-pointer"
      onClick={openPolymarket}
    >
      <CardContent className="p-0">
        {/* Header */}
        <div className="p-4 pb-3">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-medium text-sm line-clamp-2 flex-1 leading-tight">{market.question}</h3>
            {statusBadge()}
          </div>

          {/* Yes/No Split Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-success font-medium">Yes {yesProb.toFixed(0)}%</span>
              <span className="text-destructive font-medium">{noProb.toFixed(0)}% No</span>
            </div>
            <div className="h-2.5 rounded-full overflow-hidden flex bg-muted/30">
              <div
                className="bg-success transition-all duration-300"
                style={{ width: `${yesProb}%` }}
              />
              <div
                className="bg-destructive transition-all duration-300"
                style={{ width: `${noProb}%` }}
              />
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="px-4 py-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{formatVolume(market.volumeNum)} vol</span>
          <span>{formatVolume(market.liquidityNum)} liq</span>
          {market.endDate && (
            <span>{new Date(market.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          )}
        </div>

        {/* Actions */}
        {showActions && (
          <div className="px-4 pb-4 pt-2 flex gap-2">
            {onSimulate && (
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  onSimulate(market);
                }}
                size="sm"
                className="flex-1 h-8 text-xs bg-primary hover:bg-primary/90"
              >
                <Zap className="w-3 h-3 mr-1.5" />
                Trade (tUSDC)
              </Button>
            )}
            {onSelect && (
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(market);
                }}
                variant="outline"
                size="sm"
                className="flex-1 h-8 text-xs"
              >
                Details
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                openPolymarket();
              }}
            >
              <ExternalLink className="w-3 h-3" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
