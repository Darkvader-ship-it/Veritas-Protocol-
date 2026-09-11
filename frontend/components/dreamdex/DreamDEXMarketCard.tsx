'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, TrendingUp, Droplets } from 'lucide-react';
import type { DreamDEXMarket } from '@/lib/dreamdex';

interface Props {
  market: DreamDEXMarket;
  isSelected?: boolean;
  onSelect: (m: DreamDEXMarket) => void;
}

function formatCountdown(expiresAt: number): string {
  const diff = expiresAt - Date.now();
  if (diff <= 0) return 'Expired';
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}

export function DreamDEXMarketCard({ market, isSelected, onSelect }: Props) {
  const upPct = (market.yesPrice * 100).toFixed(1);
  const downPct = (market.noPrice * 100).toFixed(1);
  const isTrading = market.status === 'Trading' && market.active;

  return (
    <Card
      onClick={() => onSelect(market)}
      className={`cursor-pointer transition-all hover:border-fuchsia-500/50 border-border/50 ${isSelected ? 'ring-2 ring-fuchsia-500 border-fuchsia-500/50' : ''}`}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-sm leading-tight line-clamp-2 flex-1">{market.question}</h3>
          <Badge variant={isTrading ? 'default' : 'secondary'} className={isTrading ? 'bg-green-500 text-white text-xs' : 'text-xs'}>
            {market.status}
          </Badge>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" />{market.asset}</span>
          <span>•</span>
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatCountdown(market.expiresAt)}</span>
          <span>•</span>
          <span className="flex items-center gap-1"><Droplets className="w-3 h-3" />{market.volume.toFixed(2)} tUSDC</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className={`rounded-lg p-2 text-center border ${isTrading ? 'bg-green-500/10 border-green-500/30' : 'bg-muted'}`}>
            <div className="text-xs text-muted-foreground">Up</div>
            <div className="font-bold text-green-600">{upPct}%</div>
            <div className="text-xs font-mono">{market.yesPrice.toFixed(4)} ¢</div>
          </div>
          <div className={`rounded-lg p-2 text-center border ${isTrading ? 'bg-red-500/10 border-red-500/30' : 'bg-muted'}`}>
            <div className="text-xs text-muted-foreground">Down</div>
            <div className="font-bold text-red-600">{downPct}%</div>
            <div className="text-xs font-mono">{market.noPrice.toFixed(4)} ¢</div>
          </div>
        </div>

        <div className="text-xs font-mono text-muted-foreground truncate">ID {market.marketId.slice(0, 10)}... • {market.symbol}</div>
      </CardContent>
    </Card>
  );
}
