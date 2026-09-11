'use client';

import { useState } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useVeritas } from '@/hooks/useVeritas';
import { TIER_NAMES, TIER_COLORS } from '@/lib/contracts';
import {
  User,
  Trophy,
  Target,
  TrendingUp,
  Copy,
  LogOut,
  Share2,
  Check,
  Sparkles,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ProfilePopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfilePopup({ isOpen, onClose }: ProfilePopupProps) {
  const { address } = useAccount();
  const { disconnect } = useDisconnect();
  const router = useRouter();
  const { toast } = useToast();
  const { isRegistered, nftMetadata } = useVeritas();

  const [copied, setCopied] = useState(false);

  const handleCopyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      toast({
        title: 'Address copied',
        description: 'Wallet address copied to clipboard',
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    onClose();
    toast({
      title: 'Wallet disconnected',
      description: 'Your wallet has been disconnected',
    });
  };

  const handleViewProfile = () => {
    if (address) {
      router.push(`/profile/${address}`);
      onClose();
    }
  };

  const handleShareProfile = () => {
    if (address) {
      const profileUrl = `${window.location.origin}/profile/${address}`;
      navigator.clipboard.writeText(profileUrl);
      toast({
        title: 'Profile link copied',
        description: 'Share your reputation with others',
      });
    }
  };

  const truncatedAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : '';

  if (!address) return null;

  const tierGradients: Record<number, string> = {
    0: 'from-amber-700 to-amber-900',
    1: 'from-slate-400 to-slate-600',
    2: 'from-yellow-500 to-amber-600',
    3: 'from-cyan-400 to-blue-600',
    4: 'from-violet-500 to-purple-700',
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xs p-0 gap-0 overflow-hidden">
        {/* Header with tier gradient */}
        {isRegistered && nftMetadata ? (
          <div className={`bg-gradient-to-br ${tierGradients[nftMetadata.tier] || tierGradients[0]} p-4 pb-8`}>
            <div className="flex items-center justify-between mb-3">
              <Badge className="bg-white/20 text-white text-xs backdrop-blur-sm border-0">
                <Check className="w-3 h-3 mr-1" />
                Verified
              </Badge>
              <Badge className={`${TIER_COLORS[nftMetadata.tier]} text-white text-xs`}>
                {TIER_NAMES[nftMetadata.tier]}
              </Badge>
            </div>

            <div className="text-center text-white">
              <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm mx-auto mb-2 flex items-center justify-center">
                <Trophy className="w-7 h-7" />
              </div>
              <p className="text-sm opacity-80 mb-1">VeritasScore</p>
              <p className="text-4xl font-bold tracking-tight">
                {Number(nftMetadata.veritasScore)}
              </p>
            </div>
          </div>
        ) : (
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="text-lg">Your profile</DialogTitle>
          </DialogHeader>
        )}

        {/* Stats row - overlapping card */}
        {isRegistered && nftMetadata && (
          <div className="px-3 -mt-4">
            <div className="bg-surface-raised rounded-lg border border-border/50 p-3 flex items-center justify-around">
              <div className="text-center">
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <Target className="w-3 h-3" />
                  Win rate
                </p>
                <p className="text-lg font-semibold text-success">
                  {(Number(nftMetadata.winRate) / 100).toFixed(1)}%
                </p>
              </div>
              <Separator orientation="vertical" className="h-8" />
              <div className="text-center">
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  Predictions
                </p>
                <p className="text-lg font-semibold">
                  {Number(nftMetadata.totalPredictions)}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="p-3 space-y-3">
          {/* Wallet address */}
          <button
            onClick={handleCopyAddress}
            className="w-full flex items-center justify-between p-2.5 rounded-lg bg-surface hover:bg-surface-raised transition-colors group"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-xs text-muted-foreground">Wallet</p>
                <p className="text-sm font-mono">{truncatedAddress}</p>
              </div>
            </div>
            {copied ? (
              <Check className="w-4 h-4 text-success" />
            ) : (
              <Copy className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            )}
          </button>

          {/* No NFT state */}
          {!isRegistered && (
            <div className="text-center py-4 px-2">
              <div className="w-12 h-12 rounded-full bg-secondary/10 mx-auto mb-3 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-secondary" />
              </div>
              <p className="font-medium mb-1">No reputation NFT</p>
              <p className="text-sm text-muted-foreground mb-3">
                Claim your NFT to start tracking predictions
              </p>
              <Button
                onClick={() => {
                  router.push('/dashboard');
                  onClose();
                }}
                className="w-full"
              >
                Claim NFT
              </Button>
            </div>
          )}

          {/* Connected Platforms */}
          {isRegistered && nftMetadata?.platformNames && nftMetadata.platformNames.length > 0 && (
            <div className="p-2.5 rounded-lg bg-surface">
              <p className="text-xs text-muted-foreground mb-2">Connected platforms</p>
              <div className="flex flex-wrap gap-1.5">
                {nftMetadata.platformNames.map((platform, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {platform}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Quick actions */}
          <div className="space-y-1">
            <button
              onClick={handleViewProfile}
              className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-surface transition-colors"
            >
              <div className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">View full profile</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>

            <button
              onClick={handleShareProfile}
              className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-surface transition-colors"
            >
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Share profile</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>

            <button
              onClick={() => {
                router.push('/dashboard');
                onClose();
              }}
              className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-surface transition-colors"
            >
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Dashboard</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <Separator />

          {/* Disconnect */}
          <Button
            variant="ghost"
            onClick={handleDisconnect}
            className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Disconnect wallet
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
