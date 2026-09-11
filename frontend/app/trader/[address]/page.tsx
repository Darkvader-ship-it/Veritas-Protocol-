'use client'


import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAccount } from 'wagmi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { TrendingUp, TrendingDown, Trophy, Target, DollarSign, Activity, Users } from 'lucide-react';
import { CopyTradeButton } from '@/components/CopyTradeButton';
import { shortenAddress, PATTERNS } from '@/components/ui/design-tokens';

interface Platform {
  name: string;
  total_bets: number;
  wins: number;
  losses: number;
  win_rate: number;
  volume: string;
  score: number;
}

interface Bet {
  id: string;
  platform: string;
  market_id: string;
  position: string;
  amount: string;
  won: boolean | null;
  claimed_amount: string | null;
  timestamp: string;
  tx_hash: string;
}

interface TraderProfile {
  wallet_address: string;
  username: string | null;
  total_bets: number;
  wins: number;
  losses: number;
  win_rate: number;
  total_score: number;
  total_volume: string;
  platforms: Platform[];
  recent_bets: Bet[];
  follower_count: number;
  rank: number | null;
}

export default function TraderProfilePage() {
  const params = useParams();
  const { address: connectedAddress } = useAccount();
  const address = params.address as string;

  const [profile, setProfile] = useState<TraderProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (address) {
      loadProfile();
    }
  }, [address]);

  async function loadProfile() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/trader/${address}`);
      if (!res.ok) {
        throw new Error('Failed to load trader profile');
      }

      const data = await res.json();
      setProfile(data.profile);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function formatSTT(wei: string): string {
    return (Number(wei) / 1e18).toFixed(4);
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-6xl">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Activity className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Loading trader profile...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-6xl">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Target className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-black mb-2">Trader Not Found</h2>
            <p className="text-muted-foreground">{error || 'This trader has no prediction history'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isOwnProfile = connectedAddress?.toLowerCase() === address.toLowerCase();

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Profile Header */}
      <Card className="mb-8">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-6">
              <Avatar className="h-24 w-24">
                <AvatarFallback className="text-3xl">
                  {profile.username?.[0]?.toUpperCase() || address.slice(2, 4).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-3xl font-black mb-2">
                  {profile.username || shortenAddress(address)}
                </h1>
                <p className="text-muted-foreground font-mono text-sm mb-3">{address}</p>
                <div className="flex items-center gap-4">
                  {profile.rank && (
                    <Badge variant="default" className="flex items-center gap-1">
                      <Trophy className="h-3 w-3" />
                      Rank #{profile.rank}
                    </Badge>
                  )}
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {profile.follower_count} Follower{profile.follower_count !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </div>
            </div>

            {!isOwnProfile && (
              <CopyTradeButton
                traderAddress={address}
                traderName={profile.username || shortenAddress(address)}
                traderStats={{
                  total_bets: profile.total_bets,
                  wins: profile.wins,
                  win_rate: profile.win_rate,
                  total_score: profile.total_score,
                  total_volume: profile.total_volume,
                }}
              />
            )}
          </div>

          <Separator className="my-6" />

          {/* Overall Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Win Rate</p>
              <p className="text-3xl font-black">{profile.win_rate.toFixed(1)}%</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Total Bets</p>
              <p className="text-3xl font-black">{profile.total_bets}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Wins</p>
              <p className="text-3xl font-bold text-green-500">{profile.wins}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">VeritasScore</p>
              <p className="text-3xl font-black">{profile.total_score}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Volume</p>
              <p className="text-2xl font-black">{formatSTT(profile.total_volume)} STT</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="platforms" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="platforms">Platform Breakdown</TabsTrigger>
          <TabsTrigger value="history">Bet History</TabsTrigger>
        </TabsList>

        <TabsContent value="platforms" className="space-y-4">
          {profile.platforms.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Target className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No platform data available</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {profile.platforms.map((platform) => (
                <Card key={platform.name}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{platform.name}</span>
                      <Badge variant="secondary">{platform.total_bets} bets</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Win Rate</p>
                        <p className="text-2xl font-bold flex items-center gap-2">
                          {platform.win_rate >= 50 ? (
                            <TrendingUp className="h-5 w-5 text-green-500" />
                          ) : (
                            <TrendingDown className="h-5 w-5 text-red-500" />
                          )}
                          {platform.win_rate.toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Score</p>
                        <p className="text-2xl font-black">{platform.score}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Wins</p>
                        <p className="font-semibold text-green-500">{platform.wins}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Losses</p>
                        <p className="font-semibold text-red-500">{platform.losses}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Volume</p>
                        <p className="font-semibold">{formatSTT(platform.volume)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {profile.recent_bets.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Activity className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No bet history available</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Recent Predictions</CardTitle>
                <CardDescription>Last {profile.recent_bets.length} bets</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {profile.recent_bets.map((bet) => (
                    <div
                      key={bet.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">{bet.position}</Badge>
                          <span className="text-sm text-muted-foreground">{bet.platform}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Market #{bet.market_id} • {new Date(bet.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right space-y-1">
                        <p className="font-mono text-sm">{formatSTT(bet.amount)} STT</p>
                        {bet.won !== null && (
                          <Badge variant={bet.won ? 'default' : 'destructive'}>
                            {bet.won ? 'Won' : 'Lost'}
                            {bet.won && bet.claimed_amount && (
                              <span className="ml-1">+{formatSTT(bet.claimed_amount)}</span>
                            )}
                          </Badge>
                        )}
                        {bet.won === null && (
                          <Badge variant="secondary">Pending</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
