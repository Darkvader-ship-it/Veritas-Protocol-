'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Trophy,
  TrendingUp,
  ArrowRight,
  Shield,
  CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { shortenAddress, formatNumber, TIER_STYLES, getTierFromScore } from '@/components/ui/design-tokens';

interface TraderData {
  address: string;
  username?: string;
  veritasScore: number;
  winRate: number;
  totalBets: number;
}

interface PlatformConfig {
  id: string;
  name: string;
  icon: string;
  gradient: string;
}

const PLATFORMS: PlatformConfig[] = [
  { id: 'dreamdex', name: 'DreamDEX', icon: '🥞', gradient: 'from-amber-500 to-orange-500' },
  { id: 'azuro', name: 'Azuro', icon: '🎯', gradient: 'from-cyan-500 to-teal-500' },
  { id: 'sxbet', name: 'SX Bet', icon: '🎰', gradient: 'from-green-500 to-emerald-500' },
];

const getTierInfo = (score: number) => {
  if (score >= 900) return { name: 'Diamond', bg: 'bg-cyan-500', gradient: 'from-cyan-400 to-blue-500' };
  if (score >= 650) return { name: 'Platinum', bg: 'bg-slate-300', gradient: 'from-slate-300 to-slate-500' };
  if (score >= 400) return { name: 'Gold', bg: 'bg-amber-500', gradient: 'from-amber-400 to-yellow-500' };
  if (score >= 200) return { name: 'Silver', bg: 'bg-gray-400', gradient: 'from-gray-300 to-gray-500' };
  return { name: 'Bronze', bg: 'bg-orange-700', gradient: 'from-orange-600 to-amber-700' };
};

function TraderCard({ trader, rank }: { trader: TraderData; rank: number }) {
  const tier = getTierInfo(trader.veritasScore);

  return (
    <div className="relative group">
      {/* Rank badge */}
      <div className={cn(
        "absolute -top-2 -left-2 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold z-10",
        rank === 1 ? "bg-gradient-to-br from-amber-400 to-yellow-600 text-white shadow-lg shadow-amber-500/30" :
        rank === 2 ? "bg-gradient-to-br from-slate-300 to-slate-500 text-white" :
        "bg-gradient-to-br from-orange-600 to-amber-700 text-white"
      )}>
        #{rank}
      </div>

      <div className="rounded-2xl border border-border/50 bg-surface/50 backdrop-blur-sm p-4 sm:p-5 hover:border-primary/30 hover:bg-surface/80 transition-all duration-200 group-hover:shadow-lg">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className={cn(
            "w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center text-lg font-bold text-white",
            tier.gradient
          )}>
            {trader.username?.[0] || trader.address?.slice(2, 4).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold truncate">{trader.username || shortenAddress(trader.address)}</h4>
            <Badge className={cn("text-[10px]", tier.bg, "text-white")}>
              {tier.name}
            </Badge>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-2 rounded-lg bg-white/5">
            <p className="text-lg font-bold text-secondary">{trader.veritasScore}</p>
            <p className="text-[10px] text-muted-foreground">Score</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-white/5">
            <p className="text-lg font-bold text-success">{trader.winRate.toFixed(1)}%</p>
            <p className="text-[10px] text-muted-foreground">Win Rate</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-white/5">
            <p className="text-lg font-bold">{formatNumber(trader.totalBets)}</p>
            <p className="text-[10px] text-muted-foreground">Bets</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LiveLeaderboardPreview() {
  const [traders, setTraders] = useState<TraderData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTopTraders() {
      try {
        const res = await fetch('/api/dreamdex-leaderboard?limit=3');
        const data = await res.json();
        if (data.success && data.data?.length > 0) {
          setTraders(data.data.slice(0, 3));
        }
      } catch (error) {
        // No fallback — show the empty state until a real trader exists
      }
      setLoading(false);
    }
    fetchTopTraders();
  }, []);

  return (
    <section className="py-16 sm:py-20 md:py-24 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-surface/30 to-background" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[150px]" />

      <div className="container px-5 md:px-6 relative z-10">
        <div className="max-w-5xl mx-auto">
          {/* Section header */}
          <div className="text-center mb-10 sm:mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 border border-success/20 text-success text-xs sm:text-sm font-medium mb-4">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Verified on-chain
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3">
              Live from the leaderboard
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Real traders. Real stats. Every prediction verified on the blockchain.
            </p>
          </div>

          {/* Trader cards */}
          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-[180px] rounded-2xl" />
              ))}
            </div>
          ) : traders.length === 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-dashed border-border/50 bg-surface/30 p-5 flex items-center justify-center min-h-[180px] text-center"
                >
                  <div>
                    <Trophy className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-30" />
                    <p className="text-sm text-muted-foreground">No traders yet</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Be the first — place a trade in the DreamDEX Terminal.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
              {traders.map((trader, idx) => (
                <TraderCard key={trader.address} trader={trader} rank={idx + 1} />
              ))}
            </div>
          )}

          {/* Platform logos */}
          <div className="text-center mb-8">
            <p className="text-sm text-muted-foreground mb-4">Tracking traders across 3 prediction markets</p>
            <div className="flex flex-wrap justify-center gap-3">
              {PLATFORMS.map((platform) => (
                <div
                  key={platform.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-full bg-surface/80 border border-border/50 hover:border-primary/30 transition-colors"
                >
                  <span className="text-lg">{platform.icon}</span>
                  <span className="text-sm font-medium hidden sm:inline">{platform.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
            <Link href="/leaderboard">
              <Button size="lg" variant="outline" className="h-12 px-8 gap-2">
                Explore full leaderboard
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
