'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowUpDown, Settings, Loader2 } from 'lucide-react';
import { OPERATOR_REGISTRY_TESTNET, SELECTOR_PLACE } from '@/lib/spot';

const TOKENS_MAINNET = ['SOMI', 'USDso', 'USDC.e', 'WBTC', 'WETH'] as const;
const TOKENS_TESTNET = ['SOMI', 'USDso', 'WBTC', 'WETH'] as const;

export function SimpleSwapCard({ isMainnet = false }: { isMainnet?: boolean }) {
  const { address, chainId } = useAccount();
  const tokens = isMainnet ? TOKENS_MAINNET : TOKENS_TESTNET;
  
  const [tokenIn, setTokenIn] = useState('SOMI');
  const [tokenOut, setTokenOut] = useState('USDso');
  const [amountIn, setAmountIn] = useState('');
  const [slippage, setSlippage] = useState('0.5');
  const [showSettings, setShowSettings] = useState(false);

  const isWrongNetwork = isMainnet ? chainId !== 5031 : chainId !== 50312;
  const operatorRegistry = isMainnet ? '0xE7a190736B6024a4DbafadC04E283075877005ce' : OPERATOR_REGISTRY_TESTNET;

  // Live market discovery - per Quick Start, fetch from GET /v0/markets
  const [liveMarkets, setLiveMarkets] = useState<any[]>([]);
  useEffect(() => {
    fetch(isMainnet ? 'https://api.dreamdex.io/v0/markets' : 'https://stg.api.dreamdex.io/v0/markets')
      .then(r => r.json())
      .then(d => setLiveMarkets(d.markets || []))
      .catch(() => {});
  }, [isMainnet]);

  // Check if router is approved as operator
  const { data: isApproved } = useReadContract({
    address: '0x07A29A0A086Bc8262a9320db93E603eE13D57962' as any, // SpotPool example, need actual pool for check
    abi: [{ name: 'isOperatorAuthorized', type: 'function', inputs: [{ name: 'owner', type: 'address' }, { name: 'operator', type: 'address' }, { name: 'selector', type: 'bytes4' }], outputs: [{ type: 'bool' }], stateMutability: 'view' }],
    functionName: 'isOperatorAuthorized',
    args: address ? [address, '0xB601bc1099B040E4882089D94690F7C38AF4CCD2' as any, SELECTOR_PLACE] : undefined,
  });

  const { writeContract: approveRouter, isPending: isApproving } = useWriteContract();
  const { writeContract: swap, isPending: isSwapping } = useWriteContract();

  const handleApproveRouter = () => {
    // Global approval for SpotRouter as operator
    const routerAddress = '0xB601bc1099B040E4882089D94690F7C38AF4CCD2'; // Placeholder - actual SpotRouter
    approveRouter({
      address: operatorRegistry as any,
      abi: [{ name: 'setOperatorApprovalGlobal', type: 'function', inputs: [{ name: 'operator', type: 'address' }, { name: 'selectors', type: 'bytes4[]' }, { name: 'approved', type: 'bool' }], outputs: [], stateMutability: 'nonpayable' }],
      functionName: 'setOperatorApprovalGlobal',
      args: [routerAddress as any, [SELECTOR_PLACE], true],
    });
  };

  const [quote, setQuote] = useState<any>(null);
  const [quoting, setQuoting] = useState(false);

  // Live quote via SpotRouter quoteMarketExactIn - per docs, use 0,0 route for market quote
  useEffect(() => {
    if (!amountIn || Number(amountIn) <= 0) { setQuote(null); return; }
    setQuoting(true);
    import('@/lib/spot').then(async ({ quoteMarketExactIn, NATIVE_TOKEN }) => {
      try {
        // Resolve token addresses - SOMI uses NATIVE_TOKEN sentinel
        const isNativeIn = tokenIn === 'SOMI';
        const inputToken = isNativeIn ? NATIVE_TOKEN : '0x0000000000000000000000000000000000000000' as any; // TODO: map tokenIn to address via live markets
        // For now, quote is placeholder - actual route requires pool discovery via GET /v0/markets
        // Star topology: X->USDso direct or X->USDso->Y two-leg
        const route: any[] = []; // TODO: build from liveMarkets based on tokenIn/tokenOut
        if (route.length === 0) { setQuote(null); return; }
        const q = await quoteMarketExactIn(route, inputToken, BigInt(Math.floor(Number(amountIn) * 1e18)), false);
        setQuote(q);
      } catch { setQuote(null); }
      setQuoting(false);
    });
  }, [amountIn, tokenIn, tokenOut]);

  const handleSwap = async () => {
    if (!quote || !quote.ok) return;
    const slippageBps = Math.round(Number(slippage) * 100);
    const minOutput = (quote.amountOut * BigInt(10000 - slippageBps)) / BigInt(10000);
    const deadlineNs = BigInt((Math.floor(Date.now() / 1000) + 30 * 60) * 1_000_000_000);
    // Build live route with tick-aligned priceLimit from quote.legs[].worstFillPrice
    console.log('Swap', { tokenIn, tokenOut, amountIn, slippage, quote, minOutput, deadlineNs });
    // Actual swap: swapExactIn({ inputToken, inputAmount, outputToken, minOutputAmount, route: liveRoute, deadlineNs })
  };

  const handleSwitchTokens = () => {
    const tmp = tokenIn;
    setTokenIn(tokenOut);
    setTokenOut(tmp);
  };

  if (isWrongNetwork) {
    return (
      <Card className="border-warning/30 bg-warning/5">
        <CardContent className="p-6 text-center">
          <p className="font-medium mb-2">Wrong network</p>
          <p className="text-sm text-muted-foreground">Switch to {isMainnet ? 'Somnia Mainnet' : 'Somnia Testnet'} to swap</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 shadow-lg max-w-md w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Simple Swap</CardTitle>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowSettings(!showSettings)}>
            <Settings className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">One-click swap via SpotRouter • Zero fees</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {showSettings && (
          <div className="p-3 rounded-lg bg-muted/50 border border-border/50 space-y-3">
            <div>
              <Label className="text-xs">Slippage tolerance</Label>
              <div className="flex gap-2 mt-1">
                {['0.10', '0.50', '1.0'].map((v) => (
                  <Button key={v} variant={slippage === v ? 'default' : 'outline'} size="sm" className="flex-1 text-xs" onClick={() => setSlippage(v)}>{v}%</Button>
                ))}
                <Input value={slippage} onChange={(e) => setSlippage(e.target.value)} placeholder="0.5" className="w-20 h-8 text-xs" />
              </div>
              {Number(slippage) > 5 && <p className="text-xs text-warning mt-1">High slippage warning</p>}
            </div>
          </div>
        )}

        <div className="space-y-1">
          <Label className="text-xs">You pay</Label>
          <div className="flex gap-2">
            <Input value={amountIn} onChange={(e) => setAmountIn(e.target.value)} placeholder="0.0" className="flex-1" type="number" />
            <Select value={tokenIn} onValueChange={setTokenIn}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {tokens.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-center -my-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full border bg-background" onClick={handleSwitchTokens}>
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">You receive (est.)</Label>
          <div className="flex gap-2">
            <Input placeholder="0.0" readOnly className="flex-1 bg-muted/30" />
            <Select value={tokenOut} onValueChange={setTokenOut}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {tokens.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">Route: {tokenIn} → USDso → {tokenOut} {tokenIn === 'USDso' || tokenOut === 'USDso' ? '(direct)' : ''}</p>
        </div>

        {!isApproved ? (
          <Button onClick={handleApproveRouter} disabled={isApproving} className="w-full">
            {isApproving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Approve Router
          </Button>
        ) : (
          <Button onClick={handleSwap} disabled={isSwapping || !amountIn} className="w-full bg-gradient-to-r from-primary to-blue-600">
            {isSwapping ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Swap
          </Button>
        )}

        <p className="text-xs text-muted-foreground text-center">Zero fees • SOMI gas • Privy smart wallet</p>
      </CardContent>
    </Card>
  );
}
