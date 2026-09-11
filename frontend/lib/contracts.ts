import { Address } from 'viem';

/**
 * Contract Addresses — Somnia only
 *
 * UPDATE AFTER DEPLOYMENT:
 * After running the deployment script (contracts/script/Deploy.s.sol or DeployDreamDEX.s.sol),
 * copy the addresses from the output or from deployments/somnia-testnet.json
 * and update the addresses below.
 *
 * Example:
 *   VeritasCore: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1' as Address,
 */
export const CONTRACTS = {
  somniaTestnet: {
    VeritasCore: (process.env.NEXT_PUBLIC_CORE_ADDRESS_SOMNIA_TESTNET || process.env.NEXT_PUBLIC_CORE_ADDRESS_TESTNET) as Address || '0x0000000000000000000000000000000000000000' as Address,
    ReputationNFT: (process.env.NEXT_PUBLIC_NFT_ADDRESS_SOMNIA_TESTNET || process.env.NEXT_PUBLIC_NFT_ADDRESS_TESTNET) as Address || '0x0000000000000000000000000000000000000000' as Address,
    ScoreCalculator: (process.env.NEXT_PUBLIC_CALCULATOR_ADDRESS_SOMNIA_TESTNET || process.env.NEXT_PUBLIC_CALCULATOR_ADDRESS_TESTNET) as Address || '0x0000000000000000000000000000000000000000' as Address,
    PlatformRegistry: (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS_SOMNIA_TESTNET || process.env.NEXT_PUBLIC_REGISTRY_ADDRESS_TESTNET) as Address || '0x0000000000000000000000000000000000000000' as Address,
    DreamDEXCopyVault: process.env.NEXT_PUBLIC_DREAMDEX_VAULT_TESTNET as Address || '0x0000000000000000000000000000000000000000' as Address,
    DreamDEXAdapter: process.env.NEXT_PUBLIC_DREAMDEX_ADAPTER as Address || '0x0000000000000000000000000000000000000000' as Address,
    AzuroAdapter: process.env.NEXT_PUBLIC_AZURO_ADAPTER as Address || '0x0000000000000000000000000000000000000000' as Address,
    SXBetAdapter: process.env.NEXT_PUBLIC_SX_ADAPTER as Address || '0x0000000000000000000000000000000000000000' as Address,
  },
  somnia: {
    VeritasCore: (process.env.NEXT_PUBLIC_CORE_ADDRESS_SOMNIA_MAINNET || process.env.NEXT_PUBLIC_CORE_ADDRESS_MAINNET) as Address || '0x0000000000000000000000000000000000000000' as Address,
    ReputationNFT: (process.env.NEXT_PUBLIC_NFT_ADDRESS_SOMNIA_MAINNET || process.env.NEXT_PUBLIC_NFT_ADDRESS_MAINNET) as Address || '0x0000000000000000000000000000000000000000' as Address,
    ScoreCalculator: (process.env.NEXT_PUBLIC_CALCULATOR_ADDRESS_SOMNIA_MAINNET || process.env.NEXT_PUBLIC_CALCULATOR_ADDRESS_MAINNET) as Address || '0x0000000000000000000000000000000000000000' as Address,
    PlatformRegistry: (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS_SOMNIA_MAINNET || process.env.NEXT_PUBLIC_REGISTRY_ADDRESS_MAINNET) as Address || '0x0000000000000000000000000000000000000000' as Address,
  },
} as const;

