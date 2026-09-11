'use client';

import { useState } from 'react';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { parseUnits } from 'viem';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { getStopRegistryForPool } from '@/lib/spot';

export function StopOrderSheet({ pool, isMainnet = false, symbol }: { pool: string; isMainnet?: boolean; symbol?: string }) {
  const registryFromPool = symbol ? getStopRegistryForPool(symbol, isMainnet) : undefined;
  const STOP_REGISTRY_TESTNET = registryFromPool || pool;
  const { address } = useAccount();
  const [side, setSide] = useState<'buy' | 'sell'>('sell');
  const [triggerPrice, setTriggerPrice] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [operator, setOperator] = useState<'GTE' | 'LTE'>('LTE');
  const [orderType, setOrderType] = useState<'LIMIT' | 'MARKET'>('LIMIT');

  const { data: somiPayment } = useReadContract({
    address: STOP_REGISTRY_TESTNET as any,
    abi: [{ name: 'somiPaymentPerOrder', type: 'function', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' }],
    functionName: 'somiPaymentPerOrder',
  });

  const { data: minDistance } = useReadContract({
    address: STOP_REGISTRY_TESTNET as any,
    abi: [{ name: 'minStopDistanceBps', type: 'function', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' }],
    functionName: 'minStopDistanceBps',
  });

  const { writeContract: createOrder, isPending } = useWriteContract();

  const handleCreate = () => {
    const isBid = side === 'buy';
    const triggerOperator = operator === 'GTE' ? 0 : 1;
    const type = orderType === 'LIMIT' ? 0 : 1;
    const limit = orderType === 'MARKET' ? BigInt(0) : parseUnits(limitPrice || '0', 6);

    if (orderType === 'MARKET' && limit !== BigInt(0)) {
      alert('MARKET stop must have limitPrice 0');
      return;
    }

    createOrder({
      address: STOP_REGISTRY_TESTNET as any,
      abi: [{ name: 'createPendingOrder', type: 'function', inputs: [{ name: 'order', type: 'tuple', components: [{ name: 'isBid', type: 'bool' }, { name: 'owner', type: 'address' }, { name: 'userData', type: 'uint64' }, { name: 'quantity', type: 'uint256' }] }, { name: 'orderType', type: 'uint8' }, { name: 'triggerPrice', type: 'uint256' }, { name: 'triggerOperator', type: 'uint8' }, { name: 'limitPrice', type: 'uint256' }, { name: 'builder', type: 'address' }, { name: 'builderFeeBpsTimes1k', type: 'uint96' }], outputs: [{ type: 'uint128' }], stateMutability: 'payable' }],
      functionName: 'createPendingOrder',
      args: [{ isBid, owner: address as any, userData: BigInt(0), quantity: parseUnits(quantity || '0', 18) } as any, type, parseUnits(triggerPrice || '0', 6), triggerOperator, limit, '0x0000000000000000000000000000000000000000' as any, BigInt(0)],
      value: somiPayment as any,
    });
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Stop Order</CardTitle>
        <p className="text-xs text-muted-foreground">Trigger on EMA mark price • IOC on fill • SOMI fee {(somiPayment as any)?.toString() || '...'}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {minDistance && Number(minDistance) > 0 && (
          <Alert className="border-warning/30 bg-warning/5">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <AlertDescription className="text-xs">Min stop distance: {String(minDistance)} bps</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Side</Label>
            <Select value={side} onValueChange={(v: any) => setSide(v)}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="buy">Buy</SelectItem><SelectItem value="sell">Sell</SelectItem></SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Type</Label>
            <Select value={orderType} onValueChange={(v: any) => setOrderType(v)}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="LIMIT">Limit</SelectItem><SelectItem value="MARKET">Market</SelectItem></SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Trigger price</Label>
            <Input value={triggerPrice} onChange={(e) => setTriggerPrice(e.target.value)} placeholder="90" type="number" className="h-8" />
          </div>
          <div>
            <Label className="text-xs">Operator</Label>
            <Select value={operator} onValueChange={(v: any) => setOperator(v)}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="GTE">GTE (≥)</SelectItem><SelectItem value="LTE">LTE (≤)</SelectItem></SelectContent>
            </Select>
          </div>
        </div>

        {orderType === 'LIMIT' && (
          <div>
            <Label className="text-xs">Limit price</Label>
            <Input value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} placeholder="85" type="number" className="h-8" />
            <p className="text-xs text-muted-foreground mt-1">Must be ≤ trigger for sell/LTE, ≥ for buy/GTE</p>
          </div>
        )}

        <div>
          <Label className="text-xs">Quantity</Label>
          <Input value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="1.0" type="number" className="h-8" />
        </div>

        <Button onClick={handleCreate} disabled={isPending || !quantity || !triggerPrice} className="w-full">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Create Stop ({orderType}) — {String(somiPayment || '')} SOMI
        </Button>
        <p className="text-xs text-muted-foreground text-center">Exact SOMI payment required • Refunded on cancel • One-shot IOC</p>
      </CardContent>
    </Card>
  );
}
