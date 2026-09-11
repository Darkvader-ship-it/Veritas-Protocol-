import { NextResponse } from 'next/server';
import { createPublicClient, http, formatEther } from 'viem';
import { somnia, somniaTestnet } from 'viem/chains';

const COPY_TRADING_VAULT_ABI = [
  {
    inputs: [],
    name: 'getVaultStats',
    outputs: [
      { name: 'totalValueLocked', type: 'uint256' },
      { name: 'totalCopyTrades', type: 'uint256' },
      { name: 'totalVolumeExecuted', type: 'uint256' },
      { name: 'totalFeesCollected', type: 'uint256' },
      { name: 'executor', type: 'address' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'MAX_VAULT_SIZE',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export async function GET() {
  try {
    const vaultAddress = process.env.NEXT_PUBLIC_COPY_VAULT_ADDRESS || process.env.NEXT_PUBLIC_COPY_TRADING_VAULT;

    if (!vaultAddress) {
      return NextResponse.json({
        totalValueLocked: '0',
        totalCopyTrades: 0,
        totalVolumeExecuted: '0',
        executor: null,
        maxVaultSize: '100',
        utilizationPercent: 0,
      });
    }

    const client = createPublicClient({
      chain: process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? somnia : somniaTestnet,
      transport: http(),
    });

    const [stats, maxVaultSize] = await Promise.all([
      client.readContract({
        address: vaultAddress as `0x${string}`,
        abi: COPY_TRADING_VAULT_ABI,
        functionName: 'getVaultStats',
      }),
      client.readContract({
        address: vaultAddress as `0x${string}`,
        abi: COPY_TRADING_VAULT_ABI,
        functionName: 'MAX_VAULT_SIZE',
      }),
    ]);

    const [totalValueLocked, totalCopyTrades, totalVolumeExecuted, totalFeesCollected, executor] = stats;

    const tvlSTT = parseFloat(formatEther(totalValueLocked));
    const maxSTT = parseFloat(formatEther(maxVaultSize));
    const utilizationPercent = maxSTT > 0 ? (tvlSTT / maxSTT) * 100 : 0;

    return NextResponse.json({
      totalValueLocked: formatEther(totalValueLocked),
      totalCopyTrades: Number(totalCopyTrades),
      totalVolumeExecuted: formatEther(totalVolumeExecuted),
      totalFeesCollected: formatEther(totalFeesCollected),
      executor,
      maxVaultSize: formatEther(maxVaultSize),
      utilizationPercent: Math.round(utilizationPercent * 100) / 100,
    });
  } catch (error) {
    console.error('Error fetching vault stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vault stats' },
      { status: 500 }
    );
  }
}
