'use client'


import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { PerformanceChart } from '@/components/PerformanceChart';
import { TrendingUp, TrendingDown, Activity, Target, Users, DollarSign } from 'lucide-react';

interface PlatformAnalytics {
  name: string;
  total_bets: number;
  total_users: number;
  total_volume: string;
  avg_win_rate: number;
  trend: 'up' | 'down' | 'stable';
}

interface GlobalStats {
  total_bets: number;
  total_users: number;
  total_volume: string;
  total_platforms: number;
  avg_win_rate: number;
  top_performer: {
    address: string;
    username: string | null;
    score: number;
  } | null;
}

export default function AnalyticsPage() {
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [platformAnalytics, setPlatformAnalytics] = useState<PlatformAnalytics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {
    setLoading(true);
    try {
      const res = await fetch('/api/analytics');
      if (res.ok) {
        const data = await res.json();
        setGlobalStats(data.global);
        setPlatformAnalytics(data.platforms);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  }

  function formatSTT(wei: string): string {
    const value = Number(wei) / 1e18;
    if (value >= 1000) {
      return `${(value / 1000).toFixed(2)}K`;
    }
    return value.toFixed(2);
  }

  function shortenAddress(addr: string): string {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-7xl">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Activity className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Loading analytics...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-black mb-2">Veritas Analytics</h1>
        <p className="text-muted-foreground">
          Platform-wide statistics and performance insights
        </p>
      </div>

      {/* Global Stats */}
      {globalStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Target className="h-4 w-4" />
                Total Predictions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black">{globalStats.total_bets.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Across all platforms
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Total Traders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black">{globalStats.total_users.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Unique wallet addresses
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Total Volume
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black">{formatSTT(globalStats.total_volume)} STT</div>
              <p className="text-xs text-muted-foreground mt-1">
                Cumulative bet volume
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Avg Win Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold flex items-center gap-2">
                {globalStats.avg_win_rate >= 50 ? (
                  <TrendingUp className="h-6 w-6 text-green-500" />
                ) : (
                  <TrendingDown className="h-6 w-6 text-red-500" />
                )}
                {globalStats.avg_win_rate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Platform average
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Top Performer */}
      {globalStats?.top_performer && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-black">
              <TrendingUp className="h-5 w-5 text-yellow-500" />
              Top Performer
            </CardTitle>
            <CardDescription>Highest VeritasScore on the platform</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-black">
                  {globalStats.top_performer.username ||
                    shortenAddress(globalStats.top_performer.address)}
                </p>
                <p className="text-sm text-muted-foreground font-mono">
                  {globalStats.top_performer.address}
                </p>
              </div>
              <Badge variant="default" className="text-lg px-4 py-2">
                Score: {globalStats.top_performer.score}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Platform Analytics */}
      <Tabs defaultValue="platforms" className="space-y-6">
        <TabsList>
          <TabsTrigger value="platforms">Platform Breakdown</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="platforms" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {platformAnalytics.map((platform) => (
              <Card key={platform.name}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{platform.name}</span>
                    {platform.trend === 'up' && (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    )}
                    {platform.trend === 'down' && (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Bets</p>
                      <p className="text-2xl font-black">{platform.total_bets.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Users</p>
                      <p className="text-2xl font-black">{platform.total_users.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Volume</p>
                      <p className="text-lg font-bold">{formatSTT(platform.total_volume)} STT</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Win Rate</p>
                      <p className="text-lg font-bold">{platform.avg_win_rate.toFixed(1)}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="trends">
          <Card>
            <CardHeader>
              <CardTitle>Platform Performance Trends</CardTitle>
              <CardDescription>Coming soon - Historical performance data</CardDescription>
            </CardHeader>
            <CardContent className="py-16 text-center text-muted-foreground">
              <Activity className="h-16 w-16 mx-auto mb-4" />
              <p>Advanced trend analysis will be available once sufficient data is collected</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