// Somnia DreamDEX Event Contracts — CREATE3 (testnet=mainnet) per implementation.md §2
export const SOMNIA_DREAMDEX = {
  venueIdTestnet: (process.env.NEXT_PUBLIC_SOMNIA_VENUE_ID_TESTNET || '0x679795a0195a1b76cdebb7c51d74e058aee92919b8c3389af86ef24535e8a28c') as `0x${string}`,
  venueIdMainnet: (process.env.NEXT_PUBLIC_SOMNIA_VENUE_ID_MAINNET || '0x0000000000000000000000000000000000000000000000000000000000000000') as `0x${string}`,
  collateralTUSDC: (process.env.NEXT_PUBLIC_COLLATERAL_TUSDC || '0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E') as Address,
  collateralUSDso: (process.env.NEXT_PUBLIC_COLLATERAL_USDSO_MAINNET || '0x00000022dA000000000000000000000000000008A') as Address,
  indexerUrl: process.env.NEXT_PUBLIC_SOMNIA_INDEXER_URL || 'https://api.infra.testnet.somnia.network',
  explorerTestnet: process.env.NEXT_PUBLIC_SOMNIA_EXPLORER || 'https://shannon-explorer.somnia.network',
  explorerMainnet: process.env.NEXT_PUBLIC_SOMNIA_EXPLORER_MAINNET || 'https://explorer.somnia.network',
  rpcTestnet: process.env.NEXT_PUBLIC_SOMNIA_RPC_TESTNET || 'https://dream-rpc.somnia.network',
  wsRpcTestnet: process.env.NEXT_PUBLIC_SOMNIA_WS_RPC || 'wss://dream-rpc.somnia.network/ws',
  // CREATE3 addresses — same on testnet & mainnet
  BinaryMarketsModule: '0x3ecC694Cef705358864a646142ac17A90E29e388' as Address,
  MarketsCore: '0x2802504314685D89bF6C992CA5a8e7cC78bc0294' as Address,
  BinarySettlement: '0xbF4a49e0Dfd092e5FBE8E5761064C49533e6Ed23' as Address,
  OutcomeToken6909: '0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9' as Address,
  OracleHub: '0xe40db387cC98601Dd11bd634fF2f3AD5686dE32b' as Address,
  CollateralRouter: '0xbC0C9834B15ACE38bB50dDaa7d7f7C7CC4DC183C' as Address,
} as const;

// ERC20 minimal ABI for tUSDC handling (6 vs 18 decimals — implementation.md §2)
export const ERC20_ABI = [
  { inputs: [], name: 'decimals', outputs: [{ type: 'uint8' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'owner', type: 'address' }], name: 'balanceOf', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], name: 'allowance', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'approve', outputs: [{ type: 'bool' }], stateMutability: 'nonpayable', type: 'function' },
] as const;

// DreamDEX 6909 + BinarySettlement ABIs (minimal for UI)
export const OUTCOME_TOKEN_6909_ABI = [
  { inputs: [{ name: 'owner', type: 'address' }, { name: 'id', type: 'uint256' }], name: 'balanceOf', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'owner', type: 'address' }], name: 'balanceOfBatch6909', outputs: [{ type: 'uint256[]' }], stateMutability: 'view', type: 'function' },
] as const;

export const BINARY_SETTLEMENT_ABI = [
  { inputs: [{ name: 'marketId', type: 'bytes32' }], name: 'redeem', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'marketId', type: 'bytes32' }], name: 'winningOutcome', outputs: [{ type: 'uint8' }], stateMutability: 'view', type: 'function' },
] as const;

export const BINARY_MARKETS_MODULE_ABI = [
  { inputs: [{ name: 'marketId', type: 'bytes32' }], name: 'getMarket', outputs: [{ components: [{ name: 'marketId', type: 'bytes32' }, { name: 'pool', type: 'address' }, { name: 'status', type: 'uint8' }, { name: 'lockTime', type: 'uint64' }, { name: 'expiry', type: 'uint64' }, { name: 'venueId', type: 'bytes32' }], type: 'tuple' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'marketId', type: 'bytes32' }], name: 'markets', outputs: [{ type: 'address' }], stateMutability: 'view', type: 'function' },
] as const;

// Contract constants
export const MINT_FEE = BigInt('500000000000000'); // 0.0005 STT in wei

// Copy Trading Vault addresses
export const COPY_VAULT_ADDRESS = (process.env.NEXT_PUBLIC_COPY_VAULT_ADDRESS || process.env.NEXT_PUBLIC_COPY_TRADING_VAULT || '0x0000000000000000000000000000000000000000') as `0x${string}`;
export const DREAMDEX_COPY_VAULT_ADDRESS = (process.env.NEXT_PUBLIC_DREAMDEX_VAULT_TESTNET || CONTRACTS.somniaTestnet.DreamDEXCopyVault || '0x0000000000000000000000000000000000000000') as `0x${string}`;

