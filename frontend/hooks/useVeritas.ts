'use client';

import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useEffect, useState, useMemo } from 'react';
import {
  CONTRACTS,
  VERITAS_CORE_ABI,
  REPUTATION_NFT_ABI,
  PLATFORM_REGISTRY_ABI,
  UserProfile,
  NFTMetadata,
  Platform,
  ReputationTier,
  MINT_FEE,
} from '@/lib/contracts';
import { Address } from 'viem';

export function useVeritas() {
  const { address, chainId } = useAccount();

  // Get contract addresses based on chain — Somnia only (50312 testnet, 5031 mainnet)
  const contracts = chainId === 5031 ? CONTRACTS.somnia : CONTRACTS.somniaTestnet;

  // OPTIMIZATION: Batch initial reads with multicall
  // This reduces 3 sequential RPC calls to 1 batched call
  const initialContracts = useMemo(() => {
    if (!address) return [];
    return [
      {
        address: contracts.VeritasCore,
        abi: VERITAS_CORE_ABI,
        functionName: 'hasRegistered',
        args: [address],
      },
      {
        address: contracts.VeritasCore,
        abi: VERITAS_CORE_ABI,
        functionName: 'getUserProfile',
        args: [address],
      },
      {
        address: contracts.PlatformRegistry,
        abi: PLATFORM_REGISTRY_ABI,
        functionName: 'getPlatformCount',
      },
    ] as const;
  }, [address, contracts.VeritasCore, contracts.PlatformRegistry]);

  const {
    data: initialData,
    refetch: refetchInitial,
    isLoading: isLoadingInitial,
  } = useReadContracts({
    contracts: initialContracts,
    query: {
      enabled: !!address,
      staleTime: 10 * 1000, // Cache for 10 seconds (shorter to catch new registrations)
      refetchOnMount: true, // Always refetch on mount to ensure fresh registration state
    },
  });

  // Extract data from multicall result
  const hasRegistered = initialData?.[0]?.result as boolean | undefined;
  const userProfile = initialData?.[1]?.result as UserProfile | undefined;
  const platformCount = initialData?.[2]?.result as bigint | undefined;

  // Refetch helpers that work with multicall
  const refetchRegistration = refetchInitial;
  const refetchProfile = refetchInitial;

  // OPTIMIZATION: Batch NFT reads with multicall (only when we have userProfile)
  const nftContracts = useMemo(() => {
    if (!userProfile?.reputationNFTId) return [];
    return [
      {
        address: contracts.ReputationNFT,
        abi: REPUTATION_NFT_ABI,
        functionName: 'tokenURI',
        args: [userProfile.reputationNFTId],
      },
      {
        address: contracts.ReputationNFT,
        abi: REPUTATION_NFT_ABI,
        functionName: 'getMetadata',
        args: [userProfile.reputationNFTId],
      },
    ] as const;
  }, [userProfile?.reputationNFTId, contracts.ReputationNFT]);

  const {
    data: nftData,
    refetch: refetchNFT,
    isLoading: isLoadingNFT,
  } = useReadContracts({
    contracts: nftContracts,
    query: {
      enabled: !!userProfile?.reputationNFTId,
      staleTime: 30 * 1000,
    },
  });

  // Extract NFT data
  const tokenURI = nftData?.[0]?.result as string | undefined;
  const nftMetadata = nftData?.[1]?.result as NFTMetadata | undefined;

  // Refetch helpers for NFT
  const refetchTokenURI = refetchNFT;
  const refetchNFTMetadata = refetchNFT;

  // Get all platforms
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [platformError, setPlatformError] = useState<string | null>(null);

  useEffect(() => {
    if (!platformCount || Number(platformCount) === 0) return;

    const fetchPlatforms = async () => {
      try {
        setPlatformError(null);
        const platformPromises = [];
        for (let i = 1; i <= Number(platformCount); i++) {
          platformPromises.push(
            fetch(`/api/platform/${i}`).then(res => {
              if (!res.ok) throw new Error('Platform fetch failed');
              return res.json();
            })
          );
        }
        const results = await Promise.all(platformPromises);
        setPlatforms(results.filter(Boolean));
      } catch (error) {
        console.error('Failed to fetch platforms:', error);
        setPlatformError('Failed to load platforms. Please refresh the page.');
      }
    };

    fetchPlatforms();
  }, [platformCount]);

  // Write functions
  const { writeContractAsync: writeRegister, data: registerHash, isPending: isRegistering } = useWriteContract();
  const { writeContract: writeConnect, data: connectHash, isPending: isConnecting } = useWriteContract();
  const { writeContract: writeImport, data: importHash, isPending: isImporting } = useWriteContract();
  const { writeContract: writeUpdate, data: updateHash, isPending: isUpdating } = useWriteContract();

  // Wait for transactions
  const { isLoading: isRegisterConfirming } = useWaitForTransactionReceipt({ hash: registerHash });
  const { isLoading: isConnectConfirming } = useWaitForTransactionReceipt({ hash: connectHash });
  const { isLoading: isImportConfirming } = useWaitForTransactionReceipt({ hash: importHash });
  const { isLoading: isUpdateConfirming } = useWaitForTransactionReceipt({ hash: updateHash });

  // Actions
  const registerUser = async () => {
    return writeRegister({
      address: contracts.VeritasCore,
      abi: VERITAS_CORE_ABI,
      functionName: 'registerUser',
      value: MINT_FEE,
    });
  };

  const connectPlatform = async (platformId: bigint) => {
    return writeConnect({
      address: contracts.VeritasCore,
      abi: VERITAS_CORE_ABI,
      functionName: 'connectPlatform',
      args: [platformId],
    });
  };

  const importPredictions = async (
    platformId: bigint,
    totalPredictions: bigint,
    correctPredictions: bigint,
    totalVolume: bigint,
    proof: `0x${string}`
  ) => {
    return writeImport({
      address: contracts.VeritasCore,
      abi: VERITAS_CORE_ABI,
      functionName: 'importPredictions',
      args: [platformId, totalPredictions, correctPredictions, totalVolume, proof],
    });
  };

  const updateVeritasScore = async (userAddress?: `0x${string}`) => {
    return writeUpdate({
      address: contracts.VeritasCore,
      abi: VERITAS_CORE_ABI,
      functionName: 'updateVeritasScore',
      args: [userAddress || address!],
    });
  };

  // Refetch data after transactions
  useEffect(() => {
    if (registerHash && !isRegisterConfirming) {
      // Wait 3 seconds for blockchain to index the transaction
      setTimeout(() => {
        refetchRegistration();
        refetchProfile();
      }, 3000);
    }
  }, [registerHash, isRegisterConfirming]);

  useEffect(() => {
    if ((connectHash && !isConnectConfirming) || (importHash && !isImportConfirming)) {
      refetchProfile();
      refetchNFTMetadata();
      refetchTokenURI();
    }
  }, [connectHash, isConnectConfirming, importHash, isImportConfirming]);

  useEffect(() => {
    if (updateHash && !isUpdateConfirming) {
      refetchProfile();
      refetchNFTMetadata();
      refetchTokenURI();
    }
  }, [updateHash, isUpdateConfirming]);

  return {
    // State
    address,
    chainId,
    isRegistered: !!hasRegistered,
    userProfile,
    nftMetadata,
    tokenURI,
    platforms,
    platformError,

    // Actions
    registerUser,
    connectPlatform,
    importPredictions,
    updateVeritasScore,

    // Loading states
    isRegistering: isRegistering || isRegisterConfirming,
    isConnecting: isConnecting || isConnectConfirming,
    isImporting: isImporting || isImportConfirming,
    isUpdating: isUpdating || isUpdateConfirming,

    // Refetch functions
    refetchProfile,
    refetchNFTMetadata,
    refetchTokenURI,
  };
}

