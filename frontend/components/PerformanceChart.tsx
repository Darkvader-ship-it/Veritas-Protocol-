'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface DataPoint {
  date: string;
  wins: number;
  losses: number;
  winRate: number;
}

interface PerformanceChartProps {
  data: DataPoint[];
  title?: string;
  description?: string;
}

export function PerformanceChart({ data, title = 'Performance Over Time', description }: PerformanceChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent className="py-16 text-center text-muted-foreground">
          No performance data available
        </CardContent>
      </Card>
    );
  }

  const maxWinRate = Math.max(...data.map(d => d.winRate));
  const minWinRate = Math.min(...data.map(d => d.winRate));
  const avgWinRate = data.reduce((sum, d) => sum + d.winRate, 0) / data.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 pb-4 border-b">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-1">Average</p>
            <p className="text-2xl font-bold">{avgWinRate.toFixed(1)}%</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-1">Best</p>
            <p className="text-2xl font-bold text-green-500">{maxWinRate.toFixed(1)}%</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-1">Worst</p>
            <p className="text-2xl font-bold text-red-500">{minWinRate.toFixed(1)}%</p>
          </div>
        </div>

        {/* Simple Bar Chart */}
        <div className="space-y-3">
          {data.map((point, index) => {
            const totalBets = point.wins + point.losses;
            const winPercentage = totalBets > 0 ? (point.wins / totalBets) * 100 : 0;

            return (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{point.date}</span>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-green-600">
                      {point.wins}W
                    </Badge>
                    <Badge variant="outline" className="text-red-600">
                      {point.losses}L
                    </Badge>
                    <span className="font-semibold min-w-[50px] text-right">
                      {point.winRate.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="relative h-6 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full transition-all ${
                      winPercentage >= 50
                        ? 'bg-gradient-to-r from-green-500 to-green-600'
                        : 'bg-gradient-to-r from-red-500 to-red-600'
                    }`}
                    style={{ width: `${winPercentage}%` }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-medium text-white mix-blend-difference">
                      {totalBets} bet{totalBets !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
