'use client'


import { useState, useEffect, useCallback } from 'react';
import { useMonitorData } from '@/lib/queries';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Activity,
  Radio,
  Users,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  Timer,
  Zap,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MonitorData {
  status: string;
  mainnet: {
    currentEpoch: string;
    currentBlock: number;
    dreamdexLive: boolean;
  };
  monitoring: {
    leadersCount: number;
    topLeaders: Array<{
      address: string;
      score: number;
      activity: {
        lastBetEpoch: number;
        hoursAgo: number;
      } | null;
    }>;
  };
  simulation: {
    totalTrades: number;
    wins: number;
    losses: number;
    pending: number;
    winRate: string;
    totalPnlSTT: string;
  };
  recentTrades: Array<{
    id: number;
    follower: string;
    leader: string;
    epoch: number;
    amountSTT: string;
    isBull: boolean;
    outcome: string;
    pnlSTT: string | null;
    simulatedAt: string;
  }>;
  timestamp: string;
}

export default function MonitorPage() {
  // UI state only - autoRefresh controls polling
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // React Query hook - handles fetching, caching, and polling
  const { data, isLoading: loading, error: queryError, refetch, dataUpdatedAt } = useMonitorData(autoRefresh);
  const error = queryError?.message || null;

  // Update lastUpdate timestamp when data changes
  useEffect(() => {
    if (dataUpdatedAt) {
      setLastUpdate(new Date(dataUpdatedAt));
    }
  }, [dataUpdatedAt]);

  // Manual refresh handler
  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const getActivityColor = (hoursAgo: number | undefined) => {
    if (!hoursAgo) return 'text-slate-500';
    if (hoursAgo < 1) return 'text-green-400';
    if (hoursAgo < 6) return 'text-yellow-400';
    if (hoursAgo < 24) return 'text-orange-400';
    return 'text-red-400';
  };

  const getActivityLabel = (hoursAgo: number | undefined) => {
    if (!hoursAgo) return 'Unknown';
    if (hoursAgo < 1) return 'Active now';
    if (hoursAgo < 6) return `${hoursAgo}h ago`;
    if (hoursAgo < 24) return `${hoursAgo}h ago`;
    return `${Math.round(hoursAgo / 24)}d ago`;
  };

  if (loading && !data) {
    return (
      <div className="container mx-auto px-4 py-16 flex items-center justify-center">
        <Activity className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bebas uppercase tracking-wider bg-gradient-to-r from-purple-500 via-pink-500 to-amber-500 bg-clip-text text-transparent flex items-center gap-3">
            <Radio className="h-8 w-8 text-purple-500" />
            Copy Trading Monitor
          </h1>
          <p className="text-slate-400 mt-1">
            Real-time simulation monitoring dashboard
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? 'border-green-500 text-green-400' : 'border-slate-600'}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            Refresh Now
          </Button>
        </div>
      </div>

      {error && (
        <Alert className="mb-6 border-red-500/50 bg-red-500/10">
          <XCircle className="h-4 w-4 text-red-500" />
          <AlertDescription className="text-red-200">
            Error: {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Status Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <Card className="border-green-500/20 bg-gradient-to-br from-green-950/30 to-slate-950/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
            <div>
              <p className="text-xs text-slate-400">Mainnet</p>
              <p className="text-lg font-bold text-green-400">LIVE</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-500/20 bg-gradient-to-br from-purple-950/30 to-slate-950/50">
          <CardContent className="p-4">
            <p className="text-xs text-slate-400">Current Epoch</p>
            <p className="text-lg font-bold text-purple-400">{data?.mainnet.currentEpoch || '-'}</p>
          </CardContent>
        </Card>

        <Card className="border-blue-500/20 bg-gradient-to-br from-blue-950/30 to-slate-950/50">
          <CardContent className="p-4">
            <p className="text-xs text-slate-400">Monitoring</p>
            <p className="text-lg font-bold text-blue-400">{data?.monitoring.leadersCount || 0} Leaders</p>
          </CardContent>
        </Card>

        <Card className="border-amber-500/20 bg-gradient-to-br from-amber-950/30 to-slate-950/50">
          <CardContent className="p-4">
            <p className="text-xs text-slate-400">Simulated Trades</p>
            <p className="text-lg font-bold text-amber-400">{data?.simulation.totalTrades || 0}</p>
          </CardContent>
        </Card>

        <Card className="border-slate-500/20 bg-gradient-to-br from-slate-900/50 to-slate-950/50">
          <CardContent className="p-4">
            <p className="text-xs text-slate-400">Last Update</p>
            <p className="text-sm font-medium text-slate-300">
              {lastUpdate ? lastUpdate.toLocaleTimeString() : '-'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leaders Being Monitored */}
        <Card className="border-blue-500/20 bg-gradient-to-br from-slate-950/90 to-slate-900/90">
          <CardHeader>
            <CardTitle className="text-xl font-bebas uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              Monitored Leaders (Top 10)
            </CardTitle>
            <CardDescription>
              Leaders being watched for bets
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data?.monitoring.topLeaders.map((leader, i) => (
                <div
                  key={leader.address}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-900/50 border border-slate-800"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 w-4">#{i + 1}</span>
                    <code className="text-xs text-slate-300">
                      {leader.address?.slice(0, 8)}...{leader.address?.slice(-6)}
                    </code>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs">
                      Score: {leader.score}
                    </Badge>
                    <span className={`text-xs ${getActivityColor(leader.activity?.hoursAgo)}`}>
                      {getActivityLabel(leader.activity?.hoursAgo)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Simulation Stats */}
        <Card className="border-purple-500/20 bg-gradient-to-br from-slate-950/90 to-slate-900/90">
          <CardHeader>
            <CardTitle className="text-xl font-bebas uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-500" />
              Simulation Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800 text-center">
                <p className="text-3xl font-teko text-green-400">{data?.simulation.wins || 0}</p>
                <p className="text-xs text-slate-500">Wins</p>
              </div>
              <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800 text-center">
                <p className="text-3xl font-teko text-red-400">{data?.simulation.losses || 0}</p>
                <p className="text-xs text-slate-500">Losses</p>
              </div>
              <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800 text-center">
                <p className="text-3xl font-teko text-blue-400">{data?.simulation.winRate || 'N/A'}</p>
                <p className="text-xs text-slate-500">Win Rate</p>
              </div>
              <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800 text-center">
                <p className={`text-3xl font-teko ${parseFloat(data?.simulation.totalPnlSTT || '0') >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {parseFloat(data?.simulation.totalPnlSTT || '0') >= 0 ? '+' : ''}{parseFloat(data?.simulation.totalPnlSTT || '0').toFixed(4)}
                </p>
                <p className="text-xs text-slate-500">Total PnL (STT)</p>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-2">
                <span>Pending Resolution</span>
                <span>{data?.simulation.pending || 0} trades</span>
              </div>
              <Progress
                value={data?.simulation.totalTrades ? ((data.simulation.pending / data.simulation.totalTrades) * 100) : 0}
                className="h-2 bg-slate-800"
              />
            </div>
          </CardContent>
        </Card>

        {/* Recent Trades */}
        <Card className="border-amber-500/20 bg-gradient-to-br from-slate-950/90 to-slate-900/90 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-xl font-bebas uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              Recent Simulated Trades
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data?.recentTrades && data.recentTrades.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {data.recentTrades.map((trade) => (
                  <div
                    key={trade.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-800"
                  >
                    <div className="flex items-center gap-3">
                      {trade.outcome === 'win' ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : trade.outcome === 'loss' ? (
                        <XCircle className="h-5 w-5 text-red-500" />
                      ) : (
                        <Timer className="h-5 w-5 text-amber-500 animate-pulse" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-slate-200">
                          Epoch #{trade.epoch} - {trade.isBull ? '🐂 BULL' : '🐻 BEAR'}
                        </p>
                        <p className="text-xs text-slate-500">
                          Leader: {trade.leader?.slice(0, 8)}... → Follower: {trade.follower?.slice(0, 8)}...
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-slate-200">{trade.amountSTT} STT</p>
                      {trade.pnlSTT ? (
                        <p className={`text-xs ${parseFloat(trade.pnlSTT) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {parseFloat(trade.pnlSTT) >= 0 ? '+' : ''}{trade.pnlSTT} STT
                        </p>
                      ) : (
                        <p className="text-xs text-amber-400">Pending...</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400">
                <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg">No simulated trades yet</p>
                <p className="text-sm mt-2">Waiting for monitored leaders to place bets...</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity Legend */}
      <Card className="mt-6 border-slate-500/20 bg-slate-900/30">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-6 text-sm">
            <span className="text-slate-400">Leader Activity:</span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-green-400">Active now</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-yellow-400" />
              <span className="text-yellow-400">&lt; 6h ago</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-400" />
              <span className="text-orange-400">&lt; 24h ago</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-red-400">&gt; 24h ago</span>
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
