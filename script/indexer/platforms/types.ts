import { Address } from 'viem';

export interface PlatformBet {
  user: Address;
  marketId: string;
  amount: bigint;
  position: string; // bull/bear, yes/no, outcome index
  timestamp: bigint;
  blockNumber: bigint;
  txHash: string;
}

export interface PlatformClaim {
  user: Address;
  marketId: string;
  amount: bigint;
  timestamp: bigint;
  blockNumber: bigint;
  txHash: string;
}

export interface PlatformUserStats {
  address: Address;
  platform: string;
  totalBets: number;
  totalVolume: bigint;
  wins: number;
  losses: number;
  winRate: number;
  platformScore: number;
}

export interface UserBet {
  platform: string;
  marketId: string;
  amount: bigint;
  position: string;
  timestamp: bigint;
  won?: boolean;
  claimedAmount?: bigint;
}

export interface AggregatedUserStats {
  address: Address;
  totalBets: number;
  totalVolume: bigint; // Normalized to ETH/STT equivalent
  wins: number;
  losses: number;
  winRate: number;
  veritasScore: number;
  rank?: number;
  platforms: string[]; // List of platforms user is active on
  platformStats: { [platform: string]: PlatformUserStats };
  bets: UserBet[];
}

export interface IndexerResult {
  platform: string;
  chain: string;
  userStats: Map<Address, PlatformUserStats>;
  totalBetsIndexed: number;
  totalClaimsIndexed: number;
  blockRange: { from: bigint; to: bigint };
  indexedAt: number;
  errors: string[];
}

export interface PlatformConfig {
  name: string;
  chain: string;
  rpcUrl: string;
  contractAddress?: Address;
  apiEndpoint?: string; // For platforms that use APIs
  startBlock?: bigint;
  enabled: boolean;
  batchSize: bigint;
  delayMs: number;
}

export interface PlatformAdapter {
  name: string;
  config: PlatformConfig;

  /**
   * Index users from this platform
   */
  indexUsers(fromBlock: bigint, toBlock: bigint): Promise<IndexerResult>;

  /**
   * Fetch user stats from this platform
   */
  getUserStats(address: Address): Promise<PlatformUserStats | null>;

  /**
   * Check if this adapter is available and configured
   */
  isAvailable(): Promise<boolean>;
}
