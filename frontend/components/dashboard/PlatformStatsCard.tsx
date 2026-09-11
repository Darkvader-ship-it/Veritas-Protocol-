'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PlatformBadge } from '@/components/ui/platform-badge';
import { useRouter } from 'next/navigation';
import { SimulationStats } from '@/lib/queries';

interface PlatformStatsCardProps {
  platformName: string;
  stats: (SimulationStats & { currencyLabel?: string }) | null;
  isLoading: boolean;
}

export function PlatformStatsCard({ platformName, stats, isLoading }: PlatformStatsCardProps) {
  const router = useRouter();

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <PlatformBadge platform={platformName} size="md" />
          Simulation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Skeleton className="h-20" />
        ) : stats ? (
          <>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-2 rounded-lg bg-surface/50">
                <p className="text-lg font-bold">{stats.totalTrades}</p>
                <p className="text-[10px] text-muted-foreground">Trades</p>
              </div>
              <div className="p-2 rounded-lg bg-surface/50">
                <p className="text-lg font-bold text-success">{stats.winRate.toFixed(0)}%</p>
                <p className="text-[10px] text-muted-foreground">Win Rate</p>
              </div>
              <div className="p-2 rounded-lg bg-surface/50">
                <p className={`text-lg font-bold ${stats.totalPnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {stats.totalPnl >= 0 ? '+' : ''}
                  {stats.currencyLabel === 'STT'
                    ? stats.totalPnl.toFixed(4)
                    : stats.currencyLabel === 'points' || stats.currencyLabel === 'M$'
                    ? stats.totalPnl.toFixed(0)
                    : stats.currencyLabel === 'tUSDC'
                    ? `${stats.totalPnl.toFixed(2)} tUSDC`
                    : `$${stats.totalPnl.toFixed(2)}`}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  PnL {stats.currencyLabel && stats.currencyLabel !== 'USD' ? `(${stats.currencyLabel})` : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
              <span>{stats.pending} pending</span>
              <span>
                {stats.currencyLabel === 'STT'
                  ? `${stats.totalVolume.toFixed(2)} STT volume`
                  : stats.currencyLabel === 'points'
                  ? `${stats.totalVolume.toFixed(0)} points volume`
                  : stats.currencyLabel === 'M$'
                  ? `${stats.totalVolume.toFixed(0)} M$ volume`
                  : stats.currencyLabel === 'tUSDC'
                  ? `${stats.totalVolume.toFixed(2)} tUSDC volume`
                  : `$${stats.totalVolume.toFixed(2)} volume`}
              </span>
            </div>
          </>
        ) : (
          <div className="text-center py-4 text-muted-foreground">
            <p className="text-sm">No {platformName} trades yet</p>
            <Button variant="link" size="sm" onClick={() => router.push('/markets')}>
              Browse markets →
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
