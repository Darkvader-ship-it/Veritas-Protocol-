'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, Zap, Clock } from 'lucide-react';
import { PLATFORMS, PlatformId } from '@/lib/platforms';
import { GenericSimulateBetModal } from './GenericSimulateBetModal';

export interface GenericMarket {
  id: string;
  title: string;
  description?: string;
  category: string;
  outcomes: {
    id: string;
    name: string;
    odds: number;
    probability: number;
  }[];
  status: 'open' | 'resolved' | 'closed' | 'pending';
  volume?: number;
  liquidity?: number;
  resolvesAt?: number;
  resolvedOutcome?: string;
}

interface GenericMarketCardProps {
  market: GenericMarket;
  platformId: PlatformId;
  walletAddress?: string;
  onBetPlaced?: () => void;
}

export function GenericMarketCard({
  market,
  platformId,
  walletAddress,
  onBetPlaced,
}: GenericMarketCardProps) {
  const [isBetModalOpen, setIsBetModalOpen] = useState(false);

  const platform = PLATFORMS[platformId];
  const canBet = market.status === 'open';

  const formatOdds = (decimal: number) => {
    if (decimal <= 0 || decimal > 100) return '-';
    return decimal.toFixed(2);
  };

  const formatPercentage = (prob: number) => {
    if (prob <= 0 || prob > 1) return '-';
    return `${(prob * 100).toFixed(0)}%`;
  };

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return 'TBD';
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get primary outcomes (Yes/No or first two)
  const yesOutcome = market.outcomes.find(o => o.name.toLowerCase() === 'yes') || market.outcomes[0];
  const noOutcome = market.outcomes.find(o => o.name.toLowerCase() === 'no') || market.outcomes[1];

  const isRealTUSDC = !platform.supportsSimulation;

  const handleSimulateBet = () => {
    if (isRealTUSDC) {
      // For real tUSDC Drift, use the DreamDEX vault flow - redirect to copy-trading or handle as real
      // For now, open the same modal but it will be handled as real via the vault
      setIsBetModalOpen(true);
      return;
    }
    setIsBetModalOpen(true);
  };

  return (
    <>
    <GenericSimulateBetModal
      market={market}
      platformId={platformId}
      isOpen={isBetModalOpen}
      onClose={() => setIsBetModalOpen(false)}
      walletAddress={walletAddress}
      onSuccess={onBetPlaced}
      isReal={isRealTUSDC}
    />
    <Card className={`group relative border-border/50 transition-all duration-300 overflow-hidden hover:border-${platform.textColor.replace('text-', '')}/50 hover:shadow-lg`}>
      <CardContent className="p-0 relative">
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-border/30">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${platform.gradient} flex items-center justify-center shadow-lg text-xl`}>
              {platform.icon}
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">{market.category}</p>
              <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">
                {platform.chain}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`text-[10px] ${platform.bgGradient} ${platform.textColor} ${platform.borderColor}`}>
              {platform.displayName}
            </Badge>
            {!platform.isRealMoney && (
              <Badge variant="outline" className="text-[10px] bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
                Play
              </Badge>
            )}
          </div>
        </div>

        {/* Title */}
        <div className="px-4 py-3">
          <h3 className="font-semibold text-sm leading-tight line-clamp-2">{market.title}</h3>
          {market.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{market.description}</p>
          )}
        </div>

        {/* Outcomes */}
        <div className="px-4 py-3 bg-muted/20">
          <div className="flex items-center justify-between gap-2">
            {yesOutcome && (
              <div className="flex-1 text-center p-2 rounded-lg bg-success/10 border border-success/20">
                <p className="text-xs font-medium text-success truncate">{yesOutcome.name}</p>
                <p className="text-lg font-bold text-success font-mono">{formatOdds(yesOutcome.odds)}</p>
                <p className="text-[10px] text-muted-foreground">{formatPercentage(yesOutcome.probability)}</p>
              </div>
            )}

            {noOutcome && yesOutcome?.id !== noOutcome?.id && (
              <div className="flex-1 text-center p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-xs font-medium text-destructive truncate">{noOutcome.name}</p>
                <p className="text-lg font-bold text-destructive font-mono">{formatOdds(noOutcome.odds)}</p>
                <p className="text-[10px] text-muted-foreground">{formatPercentage(noOutcome.probability)}</p>
              </div>
            )}
          </div>

          {/* More outcomes indicator */}
          {market.outcomes.length > 2 && (
            <p className="text-[10px] text-muted-foreground text-center mt-2">
              +{market.outcomes.length - 2} more outcomes
            </p>
          )}
        </div>

        {/* Time Info */}
        <div className="px-4 py-2.5 border-t border-border/30 flex items-center justify-between text-xs bg-muted/10">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">
              {market.status === 'resolved' ? 'Resolved' : formatTime(market.resolvesAt)}
            </span>
          </div>
          {market.volume !== undefined && market.volume > 0 && (
            <span className="text-muted-foreground">
              Vol: {platform.currency === 'USD' || platform.currency === 'USDC' ? '$' : ''}{market.volume.toLocaleString()}
            </span>
          )}
        </div>

        {/* Action */}
        <div className="px-4 pb-4 pt-3 flex gap-2">
          <Button
            onClick={handleSimulateBet}
            disabled={!canBet}
            className={`flex-1 h-10 font-semibold transition-all ${
              canBet
                ? `bg-gradient-to-r ${platform.gradient} hover:opacity-90 shadow-lg`
                : ''
            }`}
            size="sm"
          >
            {canBet ? (
              <>
                <Zap className="w-4 h-4 mr-1.5" />
                {isRealTUSDC ? 'Trade (tUSDC)' : 'Simulate Bet'}
              </>
            ) : (
              market.status === 'resolved' ? `Won: ${market.resolvedOutcome}` : 'Closed'
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-10 w-10 p-0"
            onClick={() => window.open(platform.website, '_blank')}
          >
            <ExternalLink className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
    </>
  );
}