// Copy Trading Vault ABI
export const COPY_TRADING_VAULT_ABI = [
  // View functions
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
  {
    inputs: [],
    name: 'MIN_DEPOSIT',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'WITHDRAWAL_DELAY',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'paused',
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'MAX_ALLOCATION_BPS',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'PROTOCOL_FEE_BPS',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'DREAMDEX_PREDICTION',
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'balances',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getPendingWithdrawal',
    outputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'unlockTime', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getUserFollows',
    outputs: [
      {
        type: 'tuple[]',
        components: [
          { name: 'leader', type: 'address' },
          { name: 'allocationBps', type: 'uint256' },
          { name: 'maxBetSize', type: 'uint256' },
          { name: 'active', type: 'bool' },
          { name: 'createdAt', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'leader', type: 'address' }],
    name: 'getLeaderFollowers',
    outputs: [{ type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'leader', type: 'address' }],
    name: 'getFollowerCount',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'follower', type: 'address' },
      { name: 'leader', type: 'address' },
    ],
    name: 'getFollowSettings',
    outputs: [
      { name: 'allocationBps', type: 'uint256' },
      { name: 'maxBetAmount', type: 'uint256' },
      { name: 'isActive', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  // Write functions
  {
    inputs: [],
    name: 'deposit',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ name: 'amount', type: 'uint256' }],
    name: 'requestWithdrawal',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'executeWithdrawal',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'cancelWithdrawal',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'leader', type: 'address' },
      { name: 'allocationBps', type: 'uint256' },
      { name: 'maxBetSize', type: 'uint256' },
    ],
    name: 'follow',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'leader', type: 'address' }],
    name: 'unfollow',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'leader', type: 'address' },
      { name: 'allocationBps', type: 'uint256' },
      { name: 'maxBetAmount', type: 'uint256' },
      { name: 'isActive', type: 'bool' },
    ],
    name: 'updateFollowSettings',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'user', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
    name: 'Deposited',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'user', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: false, name: 'unlockTime', type: 'uint256' },
    ],
    name: 'WithdrawalRequested',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'user', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
    name: 'WithdrawalExecuted',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'follower', type: 'address' },
      { indexed: true, name: 'leader', type: 'address' },
      { indexed: false, name: 'allocationBps', type: 'uint256' },
    ],
    name: 'FollowedLeader',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'follower', type: 'address' },
      { indexed: true, name: 'leader', type: 'address' },
    ],
    name: 'UnfollowedLeader',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'follower', type: 'address' },
      { indexed: true, name: 'leader', type: 'address' },
      { indexed: false, name: 'epoch', type: 'uint256' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: false, name: 'isBull', type: 'bool' },
    ],
    name: 'CopyTradeExecuted',
    type: 'event',
  },
] as const;

