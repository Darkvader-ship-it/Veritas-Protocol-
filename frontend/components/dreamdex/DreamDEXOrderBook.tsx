'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface OrderBookProps {
  bids: [number, number][];
  asks: [number, number][];
  mid: number;
  spread: number;
  imbalance: number;
  symbol: string;
  isLoading?: boolean;
}

export function DreamDEXOrderBook({ bids, asks, mid, spread, imbalance, symbol, isLoading }: OrderBookProps) {
  const spreadBps = mid > 0 ? (spread / mid) * 10000 : 0;

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Order Book — {symbol}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">Loading book...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Order Book</CardTitle>
          <Badge variant="outline" className="text-xs">{symbol}</Badge>
        </div>
        <div className="flex gap-2 text-xs text-muted-foreground">
          <span>Mid {mid.toFixed(4)}</span>
          <span>•</span>
          <span>Spread {(spreadBps).toFixed(1)} bps</span>
          <span>•</span>
          <span className={imbalance > 0 ? 'text-green-500' : imbalance < 0 ? 'text-red-500' : ''}>
            Imb {(imbalance * 100).toFixed(1)}%
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Asks (red) — reverse so best ask at bottom near spread */}
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground flex justify-between px-1">
            <span>Ask</span><span>Size</span><span>Total</span>
          </div>
          {asks.slice().reverse().map(([price, size], i) => {
            const total = asks.slice().reverse().slice(0, i + 1).reduce((a, [, s]) => a + s, 0);
            return (
              <div key={`ask-${i}`} className="grid grid-cols-3 text-xs font-mono bg-red-500/10 px-1 py-0.5 rounded">
                <span className="text-red-500">{price.toFixed(4)}</span>
                <span className="text-right">{size.toFixed(2)}</span>
                <span className="text-right text-muted-foreground">{total.toFixed(2)}</span>
              </div>
            );
          })}
          {asks.length === 0 && <div className="text-xs text-muted-foreground text-center py-2">No asks</div>}
        </div>

        {/* Spread */}
        <div className="text-center py-1 text-xs font-mono border-y border-border/50">
          Spread {spread.toFixed(4)} ({spreadBps.toFixed(1)} bps) • Mid {mid.toFixed(4)}
        </div>

        {/* Bids (green) */}
        <div className="space-y-1">
          {bids.map(([price, size], i) => {
            const total = bids.slice(0, i + 1).reduce((a, [, s]) => a + s, 0);
            return (
              <div key={`bid-${i}`} className="grid grid-cols-3 text-xs font-mono bg-green-500/10 px-1 py-0.5 rounded">
                <span className="text-green-500">{price.toFixed(4)}</span>
                <span className="text-right">{size.toFixed(2)}</span>
                <span className="text-right text-muted-foreground">{total.toFixed(2)}</span>
              </div>
            );
          })}
          {bids.length === 0 && <div className="text-xs text-muted-foreground text-center py-2">No bids</div>}
        </div>
      </CardContent>
    </Card>
  );
}
