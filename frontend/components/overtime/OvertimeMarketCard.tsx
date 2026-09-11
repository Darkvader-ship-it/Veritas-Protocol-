'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { OvertimePredictionMarket, OVERTIME_SPORTS } from '@/lib/overtime';
import { OvertimeSimulateBetModal } from './OvertimeSimulateBetModal';
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
} from 'lucide-react';

interface OvertimeMarketCardProps {
  market: OvertimePredictionMarket;
  walletAddress?: string;
  onBetPlaced?: () => void;
}

// Sport icons and colors
const sportStyles: Record<number, { icon: typeof Trophy; color: string; bg: string }> = {
  [OVERTIME_SPORTS.SOCCER]: { icon: Trophy, color: 'text-emerald-400', bg: 'from-emerald-500 to-green-600' },
  [OVERTIME_SPORTS.FOOTBALL]: { icon: Target, color: 'text-orange-400', bg: 'from-orange-500 to-amber-600' },
  [OVERTIME_SPORTS.BASKETBALL]: { icon: Trophy, color: 'text-orange-400', bg: 'from-orange-500 to-red-600' },
  [OVERTIME_SPORTS.HOCKEY]: { icon: Target, color: 'text-blue-400', bg: 'from-blue-500 to-cyan-600' },
  [OVERTIME_SPORTS.BASEBALL]: { icon: Trophy, color: 'text-red-400', bg: 'from-red-500 to-rose-600' },
  [OVERTIME_SPORTS.TENNIS]: { icon: Trophy, color: 'text-lime-400', bg: 'from-lime-500 to-green-600' },
  [OVERTIME_SPORTS.MMA]: { icon: Swords, color: 'text-red-400', bg: 'from-red-600 to-rose-700' },
  [OVERTIME_SPORTS.ESPORTS]: { icon: Users, color: 'text-purple-400', bg: 'from-purple-500 to-indigo-600' },
};

export function OvertimeMarketCard({ market, walletAddress, onBetPlaced }: OvertimeMarketCardProps) {
  const [isBetModalOpen, setIsBetModalOpen] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(market.timeRemaining);

  // Live countdown timer
  useEffect(() => {
    if (market.status !== 'upcoming' || timeRemaining <= 0) return;
    const timer = setInterval(() => {
      setTimeRemaining(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [market.status, timeRemaining]);

  useEffect(() => {
    setTimeRemaining(market.timeRemaining);
  }, [market.timeRemaining]);

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

  const formatOdds = (decimal: number) => {
    return decimal.toFixed(2);
  };

  const sportStyle = sportStyles[market.sportId] || sportStyles[OVERTIME_SPORTS.SOCCER];
  const SportIcon = sportStyle.icon;

  const isLive = market.isLive;
  const canBet = market.status === 'upcoming' || market.status === 'live';

  const statusStyles: Record<string, string> = {
    upcoming: 'bg-primary/20 text-primary border-primary/30',
    live: 'bg-success/20 text-success border-success/30',
    ended: 'bg-muted/50 text-muted-foreground border-muted',
    cancelled: 'bg-destructive/20 text-destructive border-destructive/30',
  };

  return (
    <Card className={`group relative border-border/50 transition-all duration-300 overflow-hidden ${
      isLive
        ? 'hover:border-success/50 hover:shadow-lg hover:shadow-success/10'
        : canBet
        ? 'hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10'
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
              <p className="text-xs text-muted-foreground font-medium">{market.leagueName}</p>
              <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">{market.sportName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isLive && (
              <Badge variant="outline" className="bg-success/20 text-success border-success/30 text-[10px] px-1.5 py-0">
                <span className="relative flex h-1.5 w-1.5 mr-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success"></span>
                </span>
                LIVE
              </Badge>
            )}
            <Badge variant="outline" className={`${statusStyles[String(market.status)]} text-[10px] font-medium`}>
              {String(market.status).charAt(0).toUpperCase() + String(market.status).slice(1)}
            </Badge>
          </div>
        </div>

        {/* Teams/Matchup */}
        <div className="px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 text-center">
              <p className="font-semibold text-sm truncate">{market.homeTeam}</p>
              <p className="text-lg font-bold text-success font-mono">{formatOdds(market.odds[0])}</p>
              <p className="text-[10px] text-muted-foreground">{market.probabilities[0].toFixed(0)}%</p>
            </div>

            <div className="flex flex-col items-center px-2">
              <span className="text-xs text-muted-foreground font-medium">VS</span>
              {market.outcomes.length === 3 && (
                <>
                  <p className="text-xs font-mono text-muted-foreground">{formatOdds(market.odds[1])}</p>
                  <p className="text-[10px] text-muted-foreground">Draw</p>
                </>
              )}
            </div>

            <div className="flex-1 text-center">
              <p className="font-semibold text-sm truncate">{market.awayTeam}</p>
              <p className="text-lg font-bold text-destructive font-mono">
                {formatOdds(market.odds[market.odds.length - 1])}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {market.probabilities[market.probabilities.length - 1].toFixed(0)}%
              </p>
            </div>
          </div>

          {/* Market type badge */}
          {market.marketType !== 'moneyline' && (
            <div className="mt-3 flex justify-center">
              <Badge variant="outline" className="text-[10px]">
                {market.marketType === 'spread'
                  ? `Spread: ${market.spread! > 0 ? '+' : ''}${market.spread}`
                  : `Total: ${market.total}`}
              </Badge>
            </div>
          )}
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
            {new Date(market.maturity * 1000).toLocaleDateString('en-US', {
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
                ? 'bg-gradient-to-r from-primary to-blue-500 hover:from-primary hover:to-blue-400 shadow-lg shadow-primary/25'
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
            onClick={() => window.open('https://overtimemarkets.xyz', '_blank')}
          >
            <ExternalLink className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>

      <OvertimeSimulateBetModal
        market={market}
        isOpen={isBetModalOpen}
        onClose={() => setIsBetModalOpen(false)}
        walletAddress={walletAddress}
        onSuccess={onBetPlaced}
      />
    </Card>
  );
}