// Helper hook: Fetch specific user profile (for viewing other users)
// OPTIMIZED: Uses multicall to batch RPC requests
export function useUserProfile(userAddress?: Address) {
  const { chainId } = useAccount();
  const contracts = chainId === 5031 ? CONTRACTS.somnia : CONTRACTS.somniaTestnet;

  // OPTIMIZATION: Batch initial reads with multicall
  const initialContracts = useMemo(() => {
    if (!userAddress) return [];
    return [
      {
        address: contracts.VeritasCore,
        abi: VERITAS_CORE_ABI,
        functionName: 'hasRegistered',
        args: [userAddress],
      },
      {
        address: contracts.VeritasCore,
        abi: VERITAS_CORE_ABI,
        functionName: 'getUserProfile',
        args: [userAddress],
      },
    ] as const;
  }, [userAddress, contracts.VeritasCore]);

  const { data: initialData, isLoading: isLoadingInitial } = useReadContracts({
    contracts: initialContracts,
    query: {
      enabled: !!userAddress,
      staleTime: 30 * 1000,
    },
  });

  const hasRegistered = initialData?.[0]?.result as boolean | undefined;
  const userProfile = initialData?.[1]?.result as UserProfile | undefined;

  // OPTIMIZATION: Batch NFT reads with multicall
  const nftContracts = useMemo(() => {
    if (!userProfile?.reputationNFTId) return [];
    return [
      {
        address: contracts.ReputationNFT,
        abi: REPUTATION_NFT_ABI,
        functionName: 'getMetadata',
        args: [userProfile.reputationNFTId],
      },
      {
        address: contracts.ReputationNFT,
        abi: REPUTATION_NFT_ABI,
        functionName: 'tokenURI',
        args: [userProfile.reputationNFTId],
      },
    ] as const;
  }, [userProfile?.reputationNFTId, contracts.ReputationNFT]);

  const { data: nftData, isLoading: isLoadingNFT } = useReadContracts({
    contracts: nftContracts,
    query: {
      enabled: !!userProfile?.reputationNFTId,
      staleTime: 30 * 1000,
    },
  });

  const nftMetadata = nftData?.[0]?.result as NFTMetadata | undefined;
  const tokenURI = nftData?.[1]?.result as string | undefined;

  return {
    isRegistered: !!hasRegistered,
    userProfile,
    nftMetadata,
    tokenURI,
    isLoading: isLoadingInitial || isLoadingNFT,
  };
}

