'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Trophy,
  ArrowRight,
  Loader2,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  X,
  Sparkles,
  Shield,
  TrendingUp,
  Clock,
  Network,
} from 'lucide-react';
import { useAccount, useSwitchChain, useWaitForTransactionReceipt } from 'wagmi';
import { somniaTestnet, somniaMainnet } from '@/lib/wagmi';
import { useVeritas } from '@/hooks/useVeritas';
import { useToast } from '@/hooks/use-toast';
import confetti from 'canvas-confetti';

const TIER_COLORS = {
  0: 'from-gray-600 to-gray-800',
  1: 'from-amber-600 to-amber-800',
  2: 'from-gray-400 to-gray-600',
  3: 'from-yellow-500 to-yellow-700',
  4: 'from-purple-600 to-purple-800',
  5: 'from-cyan-500 to-blue-600',
};

const TIER_NAMES = {
  0: 'Unranked',
  1: 'Bronze',
  2: 'Silver',
  3: 'Gold',
  4: 'Platinum',
  5: 'Diamond',
};

interface MintReputationNFTProps {
  onSuccess?: () => void;
}

export function MintReputationNFT({ onSuccess }: MintReputationNFTProps) {
  const { address, chainId } = useAccount();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { registerUser, isRegistering, refetchProfile } = useVeritas();
  const { toast } = useToast();

  const [isDismissed, setIsDismissed] = useState(false);
  const [mintStep, setMintStep] = useState<'idle' | 'signing' | 'confirming' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  // Check if user dismissed this session
  useEffect(() => {
    const dismissed = sessionStorage.getItem('nft_prompt_dismissed');
    const dismissedUntil = localStorage.getItem('nft_prompt_dismissed_until');

    if (dismissed === 'true') {
      setIsDismissed(true);
    }

    if (dismissedUntil) {
      const until = new Date(dismissedUntil);
      if (until > new Date()) {
        setIsDismissed(true);
      } else {
        localStorage.removeItem('nft_prompt_dismissed_until');
      }
    }
  }, []);

  // Wait for transaction confirmation
  const { isSuccess: isTxSuccess, isError: isTxError } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  useEffect(() => {
    if (isTxSuccess && mintStep === 'confirming') {
      setMintStep('success');

      // Fire confetti
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

      // Refetch profile on a staggered schedule - Somnia RPCs can lag
      // behind the wallet's confirmation, so one shot at 2s often reads stale state
      const timers = [
        setTimeout(() => {
          refetchProfile();
          onSuccess?.();
        }, 2000),
        setTimeout(() => refetchProfile(), 7000),
        setTimeout(() => refetchProfile(), 15000),
      ];
      return () => timers.forEach(clearTimeout);

      toast({
        title: "🎉 NFT Minted Successfully!",
        description: "Your Reputation NFT is now live on Somnia Testnet. Welcome to Veritas!",
      });
    }
  }, [isTxSuccess, mintStep, refetchProfile, onSuccess, toast]);

  // Handle transaction errors
  useEffect(() => {
    if (isTxError && mintStep === 'confirming') {
      setError('Transaction failed on the blockchain. Please try again.');
      setMintStep('error');
      toast({
        title: "Transaction Failed",
        description: "The transaction was rejected by the network. Please try again.",
        variant: "destructive",
      });
    }
  }, [isTxError, mintStep, toast]);

  // Add timeout for stuck transactions
  useEffect(() => {
    if (mintStep === 'confirming') {
      const timeout = setTimeout(() => {
        setError('Transaction is taking too long. It may have failed. Please check SomniaScan or try again.');
        setMintStep('error');
      }, 60000); // 60 second timeout

      return () => clearTimeout(timeout);
    }
  }, [mintStep]);

  const handleMint = async () => {
    setError(null);
    setMintStep('signing');

    try {
      console.log('🎯 Starting mint process...');
      console.log('registerUser function exists?', !!registerUser);

      const hash = await registerUser?.();

      console.log('📝 Transaction hash received:', hash);

      if (!hash) {
        throw new Error('No transaction hash returned. Transaction may have been rejected.');
      }

      setTxHash(hash);
      setMintStep('confirming');

      toast({
        title: "Transaction Submitted",
        description: `Hash: ${hash.slice(0, 10)}...${hash.slice(-8)}`,
      });
    } catch (err: any) {
      console.error('❌ Minting error:', err);
      console.error('Error details:', {
        message: err.message,
        shortMessage: err.shortMessage,
        code: err.code,
        details: err.details,
      });

      let errorMsg = 'Transaction failed. Please try again.';

      if (err.message?.includes('User rejected') || err.message?.includes('user rejected')) {
        errorMsg = 'Transaction was rejected. Please approve in your wallet to mint.';
      } else if (err.message?.includes('insufficient funds')) {
        errorMsg = 'Insufficient STT. You need at least 0.001 STT (0.0005 fee + gas).';
      } else if (err.message?.includes('No transaction hash')) {
        errorMsg = 'No transaction was created. Please check MetaMask and try again.';
      } else if (err.shortMessage) {
        errorMsg = err.shortMessage;
      } else if (err.message) {
        errorMsg = err.message;
      }

      setError(errorMsg);
      setMintStep('error');

      toast({
        title: "Minting Failed",
        description: errorMsg,
        variant: "destructive",
      });
    }
  };

  const handleDismiss = (duration: 'session' | '1day' | '7days') => {
    if (duration === 'session') {
      sessionStorage.setItem('nft_prompt_dismissed', 'true');
    } else {
      const days = duration === '1day' ? 1 : 7;
      const until = new Date();
      until.setDate(until.getDate() + days);
      localStorage.setItem('nft_prompt_dismissed_until', until.toISOString());
    }
    setIsDismissed(true);

    toast({
      title: "Reminder Hidden",
      description: `We'll remind you ${duration === 'session' ? 'next session' : `in ${days} day${days > 1 ? 's' : ''}`}.`,
    });
  };

  const handleReset = () => {
    setMintStep('idle');
    setError(null);
    setTxHash(undefined);
    toast({
      title: "Reset Complete",
      description: "Ready to try minting again.",
    });
  };

  // Don't show if dismissed
  if (isDismissed) return null;

  // Check network - Somnia Shannon Testnet (STT) 50312 + Somnia Mainnet 5031
  const isCorrectNetwork = chainId === somniaTestnet.id || chainId === somniaMainnet.id;
  const networkName = chainId === somniaTestnet.id ? 'Somnia Shannon Testnet' : chainId === somniaMainnet.id ? 'Somnia Mainnet' : `Chain ${chainId}`;

  // Success state
  if (mintStep === 'success') {
    return (
      <Card className="border-success/30 bg-success/5 overflow-hidden">
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 mx-auto rounded-full bg-success/20 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-success" />
            </div>
            <div>
              <h3 className="text-xl font-bold mb-2">🎉 Welcome to Veritas!</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Your Reputation NFT has been minted successfully.
              </p>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-success/10 border border-success/20">
                <Shield className="h-4 w-4 text-success" />
                <span className="text-sm font-medium text-success">Bronze Tier Unlocked</span>
              </div>
            </div>
            <div className="flex flex-col gap-2 pt-4">
              <Button
                onClick={() => window.open(`https://testnet.somniascan.com/tx/${txHash}`, '_blank')}
                variant="outline"
                size="sm"
              >
                View on SomniaScan
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <Button
                onClick={() => setIsDismissed(true)}
                variant="ghost"
                size="sm"
              >
                Close
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Main minting UI
  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-purple/5 overflow-hidden relative">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500 rounded-full blur-3xl" />
      </div>

      <CardContent className="p-6 relative">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg">
            <Trophy className="h-8 w-8 text-white" />
          </div>

          {/* Content */}
          <div className="flex-1 space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-bold text-lg">Mint Your Reputation NFT</h3>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                  <Sparkles className="h-3 w-3 mr-1" />
                  SBT
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Create your on-chain identity to unlock your reputation tier, track predictions permanently, and climb the leaderboard.
              </p>
            </div>

            {/* Benefits */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 text-xs">
                <div className="w-6 h-6 rounded-lg bg-success/10 flex items-center justify-center">
                  <Shield className="h-3 w-3 text-success" />
                </div>
                <span>Tier System</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <TrendingUp className="h-3 w-3 text-blue-500" />
                </div>
                <span>Leaderboard</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-6 h-6 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Trophy className="h-3 w-3 text-purple-500" />
                </div>
                <span>On-Chain Proof</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Sparkles className="h-3 w-3 text-amber-500" />
                </div>
                <span>Permanent ID</span>
              </div>
            </div>

            {/* Network status */}
            <div className="flex items-center gap-2 p-2 rounded-lg bg-surface/50 border border-border/50">
              <Network className={`h-4 w-4 ${isCorrectNetwork ? 'text-success' : 'text-warning'}`} />
              <span className="text-xs">
                Network: <span className={`font-medium ${isCorrectNetwork ? 'text-success' : 'text-warning'}`}>
                  {networkName} {isCorrectNetwork ? '✓' : '✗'}
                </span>
              </span>
            </div>

            {/* Wrong network warning */}
            {!isCorrectNetwork && (
              <Alert variant="destructive" className="border-warning/50 bg-warning/5">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <AlertDescription className="text-warning">
                  Please switch to Somnia Shannon Testnet (ChainID: 50312) to mint your NFT.
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 w-full"
                    disabled={isSwitching}
                    onClick={() => {
                      try {
                        switchChain({ chainId: somniaTestnet.id });
                      } catch (e: any) {
                        toast({ title: 'Switch failed', description: e?.message || 'Rejected', variant: 'destructive' });
                      }
                    }}
                  >
                    {isSwitching ? 'Switching…' : 'Switch to Somnia Testnet'}
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Error message */}
            {error && mintStep === 'error' && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Minting progress */}
            {(mintStep === 'signing' || mintStep === 'confirming') && (
              <div className="space-y-2">
                <Progress value={mintStep === 'signing' ? 33 : 66} className="h-2" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>
                      {mintStep === 'signing' ? 'Waiting for wallet signature...' : 'Confirming transaction...'}
                    </span>
                  </div>
                  {mintStep === 'confirming' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleReset}
                      className="h-6 text-xs"
                    >
                      Reset
                    </Button>
                  )}
                </div>
                {txHash && mintStep === 'confirming' && (
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>TX: {txHash.slice(0, 10)}...{txHash.slice(-8)}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(`https://testnet.somniascan.com/tx/${txHash}`, '_blank')}
                      className="h-5 text-[10px] px-2"
                    >
                      View
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                onClick={mintStep === 'error' ? handleReset : handleMint}
                disabled={isRegistering || !isCorrectNetwork || mintStep === 'signing' || mintStep === 'confirming'}
                className="flex-1"
              >
                {mintStep === 'signing' || mintStep === 'confirming' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {mintStep === 'signing' ? 'Sign Transaction' : 'Confirming'}
                  </>
                ) : mintStep === 'error' ? (
                  <>
                    Try Again
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                ) : (
                  <>
                    Mint for 0.0005 STT
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>

              {/* Remind me later dropdown */}
              <div className="relative group">
                <Button variant="ghost" size="sm" className="h-10">
                  <Clock className="h-4 w-4" />
                </Button>
                <div className="absolute right-0 mt-2 w-48 bg-surface border border-border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  <div className="p-1">
                    <button
                      onClick={() => handleDismiss('session')}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-white/5 rounded"
                    >
                      Remind this session
                    </button>
                    <button
                      onClick={() => handleDismiss('1day')}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-white/5 rounded"
                    >
                      Remind in 1 day
                    </button>
                    <button
                      onClick={() => handleDismiss('7days')}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-white/5 rounded"
                    >
                      Remind in 7 days
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground">
              This is a Soulbound Token (SBT) - non-transferable and permanently tied to your wallet.
              Gas fees apply (~0.0002 STT). Network: Somnia Testnet.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
