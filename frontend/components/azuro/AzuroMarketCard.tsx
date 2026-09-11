'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AzuroPredictionMarket } from '@/lib/azuro';
import { AzuroSimulateBetModal } from './AzuroSimulateBetModal';
import {
  ExternalLink,
  Zap,
  Clock,
  Trophy,
  Target,
  Swords,
  Users,
  Timer,
} from 'lucide-react';

interface AzuroMarketCardProps {
  market: AzuroPredictionMarket;
  walletAddress?: string;
  onBetPlaced?: () => void;
}

// Sport icons and colors
const sportStyles: Record<string, { icon: typeof Trophy; color: string; bg: string }> = {
  'Football': { icon: Trophy, color: 'text-emerald-400', bg: 'from-emerald-500 to-green-600' },
  'Soccer': { icon: Trophy, color: 'text-emerald-400', bg: 'from-emerald-500 to-green-600' },
  'Basketball': { icon: Target, color: 'text-orange-400', bg: 'from-orange-500 to-red-600' },
  'Tennis': { icon: Trophy, color: 'text-lime-400', bg: 'from-lime-500 to-green-600' },
  'Hockey': { icon: Target, color: 'text-blue-400', bg: 'from-blue-500 to-cyan-600' },
  'MMA': { icon: Swords, color: 'text-red-400', bg: 'from-red-600 to-rose-700' },
  'Boxing': { icon: Swords, color: 'text-red-400', bg: 'from-red-600 to-rose-700' },
  'Esports': { icon: Users, color: 'text-purple-400', bg: 'from-purple-500 to-indigo-600' },
  'default': { icon: Trophy, color: 'text-cyan-400', bg: 'from-cyan-500 to-blue-600' },
};

export function AzuroMarketCard({ market, walletAddress, onBetPlaced }: AzuroMarketCardProps) {
  const [isBetModalOpen, setIsBetModalOpen] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);

  useEffect(() => {
    const now = Math.floor(Date.now() / 1000);
    setTimeRemaining(Math.max(0, market.startsAt - now));
  }, [market.startsAt]);

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

  const formatOdds = (decimal: number) => {
    return decimal.toFixed(2);
  };

  const sportStyle = sportStyles[market.sport] || sportStyles['default'];
  const SportIcon = sportStyle.icon;

  const isLive = market.status === 'live';
  const canBet = market.status === 'active' || market.status === 'upcoming';

  const statusStyles: Record<string, string> = {
    active: 'bg-primary/20 text-primary border-primary/30',
    upcoming: 'bg-primary/20 text-primary border-primary/30',
    live: 'bg-success/20 text-success border-success/30',
    ended: 'bg-muted/50 text-muted-foreground border-muted',
    cancelled: 'bg-destructive/20 text-destructive border-destructive/30',
  };

  // Get two main outcomes (home/away)
  const homeOutcome = market.outcomes[0];
  const awayOutcome = market.outcomes[market.outcomes.length > 2 ? 2 : 1];
  const drawOutcome = market.outcomes.length === 3 ? market.outcomes[1] : null;

  return (
    <Card className={`group relative border-border/50 transition-all duration-300 overflow-hidden ${
      isLive
        ? 'hover:border-success/50 hover:shadow-lg hover:shadow-success/10'
        : canBet
        ? 'hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/10'
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
            <Badge variant="outline" className="text-[10px] bg-cyan-500/10 text-cyan-400 border-cyan-500/30">
              {market.network}
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
              <p className="font-semibold text-sm truncate">{market.participants[0] || homeOutcome?.name}</p>
              <p className="text-lg font-bold text-success font-mono">{formatOdds(homeOutcome?.odds || 0)}</p>
              <p className="text-[10px] text-muted-foreground">{homeOutcome?.odds ? ((1 / homeOutcome.odds) * 100).toFixed(0) : 0}%</p>
            </div>

            <div className="flex flex-col items-center px-2">
              <span className="text-xs text-muted-foreground font-medium">VS</span>
              {drawOutcome && (
                <>
                  <p className="text-xs font-mono text-muted-foreground">{formatOdds(drawOutcome.odds)}</p>
                  <p className="text-[10px] text-muted-foreground">Draw</p>
                </>
              )}
            </div>

            <div className="flex-1 text-center">
              <p className="font-semibold text-sm truncate">{market.participants[1] || awayOutcome?.name}</p>
              <p className="text-lg font-bold text-destructive font-mono">
                {formatOdds(awayOutcome?.odds || 0)}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {awayOutcome?.odds ? ((1 / awayOutcome.odds) * 100).toFixed(0) : 0}%
              </p>
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
            {new Date(market.startsAt * 1000).toLocaleDateString('en-US', {
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
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 shadow-lg shadow-cyan-500/25'
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
            onClick={() => window.open('https://azuro.org', '_blank')}
          >
            <ExternalLink className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>

      <AzuroSimulateBetModal
        market={market}
        isOpen={isBetModalOpen}
        onClose={() => setIsBetModalOpen(false)}
        walletAddress={walletAddress}
        onSuccess={onBetPlaced}
      />
    </Card>
  );
}