// DreamDEX Copy Vault ABI (Somnia Shannon — tUSDC 6dec, ERC6909)
export const DREAMDEX_COPY_VAULT_ABI = [
  { inputs: [{ name: 'user', type: 'address' }], name: 'balances', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'totalValueLocked', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'totalCopyTrades', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'totalVolumeExecuted', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'executor', outputs: [{ type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'getVaultStats', outputs: [{ name: 'tvl', type: 'uint256' }, { name: 'copyTrades', type: 'uint256' }, { name: 'volume', type: 'uint256' }, { name: 'exec', type: 'address' }, { name: 'collateral', type: 'address' }, { name: 'decimals', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'user', type: 'address' }], name: 'getUserFollows', outputs: [{ name: 'leaders', type: 'address[]' }, { name: 'settings', type: 'tuple[]', components: [{ name: 'allocationBps', type: 'uint256' }, { name: 'maxBet', type: 'uint256' }, { name: 'active', type: 'bool' }, { name: 'createdAt', type: 'uint64' }] }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'leader', type: 'address' }], name: 'getLeaderFollowers', outputs: [{ type: 'address[]' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'follower', type: 'address' }, { name: 'leader', type: 'address' }], name: 'getFollowSettings', outputs: [{ type: 'uint256' }, { type: 'uint256' }, { type: 'bool' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'amount', type: 'uint256' }], name: 'deposit', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'amount', type: 'uint256' }], name: 'withdraw', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'leader', type: 'address' }, { name: 'allocationBps', type: 'uint256' }, { name: 'maxBet', type: 'uint256' }], name: 'follow', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'leader', type: 'address' }], name: 'unfollow', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'leader', type: 'address' }, { name: 'allocationBps', type: 'uint256' }, { name: 'maxBet', type: 'uint256' }], name: 'updateFollow', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'follower', type: 'address' }, { name: 'leader', type: 'address' }, { name: 'marketId', type: 'bytes32' }, { name: 'isUp', type: 'bool' }, { name: 'leaderBetAmount', type: 'uint256' }], name: 'executeCopyTrade', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'leader', type: 'address' }, { name: 'marketId', type: 'bytes32' }, { name: 'isUp', type: 'bool' }, { name: 'leaderBetAmount', type: 'uint256' }], name: 'batchExecuteCopyTrades', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'user', type: 'address' }], name: 'getUserTradeHistory', outputs: [{ type: 'tuple[]', components: [{ name: 'follower', type: 'address' }, { name: 'leader', type: 'address' }, { name: 'marketId', type: 'bytes32' }, { name: 'isUp', type: 'bool' }, { name: 'leaderBetAmount', type: 'uint256' }, { name: 'copyAmount', type: 'uint256' }, { name: 'timestamp', type: 'uint256' }, { name: 'txHash', type: 'bytes32' }] }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'paused', outputs: [{ type: 'bool' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'owner', outputs: [{ type: 'address' }], stateMutability: 'view', type: 'function' },
  { anonymous: false, inputs: [{ indexed: true, name: 'user', type: 'address' }, { indexed: false, name: 'amount', type: 'uint256' }, { indexed: false, name: 'newBalance', type: 'uint256' }], name: 'Deposited', type: 'event' },
  { anonymous: false, inputs: [{ indexed: true, name: 'user', type: 'address' }, { indexed: false, name: 'amount', type: 'uint256' }, { indexed: false, name: 'newBalance', type: 'uint256' }], name: 'Withdrawn', type: 'event' },
  { anonymous: false, inputs: [{ indexed: true, name: 'follower', type: 'address' }, { indexed: true, name: 'leader', type: 'address' }, { indexed: false, name: 'allocationBps', type: 'uint256' }, { indexed: false, name: 'maxBet', type: 'uint256' }], name: 'Followed', type: 'event' },
  { anonymous: false, inputs: [{ indexed: true, name: 'follower', type: 'address' }, { indexed: true, name: 'leader', type: 'address' }], name: 'Unfollowed', type: 'event' },
  { anonymous: false, inputs: [{ indexed: true, name: 'follower', type: 'address' }, { indexed: true, name: 'leader', type: 'address' }, { indexed: true, name: 'marketId', type: 'bytes32' }, { indexed: false, name: 'copyAmount', type: 'uint256' }, { indexed: false, name: 'isUp', type: 'bool' }], name: 'CopyTradeExecuted', type: 'event' },
] as const;

// VeritasCore ABI
export const VERITAS_CORE_ABI = [
  // View functions
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
      {
        components: [
          { name: 'reputationNFTId', type: 'uint256' },
          { name: 'veritasScore', type: 'uint256' },
          { name: 'totalPredictions', type: 'uint256' },
          { name: 'correctPredictions', type: 'uint256' },
          { name: 'totalVolume', type: 'uint256' },
          { name: 'connectedPlatforms', type: 'uint256[]' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'lastUpdate', type: 'uint256' },
        ],
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getWinRate',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'platformId', type: 'uint256' },
    ],
    name: 'isPlatformConnected',
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getConnectedPlatformCount',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Write functions
  {
    inputs: [],
    name: 'registerUser',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ name: 'platformId', type: 'uint256' }],
    name: 'connectPlatform',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'platformId', type: 'uint256' },
      { name: 'totalPredictions', type: 'uint256' },
      { name: 'correctPredictions', type: 'uint256' },
      { name: 'totalVolume', type: 'uint256' },
      { name: 'proof', type: 'bytes32' },
    ],
    name: 'importPredictions',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'updateVeritasScore',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'user', type: 'address' },
      { indexed: false, name: 'nftTokenId', type: 'uint256' },
      { indexed: false, name: 'timestamp', type: 'uint256' },
    ],
    name: 'UserRegistered',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'user', type: 'address' },
      { indexed: true, name: 'platformId', type: 'uint256' },
      { indexed: false, name: 'platformName', type: 'string' },
    ],
    name: 'PlatformConnected',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'user', type: 'address' },
      { indexed: false, name: 'oldScore', type: 'uint256' },
      { indexed: false, name: 'newScore', type: 'uint256' },
    ],
    name: 'VeritasScoreUpdated',
    type: 'event',
  },
] as const;

