'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { ChevronUp, ChevronDown, Sparkles, ExternalLink, X } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { shortenAddress, formatNumber } from '@/components/ui/design-tokens';

interface TraderData {
  address: string;
  username?: string;
  veritasScore: number;
  winRate: number;
  totalBets: number;
}

interface LiveTopTraderWidgetProps {
  className?: string;
  /** Optional label type - 'live' (default), 'featured', or 'sponsored' */
  labelType?: 'live' | 'featured' | 'sponsored';
}

const LABEL_CONFIG = {
  live: { text: 'Live', bg: 'bg-secondary/20', color: 'text-secondary', border: 'border-secondary/30' },
  featured: { text: 'Featured', bg: 'bg-primary/20', color: 'text-primary', border: 'border-primary/30' },
  sponsored: { text: 'Sponsored', bg: 'bg-purple-500/20', color: 'text-purple-400', border: 'border-purple-500/30' },
};

export function LiveTopTraderWidget({ className, labelType = 'live' }: LiveTopTraderWidgetProps) {
  const labelConfig = LABEL_CONFIG[labelType];
  const [isExpanded, setIsExpanded] = useState(false);
  const [trader, setTrader] = useState<TraderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
    const wasDismissed = localStorage.getItem('topTraderWidgetDismissed');
    if (wasDismissed === 'true') {
      setDismissed(true);
    }
  }, []);

  // Fetch top trader from our own (DreamDEX) leaderboard
  useEffect(() => {
    async function fetchTopTrader() {
      try {
        const res = await fetch('/api/dreamdex-leaderboard?limit=1');
        const data = await res.json();
        if (data.success && data.data?.[0]) {
          setTrader(data.data[0]);
        }
      } catch (error) {
        // No fallback — hide until there's a real trader
      }
      setLoading(false);
    }
    fetchTopTrader();
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('topTraderWidgetDismissed', 'true');
  };

  // Don't render until mounted (prevents hydration issues)
  if (!mounted || loading || !trader || dismissed) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50 hidden md:block transition-all duration-300 ease-out",
        className
      )}
    >
      {/* Collapsed State */}
      {!isExpanded && (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsExpanded(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-full bg-surface/95 backdrop-blur-xl border border-border/50 shadow-lg hover:shadow-xl hover:border-primary/30 transition-all group"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
              {trader.username?.[0] || '?'}
            </div>
            <span className="font-medium text-sm leading-none">{trader.username || shortenAddress(trader.address)}</span>
            <Badge className={`${labelConfig.bg} ${labelConfig.color} ${labelConfig.border} text-[10px] font-semibold px-1.5 py-0 leading-none`}>
              {labelConfig.text}
            </Badge>
            <ChevronUp className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
          </button>
          {/* Dismiss button */}
          <button
            onClick={handleDismiss}
            className="flex items-center justify-center w-7 h-7 rounded-full bg-surface/95 backdrop-blur-xl border border-border/50 shadow-lg hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive transition-all"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Expanded State */}
      {isExpanded && (
        <div className="w-72 rounded-2xl bg-surface/95 backdrop-blur-xl border border-border/50 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2 duration-300">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Sparkles className={`w-3.5 h-3.5 ${labelConfig.color}`} />
              <span className="text-xs">Top Trader</span>
              <span className={`px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider rounded ${labelConfig.bg} ${labelConfig.color}`}>
                {labelConfig.text}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleDismiss}
                className="p-1 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
              </button>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1 rounded-lg hover:bg-white/5 transition-colors"
              >
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Trader Info */}
          <div className="p-3">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-base font-bold text-white">
                {trader.username?.[0] || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm truncate">{trader.username || 'Anonymous'}</h4>
                <p className="text-[11px] text-muted-foreground">
                  #1 on leaderboard
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="text-center p-2 rounded-lg bg-white/5">
                <p className="text-sm font-bold text-secondary">{trader.veritasScore}</p>
                <p className="text-[9px] text-muted-foreground">Score</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-white/5">
                <p className="text-sm font-bold text-success">{trader.winRate}%</p>
                <p className="text-[9px] text-muted-foreground">Win Rate</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-white/5">
                <p className="text-sm font-bold">{formatNumber(trader.totalBets)}</p>
                <p className="text-[9px] text-muted-foreground">Bets</p>
              </div>
            </div>

            {/* CTA */}
            <Link
              href={`/trader/${trader.address}`}
              className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
            >
              View Profile
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
