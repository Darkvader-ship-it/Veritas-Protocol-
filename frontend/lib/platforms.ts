/**
 * Platform Configuration
 *
 * Central configuration for all 12 supported prediction market platforms.
 * Import this file instead of defining platform configs in individual components.
 */

export type PlatformId =
  | 'polymarket'
  | 'overtime'
  | 'speedmarkets'
  | 'limitless'
  | 'azuro'
  | 'sxbet'
  | 'gnosis'
  | 'drift'
  | 'kalshi'
  | 'manifold'
  | 'metaculus'
  | 'dreamdex';

export type PlatformCategory = 'evm' | 'solana' | 'offchain' | 'hybrid';

export interface PlatformConfig {
  id: PlatformId;
  name: string;
  displayName: string;
  chain: string;
  category: PlatformCategory;
  icon: string;
  gradient: string;
  bgGradient: string;
  textColor: string;
  borderColor: string;
  // API endpoints
  leaderboardEndpoint: string;
  marketsEndpoint: string;
  simulateEndpoint: string;
  resolveEndpoint: string;
  // External links
  explorer?: string;
  profileUrl?: (address: string) => string;
  website: string;
  // Market info
  marketType: 'binary' | 'sports' | 'crypto' | 'events' | 'forecasting';
  currency: string;
  isRealMoney: boolean;
  // Feature flags
  supportsSimulation: boolean;
  supportsCopyTrading: boolean;
  supportsLeaderboard: boolean;
  // Status
  status: 'active' | 'beta' | 'coming_soon';
}

/**
 * All 12 supported platforms — Somnia hub (Somnia hub, DreamDEX is primary)
 */
