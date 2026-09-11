/**
 * VeritasBOT Dashboard Types
 */

// API Response wrapper
export interface ApiResponse<T> {
  success: boolean
  data: T
  timestamp: string
  message?: string
}

// Platforms
export type Platform =
  | 'dreamdex'
  | 'polymarket'
  | 'azuro'
  | 'overtime'
  | 'limitless'
  | 'speedmarkets'
  | 'sxbet'
  | 'gnosis'
  | 'drift'
  | 'kalshi'
  | 'manifold'
  | 'metaculus'

export type Tier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND'

export type Consensus = 'BULL' | 'BEAR' | 'NEUTRAL'

export type CrossConsensus = 'STRONG_YES' | 'LEAN_YES' | 'MIXED' | 'LEAN_NO' | 'STRONG_NO'

export type SignalStrength = 'STRONG' | 'MODERATE' | 'WEAK'

// Smart Money Signal
export interface Signal {
  id?: number
  epoch: number
  platform: string
  consensus: Consensus
  confidence: number
  weightedBullPercent: number
  participatingTraders: number
  diamondTraderCount: number
  platinumTraderCount: number
  totalVolumeWei: string
  signalStrength: SignalStrength
  topTraderAgreement: number
  timestamp: string
  bets?: SignalBet[]
}

export interface SignalBet {
  trader: string
  tier: Tier
  amount: string
  isBull: boolean
  weight: number
}

// Trader
export interface Trader {
  address: string
  veritasScore: number
  tier: Tier
  totalBets: number
  wins: number
  losses: number
  winRate: number
  totalVolume: string
}

// Unified Trader (cross-platform)
export interface UnifiedTrader {
  id?: number
  primaryAddress: string
  displayName?: string
  unifiedScore: number
  overallRoi: number
  totalVolume: number
  totalBets: number
  wins: number
  losses: number
  winRate: number
  tier: Tier
  activePlatforms: Platform[]
  platformScores: PlatformScore[]
  lastActive?: string
}

export interface PlatformScore {
  platform: Platform
  score: number
  tier: Tier
  winRate: number
  volume: number
  totalBets?: number
  wins?: number
  losses?: number
  roi?: number
}

// Trending Topic
export interface TrendingTopic {
  id?: number
  topic: string
  normalizedTopic: string
  score: number
  velocity: number
  totalVolume: number
  totalMarkets: number
  category?: 'crypto' | 'sports' | 'events' | 'forecasting' | string
  platforms: PlatformPresence[]
  firstSeen?: string
  lastUpdated?: string
}

export interface PlatformPresence {
  platform: Platform
  marketCount: number
  volume: number
  topMarkets?: MarketSummary[]
}

export interface MarketSummary {
  id: string
  title: string
  probability: number
  volume: number
}

// Cross-Platform Signal
export interface CrossPlatformSignal {
  id?: number
  topic: string
  normalizedTopic: string
  consensus: CrossConsensus
  confidence: number
  volumeWeightedProbability: number
  smartMoneyAgreement: number
  platforms: PlatformSignal[]
  totalVolume: number
  marketCount: number
  createdAt?: string
  expiresAt?: string
}

export interface PlatformSignal {
  platform: Platform
  marketId: string
  marketTitle: string
  probability: number
  volume: number
}

// Platform Status
export interface PlatformStatus {
  platform: Platform
  status: 'ok' | 'error' | 'pending' | 'unknown'
  leaderboardCount: number
  marketsCount: number
  lastLeaderboardSync?: string
  lastMarketsSync?: string
  errorMessage?: string
  updatedAt?: string
}

// Backtest
export interface BacktestResult {
  totalReturn: number
  annualizedReturn: number
  maxDrawdown: number
  sharpeRatio: number
  totalTrades: number
  winningTrades: number
  losingTrades: number
  winRate: number
  profitFactor: number
  finalPortfolioValue: number
  trades?: BacktestTrade[]
}

export interface BacktestTrade {
  epoch: number
  timestamp: string
  portfolioValueAfter: number
  won: boolean
  pnl: number
}

// Alerts
export interface Alert {
  id: number
  type: 'WASH_TRADING' | 'SYBIL_ATTACK' | 'COLLUSION' | 'ANOMALY'
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  wallets: string[]
  status: 'pending' | 'dismissed' | 'confirmed'
  createdAt: string
  evidence?: object
}

export interface WalletAnalysis {
  address: string
  riskScore: number
  patterns: {
    washTradingScore: number
    sybilScore: number
    anomalyScore: number
    collusionScore: number
  }
  transactionCount?: number
  uniqueCounterparties?: number
}

// Cascade Prevention
export interface CopyEligibility {
  allowed: boolean
  reason: string
  copyDepth: number
  isCopyTrader: boolean
}

export interface CopyStatus {
  isCopyTrader: boolean
  copyDepth: number
  originalSource: string | null
  followedBy: string[]
  following: string[]
}

export interface CopyChainNode {
  address: string
  depth: number
  tier?: Tier
  score?: number
}

// Health
export interface HealthStatus {
  status: 'ok' | 'error'
  timestamp: string
  bots: {
    smartMoney?: object
    antiGaming?: object
  }
}

// Filter/Sort options
export type TrendSortOption = 'score' | 'volume' | 'markets' | 'velocity'
export type LeaderboardSortOption = 'score' | 'winRate' | 'volume' | 'roi'
export type TrendCategory = 'all' | 'crypto' | 'sports' | 'events' | 'forecasting'