// ReputationNFT ABI
export const REPUTATION_NFT_ABI = [
  // View functions
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    name: 'ownerOf',
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'tokenOfOwner',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    name: 'tokenURI',
    outputs: [{ type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    name: 'getMetadata',
    outputs: [
      {
        components: [
          { name: 'veritasScore', type: 'uint256' },
          { name: 'tier', type: 'uint8' },
          { name: 'totalPredictions', type: 'uint256' },
          { name: 'correctPredictions', type: 'uint256' },
          { name: 'winRate', type: 'uint256' },
          { name: 'totalVolume', type: 'uint256' },
          { name: 'platformNames', type: 'string[]' },
          { name: 'lastUpdated', type: 'uint256' },
        ],
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    name: 'getTier',
    outputs: [{ type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'to', type: 'address' },
      { indexed: true, name: 'tokenId', type: 'uint256' },
    ],
    name: 'Transfer',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'tokenId', type: 'uint256' },
      { indexed: false, name: 'oldScore', type: 'uint256' },
      { indexed: false, name: 'newScore', type: 'uint256' },
      { indexed: false, name: 'oldTier', type: 'uint8' },
      { indexed: false, name: 'newTier', type: 'uint8' },
    ],
    name: 'MetadataUpdated',
    type: 'event',
  },
] as const;

// PlatformRegistry ABI
export const PLATFORM_REGISTRY_ABI = [
  {
    inputs: [],
    name: 'getPlatformCount',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'platformId', type: 'uint256' }],
    name: 'getPlatform',
    outputs: [
      {
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'name', type: 'string' },
          { name: 'adapter', type: 'address' },
          { name: 'dataSource', type: 'string' },
          { name: 'platformType', type: 'uint8' },
          { name: 'isActive', type: 'bool' },
          { name: 'registeredAt', type: 'uint256' },
          { name: 'updatedAt', type: 'uint256' },
        ],
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'platformId', type: 'uint256' }],
    name: 'isPlatformActive',
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// ScoreCalculator ABI
export const SCORE_CALCULATOR_ABI = [
  {
    inputs: [
      { name: 'totalPredictions', type: 'uint256' },
      { name: 'correctPredictions', type: 'uint256' },
      { name: 'totalVolume', type: 'uint256' },
    ],
    name: 'calculateVeritasScore',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'pure',
    type: 'function',
  },
] as const;

// Enums
export enum ReputationTier {
  BRONZE = 0,
  SILVER = 1,
  GOLD = 2,
  PLATINUM = 3,
  DIAMOND = 4,
}

export const TIER_NAMES = {
  [ReputationTier.BRONZE]: 'Bronze',
  [ReputationTier.SILVER]: 'Silver',
  [ReputationTier.GOLD]: 'Gold',
  [ReputationTier.PLATINUM]: 'Platinum',
  [ReputationTier.DIAMOND]: 'Diamond',
} as const;

export const TIER_COLORS = {
  [ReputationTier.BRONZE]: 'bg-tier-bronze',
  [ReputationTier.SILVER]: 'bg-tier-silver',
  [ReputationTier.GOLD]: 'bg-tier-gold',
  [ReputationTier.PLATINUM]: 'bg-tier-platinum',
  [ReputationTier.DIAMOND]: 'bg-tier-diamond',
} as const;

export const TIER_THRESHOLDS = {
  [ReputationTier.BRONZE]: 0,
  [ReputationTier.SILVER]: 200,
  [ReputationTier.GOLD]: 400,
  [ReputationTier.PLATINUM]: 650,
  [ReputationTier.DIAMOND]: 900,
} as const;

// Types
export interface UserProfile {
  reputationNFTId: bigint;
  veritasScore: bigint;
  totalPredictions: bigint;
  correctPredictions: bigint;
  totalVolume: bigint;
  connectedPlatforms: readonly bigint[];
  createdAt: bigint;
  lastUpdate: bigint;
}

export interface NFTMetadata {
  veritasScore: bigint;
  tier: ReputationTier;
  totalPredictions: bigint;
  correctPredictions: bigint;
  winRate: bigint;
  totalVolume: bigint;
  platformNames: readonly string[];
  lastUpdated: bigint;
}

export interface Platform {
  id: bigint;
  name: string;
  adapter: Address;
  dataSource: string;
  platformType: number;
  isActive: boolean;
  registeredAt: bigint;
  updatedAt: bigint;
}