export const PLATFORMS: Record<PlatformId, PlatformConfig> = {
  // ===== EVM PLATFORMS =====
  polymarket: {
    id: 'polymarket',
    name: 'Polymarket',
    displayName: 'Polymarket',
    chain: 'Somnia',
    category: 'evm',
    icon: '🔮',
    gradient: 'from-purple-500 to-indigo-600',
    bgGradient: 'from-purple-500/20 to-indigo-600/20',
    textColor: 'text-purple-400',
    borderColor: 'border-purple-500/50',
    leaderboardEndpoint: '/api/polymarket-leaderboard',
    marketsEndpoint: '/api/polymarket',
    simulateEndpoint: '/api/polymarket/simulate',
    resolveEndpoint: '/api/polymarket/resolve',
    explorer: 'https://shannon-explorer.somnia.network/address/',
    profileUrl: (addr) => `https://polymarket.com/profile/${addr}`,
    website: 'https://polymarket.com',
    marketType: 'events',
    currency: 'tUSDC',
    isRealMoney: true,
    supportsSimulation: false,
    supportsCopyTrading: true,
    supportsLeaderboard: true,
    status: 'active',
  },

  overtime: {
    id: 'overtime',
    name: 'Overtime',
    displayName: 'Overtime',
    chain: 'Somnia',
    category: 'evm',
    icon: '⚽',
    gradient: 'from-red-500 to-pink-500',
    bgGradient: 'from-red-500/20 to-pink-500/20',
    textColor: 'text-red-400',
    borderColor: 'border-red-500/50',
    leaderboardEndpoint: '/api/overtime-leaderboard',
    marketsEndpoint: '/api/overtime',
    simulateEndpoint: '/api/overtime/simulate',
    resolveEndpoint: '/api/overtime/resolve',
    explorer: 'https://shannon-explorer.somnia.network/address/',
    profileUrl: (addr) => `https://overtimemarkets.xyz/profile/${addr}`,
    website: 'https://overtimemarkets.xyz',
    marketType: 'sports',
    currency: 'tUSDC',
    isRealMoney: true,
    supportsSimulation: false,
    supportsCopyTrading: true,
    supportsLeaderboard: true,
    status: 'active',
  },

  speedmarkets: {
    id: 'speedmarkets',
    name: 'Speed Markets',
    displayName: 'Speed Markets',
    chain: 'Optimism',
    category: 'evm',
    icon: '⚡',
    gradient: 'from-orange-500 to-red-500',
    bgGradient: 'from-orange-500/20 to-red-500/20',
    textColor: 'text-orange-400',
    borderColor: 'border-orange-500/50',
    leaderboardEndpoint: '/api/speedmarkets-leaderboard',
    marketsEndpoint: '/api/speedmarkets',
    simulateEndpoint: '/api/speedmarkets/simulate',
    resolveEndpoint: '/api/speedmarkets/resolve',
    explorer: 'https://optimistic.etherscan.io/address/',
    website: 'https://speedmarkets.xyz',
    marketType: 'crypto',
    currency: 'ETH',
    isRealMoney: true,
    supportsSimulation: false,
    supportsCopyTrading: true,
    supportsLeaderboard: true,
    status: 'active',
  },

  limitless: {
    id: 'limitless',
    name: 'Limitless',
    displayName: 'Limitless',
    chain: 'Base',
    category: 'evm',
    icon: '♾️',
    gradient: 'from-blue-500 to-cyan-500',
    bgGradient: 'from-blue-500/20 to-cyan-500/20',
    textColor: 'text-blue-400',
    borderColor: 'border-blue-500/50',
    leaderboardEndpoint: '/api/limitless-leaderboard',
    marketsEndpoint: '/api/limitless',
    simulateEndpoint: '/api/limitless/simulate',
    resolveEndpoint: '/api/limitless/resolve',
    explorer: 'https://basescan.org/address/',
    profileUrl: (addr) => `https://limitless.exchange/profile/${addr}`,
    website: 'https://limitless.exchange',
    marketType: 'events',
    currency: 'tUSDC',
    isRealMoney: true,
    supportsSimulation: false,
    supportsCopyTrading: true,
    supportsLeaderboard: true,
    status: 'active',
  },

  azuro: {
    id: 'azuro',
    name: 'Azuro',
    displayName: 'Azuro',
    chain: 'Somnia',
    category: 'evm',
    icon: '🎯',
    gradient: 'from-cyan-500 to-teal-500',
    bgGradient: 'from-cyan-500/20 to-teal-500/20',
    textColor: 'text-cyan-400',
    borderColor: 'border-cyan-500/50',
    leaderboardEndpoint: '/api/azuro-leaderboard',
    marketsEndpoint: '/api/azuro',
    simulateEndpoint: '/api/azuro/simulate',
    resolveEndpoint: '/api/azuro/resolve',
    explorer: 'https://shannon-explorer.somnia.network/address/',
    website: 'https://azuro.org',
    marketType: 'sports',
    currency: 'tUSDC',
    isRealMoney: true,
    supportsSimulation: false,
    supportsCopyTrading: true,
    supportsLeaderboard: true,
    status: 'active',
  },

  sxbet: {
    id: 'sxbet',
    name: 'SX Bet',
    displayName: 'SX Bet',
    chain: 'SX Network',
    category: 'evm',
    icon: '🎰',
    gradient: 'from-green-500 to-emerald-500',
    bgGradient: 'from-green-500/20 to-emerald-500/20',
    textColor: 'text-green-400',
    borderColor: 'border-green-500/50',
    leaderboardEndpoint: '/api/sxbet-leaderboard',
    marketsEndpoint: '/api/sxbet',
    simulateEndpoint: '/api/sxbet/simulate',
    resolveEndpoint: '/api/sxbet/resolve',
    explorer: 'https://explorer.sx.technology/address/',
    website: 'https://sx.bet',
    marketType: 'sports',
    currency: 'tUSDC',
    isRealMoney: true,
    supportsSimulation: false,
    supportsCopyTrading: true,
    supportsLeaderboard: true,
    status: 'active',
  },

  gnosis: {
    id: 'gnosis',
    name: 'Gnosis/Omen',
    displayName: 'Omen',
    chain: 'Somnia',
    category: 'evm',
    icon: '🦉',
    gradient: 'from-emerald-500 to-green-600',
    bgGradient: 'from-emerald-500/20 to-green-600/20',
    textColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/50',
    leaderboardEndpoint: '/api/gnosis-leaderboard',
    marketsEndpoint: '/api/gnosis',
    simulateEndpoint: '/api/gnosis/simulate',
    resolveEndpoint: '/api/gnosis/resolve',
    explorer: 'https://gnosisscan.io/address/',
    website: 'https://omen.eth.limo',
    marketType: 'events',
    currency: 'tUSDC',
    isRealMoney: true,
    supportsSimulation: false,
    supportsCopyTrading: true,
    supportsLeaderboard: true,
    status: 'active',
  },

  // ===== SOLANA / HYBRID PLATFORMS =====
  drift: {
    id: 'drift',
    name: 'Drift BET',
    displayName: 'Drift',
    chain: 'Somnia',
    category: 'evm',
    icon: '🌊',
    gradient: 'from-violet-500 to-purple-600',
    bgGradient: 'from-violet-500/20 to-purple-600/20',
    textColor: 'text-violet-400',
    borderColor: 'border-violet-500/50',
    leaderboardEndpoint: '/api/drift-leaderboard',
    marketsEndpoint: '/api/drift',
    simulateEndpoint: '/api/drift/simulate',
    resolveEndpoint: '/api/drift/resolve',
    explorer: 'https://shannon-explorer.somnia.network/address/',
    website: 'https://drift.trade',
    marketType: 'events',
    currency: 'tUSDC',
    isRealMoney: true,
    supportsSimulation: false,
    supportsCopyTrading: true,
    supportsLeaderboard: true,
    status: 'active',
  },

  kalshi: {
    id: 'kalshi',
    name: 'Kalshi',
    displayName: 'Kalshi',
    chain: 'Hybrid',
    category: 'hybrid',
    icon: '📊',
    gradient: 'from-slate-500 to-gray-600',
    bgGradient: 'from-slate-500/20 to-gray-600/20',
    textColor: 'text-slate-400',
    borderColor: 'border-slate-500/50',
    leaderboardEndpoint: '/api/kalshi-leaderboard',
    marketsEndpoint: '/api/kalshi',
    simulateEndpoint: '/api/kalshi/simulate',
    resolveEndpoint: '/api/kalshi/resolve',
    website: 'https://kalshi.com',
    marketType: 'events',
    currency: 'tUSDC',
    isRealMoney: true,
    supportsSimulation: false,
    supportsCopyTrading: false, // Regulated, no copy trading
    supportsLeaderboard: true,
    status: 'active',
  },

  // ===== OFF-CHAIN PLATFORMS =====
  manifold: {
    id: 'manifold',
    name: 'Manifold Markets',
    displayName: 'Manifold',
    chain: 'Off-chain',
    category: 'offchain',
    icon: '📈',
    gradient: 'from-indigo-500 to-blue-600',
    bgGradient: 'from-indigo-500/20 to-blue-600/20',
    textColor: 'text-indigo-400',
    borderColor: 'border-indigo-500/50',
    leaderboardEndpoint: '/api/manifold-leaderboard',
    marketsEndpoint: '/api/manifold',
    simulateEndpoint: '/api/manifold/simulate',
    resolveEndpoint: '/api/manifold/resolve',
    profileUrl: (username) => `https://manifold.markets/${username}`,
    website: 'https://manifold.markets',
    marketType: 'events',
    currency: 'Mana',
    isRealMoney: false, // Play money
    supportsSimulation: false,
    supportsCopyTrading: true,
    supportsLeaderboard: true,
    status: 'active',
  },

  metaculus: {
    id: 'metaculus',
    name: 'Metaculus',
    displayName: 'Metaculus',
    chain: 'Somnia',
    category: 'evm',
    icon: '🔬',
    gradient: 'from-teal-500 to-cyan-600',
    bgGradient: 'from-teal-500/20 to-cyan-600/20',
    textColor: 'text-teal-400',
    borderColor: 'border-teal-500/50',
    leaderboardEndpoint: '/api/metaculus-leaderboard',
    marketsEndpoint: '/api/metaculus',
    simulateEndpoint: '/api/metaculus/simulate',
    resolveEndpoint: '/api/metaculus/resolve',
    website: 'https://metaculus.com',
    marketType: 'forecasting',
    currency: 'tUSDC',
    isRealMoney: false, // Reputation-based
    supportsSimulation: false,
    supportsCopyTrading: true,
    supportsLeaderboard: true,
    status: 'active',
  },

  dreamdex: {
    id: 'dreamdex',
    name: 'DreamDEX Event Contracts',
    displayName: 'DreamDEX',
    chain: 'Somnia',
    category: 'evm',
    icon: '💭',
    gradient: 'from-fuchsia-500 to-purple-600',
    bgGradient: 'from-fuchsia-500/20 to-purple-600/20',
    textColor: 'text-fuchsia-400',
    borderColor: 'border-fuchsia-500/50',
    leaderboardEndpoint: '/api/dreamdex-leaderboard',
    marketsEndpoint: '/api/dreamdex',
    simulateEndpoint: '', // REAL — no simulation (implementation.md §4)
    resolveEndpoint: '/api/dreamdex/resolve',
    explorer: 'https://shannon-explorer.somnia.network/address/',
    profileUrl: (addr) => `https://shannon-explorer.somnia.network/address/${addr}`,
    website: 'https://app.dreamdex.io/event-contracts',
    marketType: 'crypto',
    currency: 'tUSDC',
    isRealMoney: true,
    supportsSimulation: false,
    supportsCopyTrading: true,
    supportsLeaderboard: true,
    status: 'active',
  },
};

