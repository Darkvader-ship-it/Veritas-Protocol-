import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { somniaTestnet } from 'viem/chains';

export const dynamic = 'force-dynamic';

const CONTRACTS = {
  VeritasCore: process.env.NEXT_PUBLIC_CORE_ADDRESS_TESTNET as `0x${string}`,
  ReputationNFT: process.env.NEXT_PUBLIC_NFT_ADDRESS_TESTNET as `0x${string}`,
};

const VERITAS_CORE_ABI = [
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'hasRegistered',
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getUserProfile',
    outputs: [
      { name: 'isActive', type: 'bool' },
      { name: 'reputationNFTId', type: 'uint256' },
      { name: 'veritasScore', type: 'uint256' },
      { name: 'totalPredictions', type: 'uint256' },
      { name: 'correctPredictions', type: 'uint256' },
      { name: 'totalVolume', type: 'uint256' },
      { name: 'registeredAt', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/**
 * GET /api/debug-registration?address=0x...
 *
 * Debug endpoint to check registration status and contract state
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'Address parameter required' }, { status: 400 });
  }

  try {
    // Create viem client
    const client = createPublicClient({
      chain: somniaTestnet,
      transport: http(),
    });

    // Check if contract is deployed
    const coreCode = await client.getBytecode({ address: CONTRACTS.VeritasCore });
    const nftCode = await client.getBytecode({ address: CONTRACTS.ReputationNFT });

    // Call hasRegistered
    const hasRegistered = await client.readContract({
      address: CONTRACTS.VeritasCore,
      abi: VERITAS_CORE_ABI,
      functionName: 'hasRegistered',
      args: [address as `0x${string}`],
    });

    // Get user profile
    let userProfile = null;
    try {
      userProfile = await client.readContract({
        address: CONTRACTS.VeritasCore,
        abi: VERITAS_CORE_ABI,
        functionName: 'getUserProfile',
        args: [address as `0x${string}`],
      });
    } catch (error: any) {
      userProfile = { error: error.message };
    }

    return NextResponse.json({
      success: true,
      address,
      network: 'Somnia Testnet (ChainID: 97)',
      contracts: {
        VeritasCore: {
          address: CONTRACTS.VeritasCore,
          deployed: coreCode && coreCode !== '0x',
          bytecodeLength: coreCode?.length || 0,
        },
        ReputationNFT: {
          address: CONTRACTS.ReputationNFT,
          deployed: nftCode && nftCode !== '0x',
          bytecodeLength: nftCode?.length || 0,
        },
      },
      registration: {
        hasRegistered,
        userProfile,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Debug registration error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      address,
      contracts: {
        VeritasCore: CONTRACTS.VeritasCore,
        ReputationNFT: CONTRACTS.ReputationNFT,
      },
    }, { status: 500 });
  }
}