// Helper hook: Import predictions with enhanced state
export function useImportPredictions() {
  const { importPredictions, isImporting } = useVeritas();
  const [importState, setImportState] = useState<{
    status: 'idle' | 'scanning' | 'found' | 'importing' | 'success' | 'error';
    data?: {
      foundCount: number;
      correctCount: number;
      volume: string;
      calculatedScore?: number;
    };
    error?: string;
  }>({ status: 'idle' });

  const startImport = async (
    platformId: bigint,
    totalPredictions: bigint,
    correctPredictions: bigint,
    totalVolume: bigint,
    proof: `0x${string}`
  ) => {
    try {
      setImportState({ status: 'importing' });
      await importPredictions(platformId, totalPredictions, correctPredictions, totalVolume, proof);

      // Calculate expected score (simplified formula)
      const winRate = (Number(correctPredictions) / Number(totalPredictions)) * 100;
      const volumeNum = Number(totalVolume) / 10 ** 18;
      const calculatedScore = Math.floor((winRate * 100) * Math.sqrt(volumeNum) / 100);

      setImportState({
        status: 'success',
        data: {
          foundCount: Number(totalPredictions),
          correctCount: Number(correctPredictions),
          volume: volumeNum.toFixed(2),
          calculatedScore,
        },
      });
    } catch (error: any) {
      setImportState({
        status: 'error',
        error: error?.message || 'Failed to import predictions',
      });
    }
  };

  const resetImport = () => {
    setImportState({ status: 'idle' });
  };

  return {
    importState,
    startImport,
    resetImport,
    isImporting,
  };
}

// Helper hook: Update score with feedback
export function useUpdateScore() {
  const { updateVeritasScore, isUpdating, refetchProfile, refetchNFTMetadata } = useVeritas();
  const [updateState, setUpdateState] = useState<{
    status: 'idle' | 'updating' | 'success' | 'error';
    error?: string;
  }>({ status: 'idle' });

  const startUpdate = async (userAddress?: `0x${string}`) => {
    try {
      setUpdateState({ status: 'updating' });
      await updateVeritasScore(userAddress);
      await refetchProfile();
      await refetchNFTMetadata();
      setUpdateState({ status: 'success' });

      // Reset to idle after 3 seconds
      setTimeout(() => setUpdateState({ status: 'idle' }), 3000);
    } catch (error: any) {
      setUpdateState({
        status: 'error',
        error: error?.message || 'Failed to update score',
      });
    }
  };

  const resetUpdate = () => {
    setUpdateState({ status: 'idle' });
  };

  return {
    updateState,
    startUpdate,
    resetUpdate,
    isUpdating,
  };
}