/**
 * Platform arrays by category
 */
export const EVM_PLATFORMS = Object.values(PLATFORMS).filter(p => p.category === 'evm');
export const SOLANA_PLATFORMS = Object.values(PLATFORMS).filter(p => p.category === 'solana');
export const HYBRID_PLATFORMS = Object.values(PLATFORMS).filter(p => p.category === 'hybrid');
export const OFFCHAIN_PLATFORMS = Object.values(PLATFORMS).filter(p => p.category === 'offchain');

export const REAL_MONEY_PLATFORMS = Object.values(PLATFORMS).filter(p => p.isRealMoney);
export const PLAY_MONEY_PLATFORMS = Object.values(PLATFORMS).filter(p => !p.isRealMoney);

export const ACTIVE_PLATFORMS = Object.values(PLATFORMS).filter(p => p.status === 'active');
export const BETA_PLATFORMS = Object.values(PLATFORMS).filter(p => p.status === 'beta');

/**
 * Platform IDs as array (for iteration)
 */
export const PLATFORM_IDS: PlatformId[] = Object.keys(PLATFORMS) as PlatformId[];

/**
 * Get platform by ID
 */
export function getPlatform(id: PlatformId): PlatformConfig {
  return PLATFORMS[id];
}

/**
 * Get platform display name from various formats
 */
