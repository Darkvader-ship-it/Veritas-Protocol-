'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Sparkles, TrendingUp, X } from 'lucide-react';
import { Address } from 'viem';

interface PlatformBreakdown {
  platform: string;
  bets: number;
  winRate: number;
  score: number;
}

interface RealUser {
  address: Address;
  totalBets: number;
  totalVolume: string;
  wins: number;
  losses: number;
  unclaimed?: number;
  winRate: number;
  veritasScore: number;
  rank: number;
  platforms?: string[];
  platformBreakdown?: PlatformBreakdown[];
}

interface RealUsersData {
  lastIndexed: number;
  totalUsers: number;
  fromBlock?: string;
  toBlock?: string;
  platforms?: string[];
  users: RealUser[];
}

export function UnclaimedReputationBanner() {
  const { address, isConnected } = useAccount();
  const [userData, setUserData] = useState<RealUser | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (!isConnected || !address) {
      setUserData(null);
      setIsVisible(false);
      return;
    }

    // Check if user dismissed the banner for this session
    const dismissedKey = `veritas-banner-dismissed-${address}`;
    if (sessionStorage.getItem(dismissedKey)) {
      setIsDismissed(true);
      return;
    }

    // Load real users data
    fetch('/data/real-users.json')
      .then(res => res.json())
      .then((data: RealUsersData) => {
        // Find if connected wallet is in the list
        const user = data.users.find(
          u => u.address.toLowerCase() === address.toLowerCase()
        );

        if (user) {
          setUserData(user);
          setIsVisible(true);
        } else {
          setUserData(null);
          setIsVisible(false);
        }
      })
      .catch(err => {
        console.error('Error loading real users data:', err);
        setUserData(null);
        setIsVisible(false);
      });
  }, [address, isConnected]);

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    if (address) {
      sessionStorage.setItem(`veritas-banner-dismissed-${address}`, 'true');
    }
  };

  const handleClaim = () => {
    // Scroll to registration section or trigger registration modal
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!userData || !isVisible || isDismissed) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="fixed top-20 left-0 right-0 z-40 px-4 md:px-6"
      >
        <div className="container max-w-5xl mx-auto">
          <Card className="border-2 border-purple-500/50 bg-gradient-to-r from-purple-950/95 to-blue-950/95 backdrop-blur-sm shadow-lg shadow-purple-500/20">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="hidden sm:flex w-12 h-12 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 items-center justify-center flex-shrink-0">
                  <Trophy className="w-6 h-6 md:w-8 md:h-8 text-white" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="text-lg md:text-xl font-bold text-white">
                          You Have Unclaimed Reputation!
                        </h3>
                        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50 text-xs">
                          <Sparkles className="w-3 h-3 mr-1" />
                          Verified
                        </Badge>
                      </div>
                      <p className="text-sm md:text-base text-gray-300">
                        {userData.platforms && userData.platforms.length > 1
                          ? `We found your prediction history on ${userData.platforms.length} platforms`
                          : 'We found your prediction history on-chain'}
                      </p>
                      {userData.platforms && userData.platforms.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {userData.platforms.map(platform => (
                            <Badge
                              key={platform}
                              variant="outline"
                              className="text-xs bg-purple-500/10 border-purple-500/30 text-purple-300"
                            >
                              {platform}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Close button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDismiss}
                      className="text-gray-400 hover:text-white flex-shrink-0 h-8 w-8 p-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    <div className="bg-black/30 rounded-lg p-3 border border-purple-500/20">
                      <div className="flex items-center gap-1 text-gray-400 mb-1">
                        <Trophy className="w-3 h-3" />
                        <span className="text-xs font-medium">Rank</span>
                      </div>
                      <p className="text-xl md:text-2xl font-bold text-yellow-400">
                        #{userData.rank}
                      </p>
                    </div>

                    <div className="bg-black/30 rounded-lg p-3 border border-purple-500/20">
                      <div className="flex items-center gap-1 text-gray-400 mb-1">
                        <Sparkles className="w-3 h-3" />
                        <span className="text-xs font-medium">Score</span>
                      </div>
                      <p className="text-xl md:text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                        {userData.veritasScore}
                      </p>
                    </div>

                    <div className="bg-black/30 rounded-lg p-3 border border-purple-500/20">
                      <div className="flex items-center gap-1 text-gray-400 mb-1">
                        <TrendingUp className="w-3 h-3" />
                        <span className="text-xs font-medium">Win Rate</span>
                      </div>
                      <p className="text-xl md:text-2xl font-bold text-green-400">
                        {userData.winRate.toFixed(1)}%
                      </p>
                    </div>

                    <div className="bg-black/30 rounded-lg p-3 border border-purple-500/20">
                      <div className="flex items-center gap-1 text-gray-400 mb-1">
                        <Trophy className="w-3 h-3" />
                        <span className="text-xs font-medium">Bets</span>
                      </div>
                      <p className="text-xl md:text-2xl font-bold text-blue-400">
                        {userData.totalBets}
                      </p>
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <Button
                      onClick={handleClaim}
                      className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 min-h-[44px] w-full sm:w-auto"
                    >
                      Claim Your Reputation NFT
                      <Sparkles className="w-4 h-4 ml-2" />
                    </Button>
                    <p className="text-xs text-gray-400 text-center sm:text-left">
                      Ranked #{userData.rank} of {userData.platforms && userData.platforms.length > 1 ? 'cross-platform' : ''} verified predictors
                    </p>
                  </div>
                </div>
              </div>

              {/* Progress indicator */}
              <motion.div
                className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-purple-600 to-blue-600"
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 10, ease: [0.4, 0, 0.2, 1] }}
              />
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
