'use client'


import { useState, useEffect, useCallback } from 'react';
import { useCopyTradingSimStats, useDreamDEXSimulationTab } from '@/lib/queries';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, formatEther, parseUnits, formatUnits } from 'viem';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Users,
  Activity,
  Wallet,
  Clock,
  Shield,
  TrendingUp,
  AlertTriangle,
  ExternalLink,
  Lock,
  Unlock,
  Plus,
  Minus,
  Eye,
  FlaskConical,
  CheckCircle2,
  XCircle,
  Timer,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Droplets,
} from 'lucide-react';
import Link from 'next/link';
import { COPY_TRADING_VAULT_ABI, COPY_VAULT_ADDRESS, DREAMDEX_COPY_VAULT_ABI, DREAMDEX_COPY_VAULT_ADDRESS, ERC20_ABI, SOMNIA_DREAMDEX } from '@/lib/contracts';
import { PolymarketSimulationTab } from '@/components/PolymarketSimulation';
import { DreamDEXVaultTab } from '@/components/DreamDEXVaultTab';
import { PAGE_HEADER, TAB_STYLES, shortenAddress } from '@/components/ui/design-tokens';

function SimulationTab({ followerAddress }: { followerAddress?: string }) {
  // REAL testnet: read on-chain DreamDEX Copy Vault, not simulated table
  const vaultAddr = DREAMDEX_COPY_VAULT_ADDRESS as `0x${string}`;
  const { data: vaultBalanceRaw } = useReadContract({
    address: vaultAddr,
    abi: DREAMDEX_COPY_VAULT_ABI,
    functionName: 'balances',
    args: followerAddress ? [followerAddress as `0x${string}`] : undefined,
    query: { enabled: !!followerAddress },
  });
  const { data: vaultHistoryRaw } = useReadContract({
    address: vaultAddr,
    abi: DREAMDEX_COPY_VAULT_ABI,
    functionName: 'getUserTradeHistory',
    args: followerAddress ? [followerAddress as `0x${string}`] : undefined,
    query: { enabled: !!followerAddress },
  });
  const { data: vaultStatsRaw } = useReadContract({
    address: vaultAddr,
    abi: DREAMDEX_COPY_VAULT_ABI,
    functionName: 'getVaultStats',
  });
  const vaultBalance = vaultBalanceRaw ? Number(formatUnits(vaultBalanceRaw as bigint, 6)) : 0;
  const history: any[] = Array.isArray(vaultHistoryRaw) ? vaultHistoryRaw : [];
  const tvl = vaultStatsRaw ? Number(formatUnits((vaultStatsRaw as any)[0] as bigint, 6)) : 0;
  // Derive stats from history (real)
  const totalTrades = history.length;
  const wins = 0; // resolved via BinarySettlement off-chain; show pending/executed for now
  const pending = history.length; // all not yet settled in this MVP view
  const totalPnlTUSDC = 0; // PnL after redeem; tUSDC
  const winRate = 'N/A';

  return (
    <div className="space-y-4">
      <Alert className="border-fuchsia-500/30 bg-fuchsia-500/5">
        <Droplets className="h-4 w-4 text-fuchsia-500" />
        <AlertDescription>
          <span className="font-medium">Real testnet (Somnia 50312):</span> tUSDC 6dec via DreamDEX Vault <span className="font-mono text-xs">{vaultAddr.slice(0,6)}...{vaultAddr.slice(-4)}</span> • STT gas • Funds at risk (testnet).
        </AlertDescription>
      </Alert>

      {/* Stats Grid — REAL */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{totalTrades}</p>
            <p className="text-xs text-muted-foreground">Real trades (tUSDC)</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-success">{winRate}</p>
            <p className="text-xs text-muted-foreground">Win rate</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <p className={`text-2xl font-bold ${totalPnlTUSDC >= 0 ? 'text-success' : 'text-destructive'}`}>
              {totalPnlTUSDC >= 0 ? '+' : ''}{totalPnlTUSDC.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">Real PnL (tUSDC)</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-warning">{vaultBalance.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Vault tUSDC</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Trades — REAL */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent real trades</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length > 0 ? (
            <div className="space-y-2">
              {history.slice(0, 10).map((h: any, i: number) => {
                const copyAmt = (() => { try { return Number(h.copyAmount)/1e6; } catch { return 0; } })();
                return (
                <div
                  key={`${h.marketId}-${i}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-surface hover:bg-surface-raised transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-fuchsia-500/10 flex items-center justify-center">
                      <Droplets className="h-4 w-4 text-fuchsia-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {String(h.marketId).slice(0,10)}... - {h.isUp ? 'Up' : 'Down'}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {String(h.leader).slice(0, 8)}... → {String(h.follower).slice(0,8)}...
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono font-medium">{copyAmt.toFixed(2)} tUSDC</p>
                    <Badge variant="outline" className="text-xs border-fuchsia-500/30 text-fuchsia-500">COPIED</Badge>
                  </div>
                </div>
              )})}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Droplets className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No real trades yet</p>
              <p className="text-xs mt-1">Deposit tUSDC and follow a leader — real copy trades will appear here</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* How it works — REAL */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">How real copy works (testnet)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {[
              { num: 1, text: 'Deposit tUSDC (faucet) + STT gas on Somnia 50312 and follow a leader' },
              { num: 2, text: 'When leader places DreamDEX market bet (Up/Down), executor batchExecuteCopyTrades deducts your vault' },
              { num: 3, text: 'Vault mints complete set via CollateralRouter + places IOC order on OutcomeToken6909' },
              { num: 4, text: 'After market Finalized, redeem via BinarySettlement — PnL in tUSDC, VeritasScore updates' },
            ].map(({ num, text }) => (
              <div key={num} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-fuchsia-500/10 text-fuchsia-500 text-xs font-medium flex items-center justify-center shrink-0">
                  {num}
                </div>
                <p className="text-sm text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function CopyTradingDashboard() {
  const account = useAccount();
  const [mounted, setMounted] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const { toast } = useToast();

  // React Query hook for simulation stats - automatic 30s polling
  const { data: simStats } = useCopyTradingSimStats();

  useEffect(() => {
    setMounted(true);
  }, []);

  const isConnected = mounted && !!account.address;
  const address = account.address;
  const isTUSDCVault = COPY_VAULT_ADDRESS.toLowerCase() === DREAMDEX_COPY_VAULT_ADDRESS.toLowerCase();

  const { data: vaultStats, refetch: refetchStats } = useReadContract({
    address: isTUSDCVault ? DREAMDEX_COPY_VAULT_ADDRESS : COPY_VAULT_ADDRESS,
    abi: isTUSDCVault ? DREAMDEX_COPY_VAULT_ABI : COPY_TRADING_VAULT_ABI,
    functionName: 'getVaultStats',
  });

  const { data: maxVaultSize } = useReadContract({
    address: isTUSDCVault ? DREAMDEX_COPY_VAULT_ADDRESS : COPY_VAULT_ADDRESS,
    abi: isTUSDCVault ? DREAMDEX_COPY_VAULT_ABI : COPY_TRADING_VAULT_ABI,
    functionName: 'MAX_VAULT_SIZE',
  });

  const { data: withdrawalDelay } = useReadContract({
    address: COPY_VAULT_ADDRESS,
    abi: COPY_TRADING_VAULT_ABI,
    functionName: 'WITHDRAWAL_DELAY',
  });

  const { data: minDeposit } = useReadContract({
    address: COPY_VAULT_ADDRESS,
    abi: COPY_TRADING_VAULT_ABI,
    functionName: 'MIN_DEPOSIT',
  });

  const { data: isPaused } = useReadContract({
    address: COPY_VAULT_ADDRESS,
    abi: COPY_TRADING_VAULT_ABI,
    functionName: 'paused',
  });

  const { data: maxAllocationBps } = useReadContract({
    address: COPY_VAULT_ADDRESS,
    abi: COPY_TRADING_VAULT_ABI,
    functionName: 'MAX_ALLOCATION_BPS',
  });

  const { data: protocolFeeBps } = useReadContract({
    address: COPY_VAULT_ADDRESS,
    abi: COPY_TRADING_VAULT_ABI,
    functionName: 'PROTOCOL_FEE_BPS',
  });

  const { data: dreamDEX } = useReadContract({
    address: COPY_VAULT_ADDRESS,
    abi: COPY_TRADING_VAULT_ABI,
    functionName: 'DREAMDEX_PREDICTION',
  });

  const { data: userBalance, refetch: refetchBalance } = useReadContract({
    address: isTUSDCVault ? DREAMDEX_COPY_VAULT_ADDRESS : COPY_VAULT_ADDRESS,
    abi: isTUSDCVault ? DREAMDEX_COPY_VAULT_ABI : COPY_TRADING_VAULT_ABI,
    functionName: 'balances',
    args: address ? [address] : undefined,
  });

  const { data: pendingWithdrawal, refetch: refetchPending } = useReadContract({
    address: COPY_VAULT_ADDRESS,
    abi: COPY_TRADING_VAULT_ABI,
    functionName: 'getPendingWithdrawal',
    args: address ? [address] : undefined,
  });

  const { data: tusdcBalance, refetch: refetchTUSDCBalance } = useReadContract({
    address: SOMNIA_DREAMDEX.collateralTUSDC as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  });

  const { data: tusdcAllowance, refetch: refetchTUSDCAllowance } = useReadContract({
    address: SOMNIA_DREAMDEX.collateralTUSDC as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, DREAMDEX_COPY_VAULT_ADDRESS] : undefined,
  });

  const { data: vaultHistoryTopRaw } = useReadContract({
    address: DREAMDEX_COPY_VAULT_ADDRESS as `0x${string}`,
    abi: DREAMDEX_COPY_VAULT_ABI,
    functionName: 'getUserTradeHistory',
    args: address ? [address as `0x${string}`] : undefined,
    query: { enabled: !!address },
  });

  // Fetch follows from database OR extract from simulated trades
  const [dbFollows, setDbFollows] = useState<any[]>([]);
  const [simLeaders, setSimLeaders] = useState<any[]>([]);

  const fetchDbFollows = async () => {
    if (!address) return;
    try {
      // First try explicit follows
      const res = await fetch(`/api/copy-trade/follow?follower=${address}`);
      const data = await res.json();
      if (data.success && data.follows) {
        // Filter to only include follows where the follower matches our address
        const myFollows = data.follows.filter((f: any) =>
          f.is_active && f.follower?.wallet_address?.toLowerCase() === address.toLowerCase()
        );
        setDbFollows(myFollows);

        // If no explicit follows, get leaders from simulated trades
        if (myFollows.length === 0) {
          const simRes = await fetch(`/api/copy-trading/simulation?limit=100&follower=${address}`);
          const simData = await simRes.json();
          if (simData.trades && simData.trades.length > 0) {
            // Extract unique leaders
            const leaderMap = new Map();
            simData.trades.forEach((t: any) => {
              if (t.leader && !leaderMap.has(t.leader)) {
                leaderMap.set(t.leader, {
                  id: t.leader,
                  trader: { wallet_address: t.leader },
                  fromSimulation: true,
                  tradeCount: 0,
                });
              }
              if (t.leader) {
                leaderMap.get(t.leader).tradeCount++;
              }
            });
            setSimLeaders(Array.from(leaderMap.values()));
          }
        }
      }
    } catch (e) {
      console.error('Error fetching follows:', e);
    }
  };

  useEffect(() => {
    if (address) {
      fetchDbFollows();
    }
  }, [address]);

  const refetchLeaders = fetchDbFollows;
  // Use explicit follows if any, otherwise use leaders from simulation
  const followedLeaders = dbFollows.length > 0 ? dbFollows : simLeaders;

  const { writeContract: deposit, data: depositHash, isPending: isDepositing } = useWriteContract();
  const { writeContract: requestWithdraw, data: withdrawHash, isPending: isWithdrawing } = useWriteContract();
  const { writeContract: executeWithdraw, data: executeHash, isPending: isExecuting } = useWriteContract();
  const { writeContract: cancelWithdraw, data: cancelHash, isPending: isCancelling } = useWriteContract();
  const { writeContract: faucetTUSDC, data: faucetHash, isPending: isFauceting } = useWriteContract();
  const { writeContract: approveTUSDC, data: approveHash, isPending: isApproving } = useWriteContract();

  const { isLoading: isDepositConfirming, isSuccess: depositSuccess } = useWaitForTransactionReceipt({ hash: depositHash });
  const { isLoading: isWithdrawConfirming, isSuccess: withdrawSuccess } = useWaitForTransactionReceipt({ hash: withdrawHash });
  const { isLoading: isExecuteConfirming, isSuccess: executeSuccess } = useWaitForTransactionReceipt({ hash: executeHash });
  const { isLoading: isCancelConfirming, isSuccess: cancelSuccess } = useWaitForTransactionReceipt({ hash: cancelHash });
  const { isLoading: isFaucetConfirming, isSuccess: faucetSuccess } = useWaitForTransactionReceipt({ hash: faucetHash });
  const { isLoading: isApproveConfirming, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveHash });

  useEffect(() => {
    if (faucetSuccess) {
      refetchTUSDCBalance();
      toast({ title: "tUSDC received!", description: "1000 tUSDC minted. Now deposit in this tab or DreamDEX tab.", variant: "default" });
    }
  }, [faucetSuccess]);

  useEffect(() => {
    if (approveSuccess) {
      refetchTUSDCAllowance();
      toast({ title: "Approved!", description: "tUSDC approved. Depositing...", variant: "default" });
      const amt = parseUnits(depositAmount || '0', 6);
      if (amt >= BigInt(1_000_000)) {
        deposit({ address: DREAMDEX_COPY_VAULT_ADDRESS, abi: DREAMDEX_COPY_VAULT_ABI, functionName: 'deposit', args: [amt] });
      }
    }
  }, [approveSuccess]);

  useEffect(() => {
    if (depositSuccess) {
      refetchBalance();
      refetchStats();
      refetchTUSDCBalance();
      refetchTUSDCAllowance();
      setDepositAmount('');
      toast({
        title: "Deposit Successful!",
        description: `Successfully deposited ${depositAmount} tUSDC to your copy trading vault.`,
        variant: "default",
      });
    }
  }, [depositSuccess]);

  useEffect(() => {
    if (withdrawSuccess) {
      refetchPending();
      setWithdrawAmount('');
      toast({
        title: "Withdrawal Requested",
        description: `Withdrawal of ${withdrawAmount} STT initiated. Wait ${delayHours} hour(s) to execute.`,
        variant: "default",
      });
    }
  }, [withdrawSuccess]);

  useEffect(() => {
    if (executeSuccess) {
      refetchBalance();
      refetchPending();
      toast({
        title: "Withdrawal Executed!",
        description: `Successfully withdrawn ${pendingAmount} STT to your wallet.`,
        variant: "default",
      });
    }
  }, [executeSuccess]);

  useEffect(() => {
    if (cancelSuccess) {
      refetchPending();
      toast({
        title: "Withdrawal Cancelled",
        description: "Your pending withdrawal has been cancelled.",
        variant: "default",
      });
    }
  }, [cancelSuccess]);

  const tvl = vaultStats ? (isTUSDCVault ? formatUnits(vaultStats[0] as bigint, 6) : formatEther(vaultStats[0] as bigint)) : '0';
  const totalCopyTrades = vaultStats ? Number(vaultStats[1]) : 0;
  const totalVolume = vaultStats ? (isTUSDCVault ? formatUnits(vaultStats[2] as bigint, 6) : formatEther(vaultStats[2] as bigint)) : '0';
  const executorAddress = vaultStats ? (isTUSDCVault ? (vaultStats[3] as string) : (vaultStats[4] as string)) : null;
  const maxSize = maxVaultSize ? (isTUSDCVault ? formatUnits(maxVaultSize as bigint, 6) : formatEther(maxVaultSize as bigint)) : '100';
  const utilizationPercent = maxVaultSize && vaultStats ? (Number(isTUSDCVault ? formatUnits(vaultStats[0] as bigint, 6) : formatEther(vaultStats[0] as bigint)) / Number(isTUSDCVault ? formatUnits(maxVaultSize as bigint, 6) : formatEther(maxVaultSize as bigint))) * 100 : 0;
  const delayHours = withdrawalDelay ? Number(withdrawalDelay) / 3600 : 1;
  const minDepositSTT = minDeposit ? (isTUSDCVault ? formatUnits(minDeposit as bigint, 6) : formatEther(minDeposit as bigint)) : isTUSDCVault ? '1' : '0.01';
  const maxAllocationPercent = maxAllocationBps ? Number(maxAllocationBps) / 100 : 50;
  const protocolFeePercent = protocolFeeBps ? Number(protocolFeeBps) / 100 : 10;
  const isContractPaused = isPaused ?? false;
  const dreamdexAddress = dreamDEX as `0x${string}` | undefined;

  const balance = userBalance ? (isTUSDCVault ? formatUnits(userBalance as bigint, 6) : formatEther(userBalance as bigint)) : '0';
  const pendingAmount = pendingWithdrawal ? formatEther(pendingWithdrawal[0] as bigint) : '0';
  const unlockTime = pendingWithdrawal ? Number(pendingWithdrawal[1]) : 0;
  const hasPendingWithdrawal = Number(pendingAmount) > 0;
  const canExecuteWithdrawal = hasPendingWithdrawal && unlockTime > 0 && Date.now() / 1000 >= unlockTime;
  const leadersCount = followedLeaders?.length || 0;

  const handleDeposit = () => {
    const isTUSDCVault = COPY_VAULT_ADDRESS.toLowerCase() === DREAMDEX_COPY_VAULT_ADDRESS.toLowerCase();
    if (isTUSDCVault) {
      try {
        if (!depositAmount || Number(depositAmount) <= 0) {
          toast({ title: "Invalid Amount", description: "Enter amount >0", variant: "destructive" });
          return;
        }
        const amt = parseUnits(depositAmount, 6);
        if (amt < BigInt(1_000_000)) {
          toast({ title: "Amount Too Low", description: "Minimum 1 tUSDC", variant: "destructive" });
          return;
        }
        const bal = (tusdcBalance as bigint | undefined) || 0n;
        if (bal < amt) {
          toast({ title: "Insufficient tUSDC", description: `You have ${formatUnits(bal, 6)} tUSDC. Tap Get 1000 tUSDC first.`, variant: "destructive" });
          return;
        }
        const allowance = (tusdcAllowance as bigint | undefined) || 0n;
        if (allowance < amt) {
          approveTUSDC({
            address: SOMNIA_DREAMDEX.collateralTUSDC as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [DREAMDEX_COPY_VAULT_ADDRESS, amt],
          });
          toast({ title: "Approving...", description: `Approving ${depositAmount} tUSDC` });
          return;
        }
        deposit({ address: DREAMDEX_COPY_VAULT_ADDRESS, abi: DREAMDEX_COPY_VAULT_ABI, functionName: 'deposit', args: [amt] });
      } catch (e: any) {
        toast({ title: "Deposit Failed", description: e?.message || "Failed", variant: "destructive" });
      }
      return;
    }
    try {
      if (!depositAmount || Number(depositAmount) <= 0) {
        toast({
          title: "Invalid Amount",
          description: "Please enter a valid deposit amount greater than 0.",
          variant: "destructive",
        });
        return;
      }

      if (Number(depositAmount) < Number(minDepositSTT)) {
        toast({
          title: "Amount Too Low",
          description: `Minimum deposit is ${minDepositSTT} STT.`,
          variant: "destructive",
        });
        return;
      }

      deposit({
        address: COPY_VAULT_ADDRESS,
        abi: COPY_TRADING_VAULT_ABI,
        functionName: 'deposit',
        value: parseEther(depositAmount),
      });
    } catch (error: any) {
      toast({
        title: "Deposit Failed",
        description: error?.message || "Failed to initiate deposit. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleFaucet = () => {
    try {
      faucetTUSDC({
        address: SOMNIA_DREAMDEX.collateralTUSDC as `0x${string}`,
        abi: [{ name: 'faucet', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] }],
        functionName: 'faucet',
        args: [parseUnits('1000', 6)],
      });
    } catch (e: any) {
      toast({ title: "Faucet failed", description: e?.message || "Try again", variant: "destructive" });
    }
  };

  const handleRequestWithdraw = () => {
    if (isTUSDCVault) {
      try {
        if (!withdrawAmount || Number(withdrawAmount) <= 0) {
          toast({ title: "Invalid Amount", description: "Enter amount >0", variant: "destructive" });
          return;
        }
        const amt = parseUnits(withdrawAmount, 6);
        const bal = (userBalance as bigint | undefined) || 0n;
        if (bal < amt) {
          toast({ title: "Insufficient Balance", description: `You have ${formatUnits(bal, 6)} tUSDC`, variant: "destructive" });
          return;
        }
        // tUSDC vault: immediate withdraw, no timelock
        requestWithdraw({
          address: DREAMDEX_COPY_VAULT_ADDRESS,
          abi: DREAMDEX_COPY_VAULT_ABI,
          functionName: 'withdraw',
          args: [amt],
        });
      } catch (e: any) {
        toast({ title: "Withdraw Failed", description: e?.message || "Failed", variant: "destructive" });
      }
      return;
    }
    try {
      if (!withdrawAmount || Number(withdrawAmount) <= 0) {
        toast({
          title: "Invalid Amount",
          description: "Please enter a valid withdrawal amount greater than 0.",
          variant: "destructive",
        });
        return;
      }

      if (Number(withdrawAmount) > Number(balance)) {
        toast({
          title: "Insufficient Balance",
          description: `You only have ${balance} STT available. Cannot withdraw ${withdrawAmount} STT.`,
          variant: "destructive",
        });
        return;
      }

      if (hasPendingWithdrawal) {
        toast({
          title: "Pending Withdrawal Exists",
          description: "You already have a pending withdrawal. Execute or cancel it first.",
          variant: "destructive",
        });
        return;
      }

      requestWithdraw({
        address: COPY_VAULT_ADDRESS,
        abi: COPY_TRADING_VAULT_ABI,
        functionName: 'requestWithdrawal',
        args: [parseEther(withdrawAmount)],
      });
    } catch (error: any) {
      toast({
        title: "Withdrawal Request Failed",
        description: error?.message || "Failed to request withdrawal. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleExecuteWithdraw = () => {
    try {
      if (!canExecuteWithdrawal) {
        const remaining = formatTimeRemaining(unlockTime);
        toast({
          title: "Cannot Execute Yet",
          description: `Withdrawal is time-locked. ${remaining}`,
          variant: "destructive",
        });
        return;
      }

      executeWithdraw({
        address: COPY_VAULT_ADDRESS,
        abi: COPY_TRADING_VAULT_ABI,
        functionName: 'executeWithdrawal',
      });
    } catch (error: any) {
      toast({
        title: "Execution Failed",
        description: error?.message || "Failed to execute withdrawal. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCancelWithdraw = () => {
    try {
      if (!hasPendingWithdrawal) {
        toast({
          title: "No Pending Withdrawal",
          description: "You don't have any pending withdrawals to cancel.",
          variant: "destructive",
        });
        return;
      }

      cancelWithdraw({
        address: COPY_VAULT_ADDRESS,
        abi: COPY_TRADING_VAULT_ABI,
        functionName: 'cancelWithdrawal',
      });
    } catch (error: any) {
      toast({
        title: "Cancellation Failed",
        description: error?.message || "Failed to cancel withdrawal. Please try again.",
        variant: "destructive",
      });
    }
  };

  function formatTimeRemaining(unlockTimestamp: number): string {
    const now = Date.now() / 1000;
    const remaining = unlockTimestamp - now;
    if (remaining <= 0) return 'Ready to withdraw';
    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    return `${hours}h ${minutes}m remaining`;
  }

  if (!mounted) return null;

  const vaultNotDeployed = COPY_VAULT_ADDRESS === '0x0000000000000000000000000000000000000000';

  if (vaultNotDeployed) {
    return (
      <div className="container py-16 max-w-lg text-center">
        <div className="w-16 h-16 rounded-full bg-warning/10 mx-auto mb-4 flex items-center justify-center">
          <AlertTriangle className="h-8 w-8 text-warning" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Copy trading coming soon</h1>
        <p className="text-muted-foreground">The vault contract has not been deployed yet.</p>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="container py-16 max-w-lg text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 mx-auto mb-4 flex items-center justify-center">
          <Wallet className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Connect your wallet</h1>
        <p className="text-muted-foreground">Connect your wallet to access copy trading.</p>
      </div>
    );
  }

  return (
    <div className="container px-4 md:px-6 py-6 max-w-5xl">
      {/* Header - Better mobile spacing */}
      <div className="mb-5">
        <div className={PAGE_HEADER.container}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-white" />
              </div>
              <h1 className={PAGE_HEADER.title}>Copy trading</h1>
            </div>
            <p className={PAGE_HEADER.subtitle}>Automatically copy trades from top performers</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs border-success/30 text-success bg-success/5">
              <Shield className="h-3 w-3 mr-1" />
              {delayHours}h lock
            </Badge>
            {executorAddress && (
              <a
                href={`https://somniascan.com/address/${executorAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
              >
                Executor <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Stats Row - Better mobile horizontal scroll */}
      <div className="mb-5 overflow-hidden">
        <div className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-4 snap-x scrollbar-hide">
          <Card className="border-border/50 bg-card min-w-[150px] md:min-w-0 snap-start shrink-0 md:shrink">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Lock className="h-4 w-4 text-primary" />
                </div>
                <span className="text-xs text-muted-foreground font-medium">TVL</span>
              </div>
              <p className="text-xl font-bold">{Number(tvl).toFixed(2)} <span className="text-xs font-normal text-muted-foreground">{isTUSDCVault ? 'tUSDC' : 'STT'}</span></p>
              <Progress value={utilizationPercent} className="h-1.5 mt-2" />
              <p className="text-[10px] text-muted-foreground mt-1">{utilizationPercent.toFixed(0)}% of {Number(maxSize).toLocaleString()} {isTUSDCVault ? 'tUSDC' : 'STT'}</p>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card min-w-[140px] md:min-w-0 snap-start shrink-0 md:shrink">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-fuchsia-500/20 flex items-center justify-center">
                  <Droplets className="h-4 w-4 text-fuchsia-500" />
                </div>
                <span className="text-xs text-muted-foreground font-medium">Real Trades</span>
              </div>
              <p className="text-xl font-bold">{Array.isArray(vaultHistoryTopRaw) ? (vaultHistoryTopRaw as any[]).length : 0}</p>
              <p className="text-xs text-fuchsia-500 font-medium mt-1">tUSDC 50312 • {vaultHistoryTopRaw ? `${(vaultHistoryTopRaw as any[]).length} copied` : 'no trades yet'}</p>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card min-w-[150px] md:min-w-0 snap-start shrink-0 md:shrink">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-success/20 flex items-center justify-center">
                  <Wallet className="h-4 w-4 text-success" />
                </div>
                <span className="text-xs text-muted-foreground font-medium">Balance</span>
              </div>
              <p className="text-xl font-bold">{Number(balance).toFixed(2)} <span className="text-xs font-normal text-muted-foreground">{isTUSDCVault ? 'tUSDC' : 'STT'}</span></p>
              <p className="text-xs mt-1 font-medium text-fuchsia-500">
                Real • {Number(balance).toFixed(2)} tUSDC in vault
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card min-w-[130px] md:min-w-0 snap-start shrink-0 md:shrink">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-secondary/20 flex items-center justify-center">
                  <Users className="h-4 w-4 text-secondary" />
                </div>
                <span className="text-xs text-muted-foreground font-medium">Following</span>
              </div>
              <p className="text-xl font-bold">{leadersCount}</p>
              <p className="text-xs text-muted-foreground mt-1">leaders</p>
            </CardContent>
          </Card>
        </div>
      </div>

        {/* Tabs - Improved styling */}
        <Tabs defaultValue="deposit" className="space-y-4">
          <TabsList className={`${TAB_STYLES.list} rounded-xl grid grid-cols-6`}>
            <TabsTrigger value="deposit" className={TAB_STYLES.trigger}>
              <Wallet className="w-4 h-4" />
              <span className="hidden sm:inline">Funds</span>
            </TabsTrigger>
            <TabsTrigger value="leaders" className={TAB_STYLES.trigger}>
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Leaders</span>
            </TabsTrigger>
            <TabsTrigger value="dreamdex" className={`${TAB_STYLES.trigger} data-[state=active]:bg-fuchsia-600 data-[state=active]:text-white`}>
              <Droplets className="w-4 h-4" />
              <span className="hidden sm:inline">DreamDEX</span>
            </TabsTrigger>
            <TabsTrigger value="simulation" className={`${TAB_STYLES.trigger} data-[state=active]:bg-fuchsia-600 data-[state=active]:text-white`}>
              <Droplets className="w-4 h-4" />
              <span className="hidden sm:inline">Real</span>
            </TabsTrigger>
            <TabsTrigger value="polymarket" className={TAB_STYLES.trigger}>
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Polymarket</span>
            </TabsTrigger>
            <TabsTrigger value="transparency" className={TAB_STYLES.trigger}>
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">Security</span>
            </TabsTrigger>
          </TabsList>

        {/* Deposit/Withdraw Tab */}
        <TabsContent value="deposit" className={TAB_STYLES.content}>
          {/* Desktop: Side by side */}
          <div className="hidden md:grid md:grid-cols-2 gap-4">
            {/* Deposit */}
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Plus className="h-4 w-4 text-primary" />
                  Deposit
                </CardTitle>
                <CardDescription>Add funds to your copy trading balance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="deposit-desktop" className="text-sm">Amount (tUSDC)</Label>
                  <Input
                    id="deposit-desktop"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.1"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="mt-1.5"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Minimum: 1 tUSDC</p>
                </div>
                <Button
                  onClick={handleFaucet}
                  disabled={isFauceting || isFaucetConfirming}
                  variant="outline"
                  className="w-full"
                >
                  {isFauceting || isFaucetConfirming ? <Activity className="h-4 w-4 animate-spin mr-2" /> : <Droplets className="h-4 w-4 mr-2" />}
                  {isFauceting ? 'Confirming...' : isFaucetConfirming ? 'Processing...' : 'Get 1000 tUSDC (faucet)'}
                </Button>
                <Button
                  onClick={handleDeposit}
                  disabled={isDepositing || isDepositConfirming || !depositAmount}
                  className="w-full bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 shadow-lg shadow-primary/25"
                >
                  {isDepositing || isDepositConfirming ? (
                    <Activity className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  {isDepositing ? 'Confirming...' : isDepositConfirming ? 'Processing...' : 'Deposit'}
                </Button>
              </CardContent>
            </Card>

            {/* Withdraw */}
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Minus className="h-4 w-4 text-warning" />
                  Withdraw
                </CardTitle>
                <CardDescription>{delayHours}-hour time lock for security</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {hasPendingWithdrawal ? (
                  <>
                    <Alert className="border-warning/30 bg-warning/5">
                      <Clock className="h-4 w-4 text-warning" />
                      <AlertDescription>
                        <span className="font-medium">{pendingAmount} STT</span> pending
                        <br />
                        <span className="text-sm">{formatTimeRemaining(unlockTime)}</span>
                      </AlertDescription>
                    </Alert>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleExecuteWithdraw}
                        disabled={!canExecuteWithdrawal || isExecuting || isExecuteConfirming}
                        className="flex-1"
                      >
                        {isExecuting || isExecuteConfirming ? (
                          <Activity className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Unlock className="h-4 w-4 mr-2" />
                        )}
                        Execute
                      </Button>
                      <Button
                        onClick={handleCancelWithdraw}
                        disabled={isCancelling || isCancelConfirming}
                        variant="outline"
                      >
                        {isCancelling || isCancelConfirming ? (
                          <Activity className="h-4 w-4 animate-spin" />
                        ) : (
                          'Cancel'
                        )}
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <Label htmlFor="withdraw" className="text-sm">Amount (tUSDC)</Label>
                      <Input
                        id="withdraw"
                        type="number"
                        step="0.01"
                        min="0"
                        max={balance}
                        placeholder="0.1"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        className="mt-1.5"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Available: {balance} STT</p>
                    </div>
                    <Button
                      onClick={handleRequestWithdraw}
                      disabled={isWithdrawing || isWithdrawConfirming || !withdrawAmount || Number(withdrawAmount) > Number(balance)}
                      className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-500/90 hover:to-orange-500/90 text-white shadow-lg shadow-amber-500/25"
                    >
                      {isWithdrawing || isWithdrawConfirming ? (
                        <Activity className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Clock className="h-4 w-4 mr-2" />
                      )}
                      {isWithdrawing ? 'Confirming...' : isWithdrawConfirming ? 'Processing...' : 'Request withdrawal'}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Mobile: Stacked cards */}
          <div className="md:hidden space-y-4">
            {/* Deposit Card */}
            <Card className="border-border/50 overflow-hidden">
              <div className="bg-primary/5 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                    <Plus className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">Deposit tUSDC</p>
                    <p className="text-xs text-muted-foreground">Add funds to start copying</p>
                  </div>
                </div>
              </div>
              <CardContent className="p-4 space-y-4">
                <div>
                  <Label htmlFor="deposit-mobile" className="text-sm">Amount (tUSDC)</Label>
                  <Input
                    id="deposit-mobile"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.1"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="mt-1.5"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Minimum: 1 tUSDC</p>
                </div>
                <Button
                  onClick={handleFaucet}
                  disabled={isFauceting || isFaucetConfirming}
                  variant="outline"
                  className="w-full"
                >
                  {isFauceting || isFaucetConfirming ? <Activity className="h-4 w-4 animate-spin mr-2" /> : <Droplets className="h-4 w-4 mr-2" />}
                  {isFauceting ? 'Confirming...' : isFaucetConfirming ? 'Processing...' : 'Get 1000 tUSDC (faucet)'}
                </Button>
                <Button
                  onClick={handleDeposit}
                  disabled={isDepositing || isDepositConfirming || !depositAmount}
                  className="w-full bg-gradient-to-r from-primary to-blue-600 shadow-lg shadow-primary/20"
                >
                  {isDepositing || isDepositConfirming ? (
                    <Activity className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  {isDepositing ? 'Confirming...' : isDepositConfirming ? 'Processing...' : 'Deposit'}
                </Button>
              </CardContent>
            </Card>

            {/* Withdraw Card */}
            <Card className="border-border/50 overflow-hidden">
              <div className="bg-amber-500/5 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                    <Minus className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="font-semibold">Withdraw STT</p>
                    <p className="text-xs text-muted-foreground">{delayHours}-hour security lock</p>
                  </div>
                </div>
              </div>
              <CardContent className="p-4 space-y-4">
                {hasPendingWithdrawal ? (
                  <>
                    <Alert className="border-warning/30 bg-warning/5">
                      <Clock className="h-4 w-4 text-warning" />
                      <AlertDescription>
                        <span className="font-medium">{pendingAmount} STT</span> pending
                        <br />
                        <span className="text-sm">{formatTimeRemaining(unlockTime)}</span>
                      </AlertDescription>
                    </Alert>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleExecuteWithdraw}
                        disabled={!canExecuteWithdrawal || isExecuting || isExecuteConfirming}
                        className="flex-1"
                      >
                        {isExecuting || isExecuteConfirming ? (
                          <Activity className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Unlock className="h-4 w-4 mr-2" />
                        )}
                        Execute
                      </Button>
                      <Button
                        onClick={handleCancelWithdraw}
                        disabled={isCancelling || isCancelConfirming}
                        variant="outline"
                      >
                        Cancel
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <Label htmlFor="withdraw-mobile" className="text-sm">Amount (tUSDC)</Label>
                      <Input
                        id="withdraw-mobile"
                        type="number"
                        step="0.01"
                        min="0"
                        max={balance}
                        placeholder="0.1"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        className="mt-1.5"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Available: {balance} STT</p>
                    </div>
                    <Button
                      onClick={handleRequestWithdraw}
                      disabled={isWithdrawing || isWithdrawConfirming || !withdrawAmount || Number(withdrawAmount) > Number(balance)}
                      className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/20"
                    >
                      {isWithdrawing || isWithdrawConfirming ? (
                        <Activity className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Clock className="h-4 w-4 mr-2" />
                      )}
                      Request withdrawal
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Leaders Tab */}
        <TabsContent value="leaders" className={TAB_STYLES.content}>
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Follow top traders</CardTitle>
              <CardDescription>Select traders from the leaderboard to copy their bets</CardDescription>
            </CardHeader>
            <CardContent>
              {leadersCount === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-full bg-primary/10 mx-auto mb-3 flex items-center justify-center">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <p className="font-medium mb-1">No leaders followed</p>
                  <p className="text-sm text-muted-foreground mb-4">Browse the leaderboard to find top traders</p>
                  <Link href="/leaderboard">
                    <Button>
                      <Eye className="h-4 w-4 mr-2" />
                      Browse leaderboard
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground mb-3">Following {leadersCount} trader{leadersCount !== 1 ? 's' : ''}</p>
                  {followedLeaders?.map((follow: any) => {
                    const traderAddr = follow.trader?.wallet_address || '';
                    const traderName = follow.trader?.username;
                    const isFromSim = follow.fromSimulation;
                    return (
                      <div
                        key={follow.id || traderAddr}
                        className="flex items-center justify-between p-3 rounded-lg bg-surface hover:bg-surface-raised transition-colors"
                      >
                        <div>
                          <p className="font-mono text-sm">{traderName || shortenAddress(traderAddr)}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {isFromSim ? (
                              <span className="text-xs text-muted-foreground">{follow.tradeCount} simulated trades</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">{follow.allocation_percentage}% allocation</span>
                            )}
                            <a
                              href={`https://somniascan.com/address/${traderAddr}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline inline-flex items-center gap-0.5"
                            >
                              SomniaScan <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        </div>
                        <Badge variant="outline" className={isFromSim ? "text-xs border-purple-500/30 text-purple-500" : "text-xs border-success/30 text-success"}>
                          {isFromSim ? 'Simulating' : 'Following'}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* DreamDEX Real Vault Tab */}
        <TabsContent value="dreamdex" className={TAB_STYLES.content}>
          <DreamDEXVaultTab />
        </TabsContent>

        {/* Simulation Tab */}
        <TabsContent value="simulation" className={TAB_STYLES.content}>
          <SimulationTab followerAddress={address} />
        </TabsContent>

        {/* Polymarket Tab */}
        <TabsContent value="polymarket" className={TAB_STYLES.content}>
          <PolymarketSimulationTab followerAddress={address} />
        </TabsContent>

        {/* Transparency Tab */}
        <TabsContent value="transparency" className={`${TAB_STYLES.content} space-y-4`}>
          {/* Contract Health Status */}
          <Card className="border-border/50 overflow-hidden">
            <div className={`p-4 ${isContractPaused ? 'bg-destructive/5' : 'bg-success/5'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl ${isContractPaused ? 'bg-destructive/20' : 'bg-success/20'} flex items-center justify-center`}>
                    <Shield className={`h-6 w-6 ${isContractPaused ? 'text-destructive' : 'text-success'}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Contract status</h3>
                    <p className="text-sm text-muted-foreground">Live on Somnia Testnet</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${isContractPaused ? 'bg-destructive' : 'bg-success animate-pulse'}`} />
                  <span className={`text-sm font-medium ${isContractPaused ? 'text-destructive' : 'text-success'}`}>
                    {isContractPaused ? 'Paused' : 'Operational'}
                  </span>
                </div>
              </div>
            </div>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Total value locked', value: `${Number(tvl).toFixed(2)} STT` },
                  { label: 'Copy trades executed', value: totalCopyTrades.toLocaleString() },
                  { label: 'Volume processed', value: `${Number(totalVolume).toFixed(2)} STT` },
                  { label: 'Capacity used', value: `${utilizationPercent.toFixed(1)}%` },
                ].map(({ label, value }) => (
                  <div key={label} className="p-3 rounded-lg bg-surface text-center">
                    <p className="text-lg font-bold">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Security Features */}
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-success/20 flex items-center justify-center">
                    <Lock className="w-3.5 h-3.5 text-success" />
                  </div>
                  Security protections
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-surface border border-border/30">
                  <div className="w-9 h-9 rounded-lg bg-warning/15 flex items-center justify-center shrink-0">
                    <Clock className="h-4 w-4 text-warning" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">Time-locked withdrawals</p>
                      <Badge variant="outline" className="text-xs border-warning/30 text-warning">{delayHours}h delay</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Prevents flash loan attacks</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-surface border border-border/30">
                  <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                    <Lock className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">Vault size cap</p>
                      <Badge variant="outline" className="text-xs border-primary/30 text-primary">{maxSize} STT max</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Limits exposure during beta</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-surface border border-border/30">
                  <div className="w-9 h-9 rounded-lg bg-purple-500/15 flex items-center justify-center shrink-0">
                    <Users className="h-4 w-4 text-purple-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">Allocation limits</p>
                      <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-500">{maxAllocationPercent}% max</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Max per leader prevents concentration</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-surface border border-border/30">
                  <div className="w-9 h-9 rounded-lg bg-success/15 flex items-center justify-center shrink-0">
                    <Shield className="h-4 w-4 text-success" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">Reentrancy guard</p>
                      <Badge variant="outline" className="text-xs border-success/30 text-success">OpenZeppelin</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Industry-standard protection</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Verified Contracts */}
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-primary/20 flex items-center justify-center">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                  </div>
                  Verified contracts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 rounded-lg bg-surface">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-muted-foreground">Copy Trading Vault</p>
                    <Badge className="text-[10px] bg-success/20 text-success border-0">Verified</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono">{shortenAddress(COPY_VAULT_ADDRESS)}</code>
                    <a
                      href={`https://testnet.somniascan.com/address/${COPY_VAULT_ADDRESS}#code`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
                {executorAddress && (
                  <div className="p-3 rounded-lg bg-surface">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-muted-foreground">Trade Executor</p>
                      <Badge className="text-[10px] bg-warning/20 text-warning border-0">Hot wallet</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono">{shortenAddress(executorAddress)}</code>
                      <a
                        href={`https://testnet.somniascan.com/address/${executorAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Executes copy trades on your behalf</p>
                  </div>
                )}
                {dreamdexAddress && (
                  <div className="p-3 rounded-lg bg-surface">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-muted-foreground">DreamDEX Event Contracts</p>
                      <Badge className="text-[10px] bg-primary/20 text-primary border-0">External</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono">{shortenAddress(dreamdexAddress)}</code>
                      <a
                        href={`https://testnet.somniascan.com/address/${dreamdexAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Protocol Parameters */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-secondary/20 flex items-center justify-center">
                  <Activity className="w-3.5 h-3.5 text-secondary" />
                </div>
                Protocol parameters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: 'Min deposit', value: `${minDepositSTT} STT` },
                  { label: 'Max vault', value: `${maxSize} STT` },
                  { label: 'Withdrawal delay', value: `${delayHours} hour${delayHours !== 1 ? 's' : ''}` },
                  { label: 'Max per leader', value: `${maxAllocationPercent}%` },
                  { label: 'Protocol fee', value: `${protocolFeePercent}%` },
                ].map(({ label, value }) => (
                  <div key={label} className="p-3 rounded-lg bg-surface text-center">
                    <p className="text-sm font-bold">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

        </TabsContent>
      </Tabs>
    </div>
  );
}
