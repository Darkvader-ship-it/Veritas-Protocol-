'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Copy,
  CheckCircle2,
  AlertTriangle,
  Wallet,
  Shield,
  ExternalLink,
  ChevronDown,
  Loader2,
  Zap,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { COPY_TRADING_VAULT_ABI, COPY_VAULT_ADDRESS } from '@/lib/contracts';
import Link from 'next/link';

interface TraderStats {
  winRate: number;
  totalBets: number;
  totalVolume: string;
  platforms?: string[];
  veritasScore: number;
}

interface CopyTradeButtonProps {
  traderAddress: string;
  traderStats: TraderStats;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'default' | 'outline' | 'ghost';
}

export function CopyTradeButton({
  traderAddress,
  traderStats,
  size = 'sm',
  variant = 'default',
}: CopyTradeButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [allocation, setAllocation] = useState(20);
  const [maxBet, setMaxBet] = useState('0.5');
  const [showRiskInfo, setShowRiskInfo] = useState(false);

  const { address, isConnected } = useAccount();
  const { toast } = useToast();

  const vaultNotDeployed = COPY_VAULT_ADDRESS === '0x0000000000000000000000000000000000000000';

  const { data: userBalance, refetch: refetchBalance } = useReadContract({
    address: COPY_VAULT_ADDRESS,
    abi: COPY_TRADING_VAULT_ABI,
    functionName: 'balances',
    args: address ? [address] : undefined,
  });

  const { data: userFollowsData, refetch: refetchFollowed } = useReadContract({
    address: COPY_VAULT_ADDRESS,
    abi: COPY_TRADING_VAULT_ABI,
    functionName: 'getUserFollows',
    args: address ? [address] : undefined,
  });

  const followedLeaders = userFollowsData?.map((f: any) => f.leader) || [];

  const { writeContract: followLeader, data: followHash, isPending: isFollowing } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: followHash });

  useEffect(() => {
    if (isSuccess) {
      refetchBalance();
      refetchFollowed();
      toast({
        title: 'Copy Trading Activated!',
        description: `You're now following ${traderAddress.slice(0, 6)}...${traderAddress.slice(-4)}`,
      });
      setIsOpen(false);
    }
  }, [isSuccess, traderAddress, toast, refetchBalance, refetchFollowed]);

  const balance = userBalance ? formatEther(userBalance) : '0';
  const isAlreadyFollowing = followedLeaders?.some(
    (leader: string) => leader.toLowerCase() === traderAddress.toLowerCase()
  );

  const handleFollow = () => {
    if (!isConnected) {
      toast({ title: 'Wallet Not Connected', description: 'Please connect your wallet', variant: 'destructive' });
      return;
    }

    if (address?.toLowerCase() === traderAddress.toLowerCase()) {
      toast({ title: 'Cannot Copy Yourself', description: "You can't copy your own trades", variant: 'destructive' });
      return;
    }

    if (Number(balance) < 0.01) {
      toast({ title: 'Insufficient Balance', description: 'Please deposit at least 0.01 STT first', variant: 'destructive' });
      return;
    }

    const allocationBps = Math.min(allocation * 100, 5000);
    const maxBetWei = parseEther(maxBet);

    followLeader({
      address: COPY_VAULT_ADDRESS,
      abi: COPY_TRADING_VAULT_ABI,
      functionName: 'follow',
      args: [traderAddress as `0x${string}`, BigInt(allocationBps), maxBetWei],
    });
  };

  const estimatedCopyAmount = (parseFloat(balance) * allocation) / 100;
  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        size={size}
        variant={variant}
        className="gap-2"
        disabled={vaultNotDeployed}
      >
        <Copy className="w-4 h-4" />
        {isAlreadyFollowing ? 'Following' : 'Copy Trade'}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
          {/* Header */}
          <div className="relative p-5 pb-4 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Copy className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-lg">Copy This Trader</h2>
                <code className="text-xs text-muted-foreground font-mono">{formatAddress(traderAddress)}</code>
              </div>
            </div>
          </div>

          {/* Already Following Notice */}
          {isAlreadyFollowing && (
            <div className="mx-5 mt-4 p-3 rounded-lg bg-primary/10 border border-primary/20 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <p className="text-sm text-primary">Already following. Changes will update your settings.</p>
            </div>
          )}

          {/* Vault Balance Warning */}
          {Number(balance) < 0.01 && (
            <div className="mx-5 mt-4 p-3 rounded-lg bg-warning/10 border border-warning/20 flex items-start gap-2">
              <Wallet className="w-4 h-4 text-warning mt-0.5 shrink-0" />
              <div className="text-sm">
                <span className="font-medium text-warning">No vault balance.</span>
                <span className="text-muted-foreground"> Deposit STT to the vault first. </span>
                <Link href="/copy-trading" className="text-primary hover:underline inline-flex items-center gap-0.5">
                  Go to Vault <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>
          )}

          {/* Trader Stats - Compact */}
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-4 gap-2">
              <div className="p-3 rounded-lg bg-surface/50 text-center">
                <p className="text-lg font-bold text-success">{traderStats.winRate.toFixed(0)}%</p>
                <p className="text-[10px] text-muted-foreground">Win Rate</p>
              </div>
              <div className="p-3 rounded-lg bg-surface/50 text-center">
                <p className="text-lg font-bold">{traderStats.totalBets}</p>
                <p className="text-[10px] text-muted-foreground">Bets</p>
              </div>
              <div className="p-3 rounded-lg bg-surface/50 text-center">
                <p className="text-lg font-bold text-secondary">{traderStats.veritasScore}</p>
                <p className="text-[10px] text-muted-foreground">Score</p>
              </div>
              <div className="p-3 rounded-lg bg-surface/50 text-center">
                <p className="text-lg font-bold text-primary">{Number(balance).toFixed(2)}</p>
                <p className="text-[10px] text-muted-foreground">Your STT</p>
              </div>
            </div>

            {/* Configuration */}
            <div className="space-y-4">
              {/* Allocation Slider */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Allocation</Label>
                  <span className="text-sm font-bold text-primary">{allocation}%</span>
                </div>
                <Slider
                  value={[allocation]}
                  onValueChange={(v) => setAllocation(v[0])}
                  min={1}
                  max={50}
                  step={1}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  ~{estimatedCopyAmount.toFixed(4)} STT per trade
                </p>
              </div>

              {/* Max Bet */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Max Bet (STT)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={maxBet}
                  onChange={(e) => setMaxBet(e.target.value)}
                  className="h-10"
                  placeholder="0.5"
                />
              </div>
            </div>

            {/* Collapsible Risk Info */}
            <Collapsible open={showRiskInfo} onOpenChange={setShowRiskInfo}>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-surface/50 hover:bg-surface transition-colors">
                <div className="flex items-center gap-2 text-sm">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  <span>Security & Risk Info</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showRiskInfo ? 'rotate-180' : ''}`} />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-2">
                <div className="p-3 rounded-lg bg-surface/30 border border-border/30 space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-success mt-0.5 shrink-0" />
                    <span>Funds stay in vault contract until trades execute</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-success mt-0.5 shrink-0" />
                    <span>1-hour withdrawal time lock for security</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-success mt-0.5 shrink-0" />
                    <span>Unfollow any leader at any time</span>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-warning/5 border border-warning/20 space-y-2 text-xs">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-warning mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">Past performance doesn't guarantee future results</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-warning mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">3% platform fee per copied trade</span>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleFollow}
                disabled={isFollowing || isConfirming || !isConnected || Number(balance) < 0.01}
                className="flex-1 h-11"
                size="lg"
              >
                {isFollowing || isConfirming ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isFollowing ? 'Confirming...' : 'Processing...'}
                  </>
                ) : !isConnected ? (
                  'Connect Wallet'
                ) : Number(balance) < 0.01 ? (
                  'Deposit First'
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    {isAlreadyFollowing ? 'Update Settings' : 'Start Copying'}
                  </>
                )}
              </Button>
              <Button
                onClick={() => setIsOpen(false)}
                variant="outline"
                size="lg"
                disabled={isFollowing || isConfirming}
                className="h-11"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