export function normalizePlatformName(name: string): PlatformId | null {
  const normalized = name.toLowerCase().replace(/[\s\-_]/g, '');

  const mappings: Record<string, PlatformId> = {
    'polymarket': 'polymarket',
    'overtime': 'overtime',
    'overtimemarkets': 'overtime',
    'speedmarkets': 'speedmarkets',
    'speed': 'speedmarkets',
    'thales': 'speedmarkets',
    'limitless': 'limitless',
    'azuro': 'azuro',
    'azuroprotocol': 'azuro',
    'sxbet': 'sxbet',
    'sx': 'sxbet',
    'gnosis': 'gnosis',
    'omen': 'gnosis',
    'gnosisomen': 'gnosis',
    'drift': 'drift',
    'driftbet': 'drift',
    'kalshi': 'kalshi',
    'manifold': 'manifold',
    'manifoldmarkets': 'manifold',
    'metaculus': 'metaculus',
    'dreamdex': 'dreamdex',
    'dreamdexeventcontracts': 'dreamdex',
  };

  return mappings[normalized] || null;
}

/**
 * Platform icons lookup (for backwards compatibility)
 */
export const PLATFORM_ICONS: Record<string, string> = {
  'Polymarket': '🔮',
  'Overtime': '⚽',
  'Speed Markets': '⚡',
  'Limitless': '♾️',
  'Azuro': '🎯',
  'Azuro Protocol': '🎯',
  'SX Bet': '🎰',
  'Gnosis': '🦉',
  'Omen': '🦉',
  'Drift': '🌊',
  'Drift BET': '🌊',
  'Kalshi': '📊',
  'Manifold': '📈',
  'Manifold Markets': '📈',
  'Metaculus': '🔬',
  'DreamDEX': '💭',
  'DreamDEX Event Contracts': '💭',
};

/**
 * Platform chains lookup (for backwards compatibility)
 */
export const PLATFORM_CHAINS: Record<string, string> = {
  'Polymarket': 'Polygon',
  'Overtime': 'Optimism',
  'Speed Markets': 'Optimism',
  'Limitless': 'Base',
  'Azuro': 'Polygon',
  'Azuro Protocol': 'Polygon',
  'SX Bet': 'SX Network',
  'Gnosis': 'Gnosis',
  'Omen': 'Gnosis',
  'Drift': 'Solana',
  'Drift BET': 'Solana',
  'Kalshi': 'Hybrid',
  'Manifold': 'Off-chain',
  'Manifold Markets': 'Off-chain',
  'Metaculus': 'Off-chain',
  'DreamDEX': 'Somnia',
  'DreamDEX Event Contracts': 'Somnia',
};

/**
 * Get explorer URL for address
 */
export function getExplorerUrl(platformId: PlatformId, address: string): string | null {
  const platform = PLATFORMS[platformId];
  if (!platform.explorer) return null;
  return `${platform.explorer}${address}`;
}

/**
 * Get currency symbol for display
 */
export function getCurrencySymbol(platformId: PlatformId): string {
  const platform = PLATFORMS[platformId];
  switch (platform.currency) {
    case 'STT': return 'STT';
    case 'ETH': return 'Ξ';
    case 'USDC':
    case 'USD': return '$';
    case 'tUSDC': return 'tUSDC';
    case 'USDso': return 'USDso';
    case 'xDAI': return 'xDAI';
    case 'Mana': return 'M$';
    case 'Points': return 'pts';
    default: return platform.currency;
  }
}

/**
 * Check if platform uses USD-denominated values
 */
export function isUSDPlatform(platformId: PlatformId): boolean {
  const platform = PLATFORMS[platformId];
  return ['USDC', 'USD', 'xDAI'].includes(platform.currency);
}

/**
 * Check if platform uses ETH-denominated values
 */
export function isETHPlatform(platformId: PlatformId): boolean {
  const platform = PLATFORMS[platformId];
  return platform.currency === 'ETH';
}

/**
 * Check if platform uses STT-denominated values (Somnia)
 */
export function isSTTPlatform(platformId: PlatformId): boolean {
  const platform = PLATFORMS[platformId];
  return platform.currency === 'STT';
}
