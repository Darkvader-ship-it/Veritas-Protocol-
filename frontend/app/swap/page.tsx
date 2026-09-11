import { SimpleSwapCard } from '@/components/swap/SimpleSwapCard';
import { StopOrderSheet } from '@/components/spot/StopOrderSheet';
import { RisksDisclosure } from '@/components/RisksDisclosure';

export default function SwapPage() {
  return (
    <div className="container px-4 md:px-6 py-6 max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Swap & Spot</h1>
        <p className="text-sm text-muted-foreground">Zero-fee spot via dreamDEX • SOMI gas • Privy smart wallet</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h2 className="font-semibold mb-3">Simple Swap</h2>
          <SimpleSwapCard />
        </div>
        <div>
          <h2 className="font-semibold mb-3">Stop Order</h2>
          <StopOrderSheet pool="0x0000000000000000000000000000000000000000" />
          <p className="text-xs text-muted-foreground mt-2">Set pool address to enable stop orders for that market</p>
        </div>
      </div>

      <RisksDisclosure />
    </div>
  );
}
