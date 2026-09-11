'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SXBetMarket } from '@/lib/sxbet';
import { SXBetTradeBetModal as SXBetSimulateBetModal } from './SXBetSimulateBetModal';
import {
  ExternalLink,
  Zap,
  Clock,
  Trophy,
  Target,
  Swords,
  Users,
  Timer,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

interface SXBetMarketCardProps {
  market: SXBetMarket;
  walletAddress?: string;
  onBetPlaced?: () => void;
}

// Sport icons and colors
const sportStyles: Record<string, { icon: typeof Trophy; color: string; bg: string }> = {
  'Soccer': { icon: Trophy, color: 'text-emerald-400', bg: 'from-emerald-500 to-green-600' },
  'Football': { icon: Target, color: 'text-orange-400', bg: 'from-orange-500 to-amber-600' },
  'Basketball': { icon: Trophy, color: 'text-orange-400', bg: 'from-orange-500 to-red-600' },
  'Baseball': { icon: Trophy, color: 'text-red-400', bg: 'from-red-500 to-rose-600' },
  'Hockey': { icon: Target, color: 'text-blue-400', bg: 'from-blue-500 to-cyan-600' },
  'Tennis': { icon: Trophy, color: 'text-lime-400', bg: 'from-lime-500 to-green-600' },
  'MMA': { icon: Swords, color: 'text-red-400', bg: 'from-red-600 to-rose-700' },
  'Boxing': { icon: Swords, color: 'text-red-400', bg: 'from-red-600 to-rose-700' },
  'Esports': { icon: Users, color: 'text-purple-400', bg: 'from-purple-500 to-indigo-600' },
  'default': { icon: Trophy, color: 'text-emerald-400', bg: 'from-emerald-500 to-teal-600' },
};

// Market type display names
const marketTypeLabels: Record<string, string> = {
  'Moneyline': 'Moneyline',
  'Spread': 'Spread',
  'Total': 'Over/Under',
  'moneyline': 'Moneyline',
  'spread': 'Spread',
  'total': 'Over/Under',
};

export function SXBetMarketCard({ market, walletAddress, onBetPlaced }: SXBetMarketCardProps) {
  const [isBetModalOpen, setIsBetModalOpen] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);

  useEffect(() => {
    const now = Math.floor(Date.now() / 1000);
    setTimeRemaining(Math.max(0, market.gameTime - now));
  }, [market.gameTime]);

  // Live countdown timer
  useEffect(() => {
    if (timeRemaining <= 0) return;
    const timer = setInterval(() => {
      setTimeRemaining(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [timeRemaining]);

  const formatTime = () => {
    if (timeRemaining <= 0) return 'Starting...';

    const hours = Math.floor(timeRemaining / 3600);
    const minutes = Math.floor((timeRemaining % 3600) / 60);

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }

    const seconds = timeRemaining % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const sportStyle = sportStyles[market.sport] || sportStyles['default'];
  const SportIcon = sportStyle.icon;

  const isLive = market.status?.toLowerCase() === 'live';
  const canBet = ['active', 'upcoming', 'live', 'open'].includes(market.status?.toLowerCase() || '') || !market.status;

  const statusStyles: Record<string, string> = {
    active: 'bg-primary/20 text-primary border-primary/30',
    upcoming: 'bg-primary/20 text-primary border-primary/30',
    live: 'bg-success/20 text-success border-success/30',
    ended: 'bg-muted/50 text-muted-foreground border-muted',
    cancelled: 'bg-destructive/20 text-destructive border-destructive/30',
  };

  const marketType = market.type?.toLowerCase() || 'moneyline';

  return (
    <Card className={`group relative border-border/50 transition-all duration-300 overflow-hidden ${
      isLive
        ? 'hover:border-success/50 hover:shadow-lg hover:shadow-success/10'
        : canBet
        ? 'hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/10'
        : 'hover:border-border'
    }`}>
      {/* Live indicator glow */}
      {isLive && (
        <div className="absolute inset-0 bg-gradient-to-b from-success/5 to-transparent pointer-events-none" />
      )}

      <CardContent className="p-0 relative">
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-border/30">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${sportStyle.bg} flex items-center justify-center shadow-lg`}>
              <SportIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">{market.league}</p>
              <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">{market.sport}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
              {marketTypeLabels[market.type] || market.type}
            </Badge>
            {isLive && (
              <Badge variant="outline" className="bg-success/20 text-success border-success/30 text-[10px] px-1.5 py-0">
                <span className="relative flex h-1.5 w-1.5 mr-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success"></span>
                </span>
                LIVE
              </Badge>
            )}
          </div>
        </div>

        {/* Teams/Matchup */}
        <div className="px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 text-center">
              <p className="font-semibold text-sm truncate">{market.teamOne}</p>
              <p className="text-lg font-bold text-success font-mono">{market.outcomeOne}</p>
              {marketType === 'spread' && market.line !== undefined && (
                <p className="text-[10px] text-muted-foreground">
                  {market.line > 0 ? '+' : ''}{market.line}
                </p>
              )}
            </div>

            <div className="flex flex-col items-center px-2">
              <span className="text-xs text-muted-foreground font-medium">VS</span>
              {marketType === 'total' && market.line !== undefined && (
                <div className="flex flex-col items-center mt-1">
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-success" />
                    <span className="text-[10px] text-muted-foreground">O</span>
                  </div>
                  <span className="text-xs font-mono">{market.line}</span>
                  <div className="flex items-center gap-1">
                    <TrendingDown className="w-3 h-3 text-destructive" />
                    <span className="text-[10px] text-muted-foreground">U</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 text-center">
              <p className="font-semibold text-sm truncate">{market.teamTwo}</p>
              <p className="text-lg font-bold text-destructive font-mono">{market.outcomeTwo}</p>
              {marketType === 'spread' && market.line !== undefined && (
                <p className="text-[10px] text-muted-foreground">
                  {-market.line > 0 ? '+' : ''}{-market.line}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Time Info */}
        <div className="px-4 py-2.5 border-t border-border/30 flex items-center justify-between text-xs bg-muted/10">
          <div className="flex items-center gap-1.5">
            {isLive ? (
              <Timer className="w-3.5 h-3.5 text-success" />
            ) : (
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            )}
            <span className={isLive ? 'text-success font-medium' : 'text-muted-foreground'}>
              {isLive ? 'In Progress' : formatTime()}
            </span>
          </div>
          <span className="text-muted-foreground">
            {new Date(market.gameTime * 1000).toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </div>

        {/* Action */}
        <div className="px-4 pb-4 pt-3 flex gap-2">
          <Button
            onClick={() => setIsBetModalOpen(true)}
            disabled={!canBet}
            className={`flex-1 h-10 font-semibold transition-all ${
              canBet
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 shadow-lg shadow-emerald-500/25'
                : ''
            }`}
            size="sm"
          >
            {canBet ? (
              <>
                <Zap className="w-4 h-4 mr-1.5" />
                Trade (tUSDC)
              </>
            ) : (
              'Ended'
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-10 w-10 p-0"
            onClick={() => window.open('https://sx.bet', '_blank')}
          >
            <ExternalLink className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>

      <SXBetSimulateBetModal
        market={market}
        isOpen={isBetModalOpen}
        onClose={() => setIsBetModalOpen(false)}
        walletAddress={walletAddress}
        onSuccess={onBetPlaced}
      />
    </Card>
  );
}
