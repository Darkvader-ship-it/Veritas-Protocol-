'use client';

import { useState } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSwitchChain, usePublicClient } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { DREAMDEX_COPY_VAULT_ABI, DREAMDEX_COPY_VAULT_ADDRESS, ERC20_ABI, SOMNIA_DREAMDEX } from '@/lib/contracts';
import { Loader2, ExternalLink, Wallet, Users, Droplets, Trophy } from 'lucide-react';

export function DreamDEXVaultTab() {
  const { address, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const publicClient = usePublicClient();
  const { toast } = useToast();

  const [depositAmt, setDepositAmt] = useState('100');
  const [followLeader, setFollowLeader] = useState('');
  const [alloc, setAlloc] = useState('50');
  const [maxBet, setMaxBet] = useState('20');

  const isSomnia = chainId === 50312;
  const vaultAddr = DREAMDEX_COPY_VAULT_ADDRESS as `0x${string}`;
  const isDeployed = vaultAddr !== '0x0000000000000000000000000000000000000000';

  // Reads
  const { data: vaultStats } = useReadContract({
    address: vaultAddr,
    abi: DREAMDEX_COPY_VAULT_ABI,
    functionName: 'getVaultStats',
    query: { enabled: isDeployed && !!address },
  });

  const { data: userBalance, refetch: refetchBal } = useReadContract({
    address: vaultAddr,
    abi: DREAMDEX_COPY_VAULT_ABI,
    functionName: 'balances',
    args: address ? [address] : undefined,
    query: { enabled: isDeployed && !!address },
  });

  const { data: tUSDCBal } = useReadContract({
    address: SOMNIA_DREAMDEX.collateralTUSDC as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && isSomnia },
  });

  const { data: allowance } = useReadContract({
    address: SOMNIA_DREAMDEX.collateralTUSDC as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, vaultAddr] : undefined,
    query: { enabled: !!address && isDeployed },
  });

  const { data: userFollows, refetch: refetchFollows } = useReadContract({
    address: vaultAddr,
    abi: DREAMDEX_COPY_VAULT_ABI,
    functionName: 'getUserFollows',
    args: address ? [address] : undefined,
    query: { enabled: isDeployed && !!address },
  });

  const { writeContract: approve, data: approveHash, isPending: isApproving } = useWriteContract();
  const { writeContract: deposit, data: depositHash, isPending: isDepositing } = useWriteContract();
  const { writeContract: follow, data: followHash, isPending: isFollowing } = useWriteContract();
  const { writeContract: unfollow, isPending: isUnfollowing } = useWriteContract();

  const { isLoading: isApproveConfirming } = useWaitForTransactionReceipt({ hash: approveHash });
  const { isSuccess: depositSuccess } = useWaitForTransactionReceipt({ hash: depositHash });
  const { isSuccess: followSuccess } = useWaitForTransactionReceipt({ hash: followHash });

  // Refetch after success
  useState(() => {
    if (depositSuccess) {
      refetchBal();
      toast({ title: 'Deposited to DreamDEX Vault', description: `${depositAmt} tUSDC` });
    }
  });

  const handleSwitch = async () => {
    try { await switchChain({ chainId: 50312 }); } catch (e: any) { toast({ title: 'Switch failed', description: e.message, variant: 'destructive' }); }
  };

  const handleApprove = () => {
    const amt = parseUnits(depositAmt || '0', 6);
    approve({ address: SOMNIA_DREAMDEX.collateralTUSDC as `0x${string}`, abi: ERC20_ABI, functionName: 'approve', args: [vaultAddr, amt] });
  };

  const handleDeposit = () => {
    const amt = parseUnits(depositAmt || '0', 6);
    // Need allowance first
    const need = amt;
    const hasAllowance = (allowance as bigint | undefined) ? (allowance as bigint) >= need : false;
    if (!hasAllowance) {
      toast({ title: 'Approve first', description: 'Approve tUSDC for vault', variant: 'destructive' });
      return;
    }
    deposit({ address: vaultAddr, abi: DREAMDEX_COPY_VAULT_ABI, functionName: 'deposit', args: [amt] });
  };

  const handleFollow = () => {
    if (!followLeader) { toast({ title: 'Leader required', variant: 'destructive' }); return; }
    const allocBps = Math.floor(parseFloat(alloc) * 100); // e.g. 50% => 5000? Actually MAX 5000 =50%, so 50% =>5000? Wait spec: 25% =>2500. So 50% =>5000. Our input 50 => 5000.
    // Our alloc input is 0-50, convert: 50 => 5000, 25=>2500
    const bps = Math.floor(parseFloat(alloc) * 100);
    const max = parseUnits(maxBet || '0', 6);
    follow({ address: vaultAddr, abi: DREAMDEX_COPY_VAULT_ABI, functionName: 'follow', args: [followLeader as `0x${string}`, BigInt(bps), max] });
  };

  const handleUnfollow = (leader: string) => {
    unfollow({ address: vaultAddr, abi: DREAMDEX_COPY_VAULT_ABI, functionName: 'unfollow', args: [leader as `0x${string}`] });
  };

  if (!isDeployed) {
    return (
      <Card className="border-border/50"><CardContent className="p-8 text-center"><p className="text-sm text-muted-foreground">DreamDEX vault not deployed on Somnia Shannon yet. Deploy via DeployDreamDEX.s.sol</p><p className="text-xs font-mono mt-2">{vaultAddr}</p></CardContent></Card>
    );
  }

  const tUSDCStr = tUSDCBal ? formatUnits(tUSDCBal as bigint, 6) : '0';
  const vaultBalStr = userBalance ? formatUnits(userBalance as bigint, 6) : '0';
  const tvl = vaultStats ? formatUnits((vaultStats as any)[0] as bigint, 6) : '0';
  const vol = vaultStats ? formatUnits((vaultStats as any)[2] as bigint, 6) : '0';

  return (
    <div className="space-y-4">
      <Card className="border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/5 to-purple-600/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-fuchsia-600"><Droplets className="w-5 h-5" /> DreamDEX Copy Vault — Somnia Shannon 50312 <Badge className="bg-fuchsia-600 text-white">REAL</Badge></CardTitle>
          <CardDescription>tUSDC 6dec • OutcomeToken6909 0xB52c... • Venue 0x6797...28c • STT gas</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-card p-3 rounded border"><div className="text-lg font-bold">{parseFloat(tvl).toFixed(0)}</div><div className="text-xs text-muted-foreground">TVL tUSDC</div></div>
          <div className="bg-card p-3 rounded border"><div className="text-lg font-bold">{parseFloat(vaultBalStr).toFixed(2)}</div><div className="text-xs text-muted-foreground">Your vault bal</div></div>
          <div className="bg-card p-3 rounded border"><div className="text-lg font-bold">{parseFloat(tUSDCStr).toFixed(0)}</div><div className="text-xs text-muted-foreground">Wallet tUSDC</div></div>
        </CardContent>
      </Card>

      {!isSomnia && address && (
        <Card className="border-yellow-500/30 bg-yellow-500/10">
          <CardContent className="p-3 text-sm flex items-center justify-between">
            <span>Switch to Somnia Shannon 50312 to use DreamDEX vault (dream-rpc.somnia.network)</span>
            <Button size="sm" onClick={handleSwitch}>Switch</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-border/50">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Wallet className="w-4 h-4" /> Deposit tUSDC</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Amount (tUSDC) — 6dec</Label>
              <Input value={depositAmt} onChange={(e) => setDepositAmt(e.target.value)} placeholder="100" type="number" />
              <p className="text-xs text-muted-foreground mt-1">Wallet: {parseFloat(tUSDCStr).toFixed(2)} tUSDC • Get via trader.faucet() or DreamDEX app</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleApprove} disabled={isApproving || isApproveConfirming}>
                {isApproving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Approve
              </Button>
              <Button className="flex-1 bg-fuchsia-600 hover:bg-fuchsia-700" onClick={handleDeposit} disabled={isDepositing}>
                {isDepositing ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Deposit
              </Button>
            </div>
            <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => window.open('https://shannon-explorer.somnia.network/address/' + vaultAddr, '_blank')}>
              View vault on Shannon Explorer <ExternalLink className="w-3 h-3 ml-1" />
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Users className="w-4 h-4" /> Follow leader</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Leader address</Label>
              <Input value={followLeader} onChange={(e) => setFollowLeader(e.target.value)} placeholder="0x..." />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Allocation % (1-50)</Label><Input value={alloc} onChange={(e) => setAlloc(e.target.value)} type="number" min="1" max="50" /></div>
              <div><Label>Max bet (tUSDC)</Label><Input value={maxBet} onChange={(e) => setMaxBet(e.target.value)} type="number" /></div>
            </div>
            <Button className="w-full bg-fuchsia-600 hover:bg-fuchsia-700" onClick={handleFollow} disabled={isFollowing}>
              {isFollowing ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Follow — 50% demo
            </Button>
            <p className="text-xs text-muted-foreground">CopyAmount = min(leaderBet*alloc/10000, maxBet, vaultBal) • Executor batchExecuteCopyTrades → mintCompleteSet + placeOrder IOC</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50">
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Trophy className="w-4 h-4" /> Your DreamDEX follows</CardTitle></CardHeader>
        <CardContent>
          {userFollows && Array.isArray((userFollows as any)[0]) ? (
            (() => {
              const leaders = (userFollows as any)[0] as string[];
              const settings = (userFollows as any)[1] as any[];
              if (!leaders.length) return <p className="text-sm text-muted-foreground">Not following anyone yet. Follow a sharp 15m CLOB trader.</p>;
              return (
                <div className="space-y-2">
                  {leaders.map((l: string, i: number) => (
                    <div key={l} className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                      <span className="font-mono text-xs">{l.slice(0, 6)}...{l.slice(-4)} — {Number(settings[i].allocationBps) / 100}% • max {formatUnits(settings[i].maxBet as bigint, 6)} tUSDC</span>
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleUnfollow(l)} disabled={isUnfollowing}>Unfollow</Button>
                    </div>
                  ))}
                </div>
              );
            })()
          ) : (
            <p className="text-sm text-muted-foreground">No follows on Shannon vault yet. Vault follows are separate from Somnia vault.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
