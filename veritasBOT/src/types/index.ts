/**
 * VeritasBOT Type Definitions
 * Central type definitions for all bot components
 */

// ===========================================
// Platform Types
// ===========================================

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
  | 'metaculus';

// All platforms list for iteration
export const ALL_PLATFORMS: Platform[] = [
  'dreamdex',
  'polymarket',
  'azuro',
  'overtime',
  'limitless',
  'speedmarkets',
  'sxbet',
  'gnosis',
  'drift',
  'kalshi',
  'manifold',
  'metaculus',
];

// Platform categories
export type PlatformCategory = 'crypto' | 'sports' | 'events' | 'forecasting';

export const PLATFORM_CATEGORIES: Record<Platform, PlatformCategory> = {
  dreamdex: 'crypto',
  polymarket: 'events',
  azuro: 'sports',
  overtime: 'sports',
  limitless: 'crypto',
  speedmarkets: 'crypto',
  sxbet: 'sports',
  gnosis: 'events',
  drift: 'crypto',
  kalshi: 'events',
  manifold: 'events',
  metaculus: 'forecasting',
};

export type Tier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND';

export const TIER_WEIGHTS: Record<Tier, number> = {
  DIAMOND: 5,
  PLATINUM: 3,
  GOLD: 2,
  SILVER: 1.5,
  BRONZE: 1,
};

// ===========================================
// Trader Types
// ===========================================

export interface Trader {
  address: string;
  veritasScore: number;
  tier: Tier;
  totalBets: number;
  wins: number;
  losses: number;
  winRate: number;
  totalVolume: string; // wei as string
  registeredAt: Date;
  lastActiveAt: Date;
}

export interface TraderStats {
  address: string;
  platform: Platform;
  totalBets: number;
  wins: number;
  losses: number;
  winRate: number;
  totalVolume: string;
  avgBetSize: string;
  profitLoss: string;
  roi: number;
  sharpeRatio: number;
  maxDrawdown: number;
  streakCurrent: number;
  streakBest: number;
  streakWorst: number;
}

// ===========================================
// Bet Types
// ===========================================

export interface Bet {
  id: string;
  trader: string;
  platform: Platform;
  epoch: number;
  amount: string; // wei as string
  isBull: boolean;
  timestamp: Date;
  transactionHash?: string;
  blockNumber?: number;
}

export interface BetOutcome extends Bet {
  won: boolean;
  payout: string;
  resolvedAt: Date;
}

export interface RoundInfo {
  epoch: number;
  platform: Platform;
  startTimestamp: number;
  lockTimestamp: number;
  closeTimestamp: number;
  lockPrice?: string;
  closePrice?: string;
  totalAmount: string;
  bullAmount: string;
  bearAmount: string;
  bullWins?: boolean;
  oracleCalled: boolean;
}

// ===========================================
// Smart Money Signal Types
// ===========================================

export type SignalStrength = 'STRONG' | 'MODERATE' | 'WEAK';
export type Consensus = 'BULL' | 'BEAR' | 'NEUTRAL';

export interface SmartMoneySignal {
  id?: number;
  epoch: number;
  platform: Platform;
  consensus: Consensus;
  confidence: number; // 0-100
  weightedBullPercent: number;
  participatingTraders: number;
  diamondTraderCount: number;
  platinumTraderCount: number;
  totalVolumeWei: string;
  signalStrength: SignalStrength;
  topTraderAgreement: number; // % of Diamond+Platinum agreeing
  timestamp: Date;
  bets: SignalBet[];
}

export interface SignalBet {
  trader: string;
  tier: Tier;
  amount: string;
  isBull: boolean;
  weight: number;
}

// ===========================================
// Backtesting Types
// ===========================================

export interface BacktestSettings {
  leader: string;
  startDate: Date;
  endDate: Date;
  initialCapital: number; // in STT
  allocationPercent: number; // 0-1
  maxBetSize: number; // in STT
  stopLossPercent?: number; // optional stop loss
  compounding: boolean; // reinvest profits
}

export interface BacktestTrade {
  epoch: number;
  timestamp: Date;
  leaderBet: {
    amount: string;
    isBull: boolean;
  };
  copyAmount: number;
  won: boolean;
  pnl: number;
  portfolioValueAfter: number;
}

export interface BacktestResult {
  settings: BacktestSettings;
  trades: BacktestTrade[];

  // Performance metrics
  totalReturn: number;
  annualizedReturn: number;
  maxDrawdown: number;
  maxDrawdownDate: Date;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;

  // Trade stats
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  expectancy: number;

  // Time analysis
  monthlyReturns: MonthlyReturn[];
  bestMonth: MonthlyReturn;
  worstMonth: MonthlyReturn;
  profitableMonths: number;

  // Comparison
  vsBuyAndHold: number;
  vsMarketAverage: number;

  // Final state
  finalPortfolioValue: number;
  totalPnL: number;
}

export interface MonthlyReturn {
  month: string; // YYYY-MM
  return: number;
  trades: number;
  winRate: number;
}

// ===========================================
// Anti-Gaming Types
// ===========================================

export type AlertType = 'WASH_TRADING' | 'SYBIL_CLUSTER' | 'STATISTICAL_ANOMALY' | 'COLLUSION' | 'TIMING_MANIPULATION';
export type AlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO';
export type AlertStatus = 'pending' | 'investigating' | 'confirmed' | 'dismissed';
export type RecommendedAction = 'FLAG' | 'PAUSE' | 'BAN' | 'INVESTIGATE' | 'MONITOR';

export interface GamingAlert {
  id?: number;
  type: AlertType;
  severity: AlertSeverity;
  wallets: string[];
  evidence: GamingEvidence;
  recommendedAction: RecommendedAction;
  status: AlertStatus;
  createdAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  notes?: string;
}

export interface GamingEvidence {
  description: string;
  dataPoints: Record<string, unknown>;
  epochs?: number[];
  transactions?: string[];
  statisticalScore?: number;
  clusterSize?: number;
}

export interface WalletAnalysis {
  address: string;
  riskScore: number; // 0-100
  alerts: GamingAlert[];
  patterns: {
    washTradingScore: number;
    sybilScore: number;
    anomalyScore: number;
    collusionScore: number;
  };
  relatedWallets: string[];
  analysisTimestamp: Date;
}

// ===========================================
// Portfolio Types
// ===========================================

export interface PortfolioAllocation {
  leader: string;
  allocationPercent: number;
  maxBetSize: number;
  active: boolean;
}

export interface PortfolioState {
  totalValue: number;
  allocations: PortfolioAllocation[];
  performance: {
    totalReturn: number;
    todayReturn: number;
    weekReturn: number;
    monthReturn: number;
  };
  lastRebalanced: Date;
}

export interface PortfolioRecommendation {
  action: 'INCREASE' | 'DECREASE' | 'ADD' | 'REMOVE' | 'HOLD';
  leader: string;
  currentAllocation: number;
  recommendedAllocation: number;
  reason: string;
  confidence: number;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  metrics: {
    recentWinRate: number;
    historicalWinRate: number;
    correlationWithPortfolio: number;
    sharpeRatio: number;
    performanceDecay: number;
  };
}

export interface CorrelationMatrix {
  leaders: string[];
  matrix: number[][]; // correlation coefficients
  highCorrelationPairs: Array<{
    leader1: string;
    leader2: string;
    correlation: number;
  }>;
}

// ===========================================
// Copy Trading Types
// ===========================================

export interface CopyTradeConfig {
  leader: string;
  allocationBps: number; // basis points (10000 = 100%)
  maxBetSize: string; // wei
  active: boolean;
  stopLossPercent?: number;
  gasLimitGwei?: number;
}

export interface CopyTradeExecution {
  id: string;
  follower: string;
  leader: string;
  epoch: number;
  leaderAmount: string;
  copyAmount: string;
  isBull: boolean;
  status: 'pending' | 'submitted' | 'confirmed' | 'failed';
  transactionHash?: string;
  gasUsed?: string;
  error?: string;
  timestamp: Date;
}

// ===========================================
// API Types
// ===========================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

// ===========================================
// Event Types
// ===========================================

export interface BotEvent {
  type: string;
  payload: unknown;
  timestamp: Date;
}

export interface BetDetectedEvent extends BotEvent {
  type: 'BET_DETECTED';
  payload: Bet;
}

export interface SignalGeneratedEvent extends BotEvent {
  type: 'SIGNAL_GENERATED';
  payload: SmartMoneySignal;
}

export interface AlertCreatedEvent extends BotEvent {
  type: 'ALERT_CREATED';
  payload: GamingAlert;
}

export interface CopyTradeExecutedEvent extends BotEvent {
  type: 'COPY_TRADE_EXECUTED';
  payload: CopyTradeExecution;
}

export type AnyBotEvent =
  | BetDetectedEvent
  | SignalGeneratedEvent
  | AlertCreatedEvent
  | CopyTradeExecutedEvent
  | TrendDetectedEvent
  | TrendUpdatedEvent
  | CrossSignalEvent
  | SmartMoneyMoveEvent;

// ===========================================
// Configuration Types
// ===========================================

export interface PlatformConfig {
  name: string;
  chainId: number;
  predictionContract?: string;
  apiUrl?: string;
  subgraphUrl?: string;
  roundDuration?: number;
  bufferSeconds?: number;
  platformFee: number;
  minBetAmount: string;
  currency: string;
  explorerUrl: string;
}

export interface BotConfig {
  // Feature flags
  enableSmartMoney: boolean;
  enableBacktesting: boolean;
  enableAntiGaming: boolean;
  enablePortfolioOptimizer: boolean;
  enableCopyExecution: boolean;

  // Smart Money
  signalMinTraders: number;
  signalMinVolumeStt: number;

  // Anti-Gaming
  gamingCheckIntervalMs: number;
  washTradingThreshold: number;

  // Backtesting
  backtestCacheTtlHours: number;
  backtestMaxHistoryDays: number;

  // Performance
  pollIntervalMs: number;
  wsReconnectDelayMs: number;
}

// ===========================================
// Utility Types
// ===========================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type EventHandler<T extends BotEvent> = (event: T) => void | Promise<void>;

export interface Logger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, error?: Error, data?: Record<string, unknown>): void;
}

// ===========================================
// Multi-Platform Types
// ===========================================

// Platform presence in a topic
export interface PlatformPresence {
  platform: Platform;
  marketCount: number;
  volume: number;
  topMarkets: MarketSummary[];
}

export interface MarketSummary {
  id: string;
  title: string;
  probability: number;
  volume: number;
}

// Trending topics
export interface TrendingTopic {
  id?: number;
  topic: string;
  normalizedTopic: string;
  score: number;
  velocity: number;
  totalVolume: number;
  totalMarkets: number;
  category?: string;
  platforms: PlatformPresence[];
  firstSeen: Date;
  lastUpdated: Date;
}

// Cross-platform signals
export type CrossConsensus = 'STRONG_YES' | 'LEAN_YES' | 'MIXED' | 'LEAN_NO' | 'STRONG_NO';

export interface PlatformSignal {
  platform: Platform;
  marketId: string;
  marketTitle: string;
  probability: number;
  volume: number;
  topTradersBullish: number;
  confidence: number;
}

export interface CrossPlatformSignal {
  id?: number;
  topic: string;
  normalizedTopic: string;
  consensus: CrossConsensus;
  confidence: number;
  volumeWeightedProbability: number;
  smartMoneyAgreement: number;
  platforms: PlatformSignal[];
  totalVolume: number;
  marketCount: number;
  createdAt: Date;
  expiresAt?: Date;
}

// Unified trader profiles
export interface PlatformScore {
  platform: Platform;
  score: number;
  tier: Tier;
  totalBets: number;
  wins: number;
  losses: number;
  winRate: number;
  volume: number;
  roi: number;
  lastActive: Date;
}

export interface UnifiedTrader {
  id?: number;
  primaryAddress: string;
  displayName?: string;
  unifiedScore: number;
  overallRoi: number;
  totalVolume: number;
  totalBets: number;
  wins: number;
  losses: number;
  winRate: number;
  tier: Tier;
  platformScores: PlatformScore[];
  activePlatforms: Platform[];
  lastActive: Date;
  createdAt: Date;
}

// Smart money activity
export interface SmartMoneyActivity {
  id?: number;
  traderAddress: string;
  traderName?: string;
  platform: Platform;
  marketId: string;
  marketTitle?: string;
  topic?: string;
  direction: 'yes' | 'no' | 'bull' | 'bear';
  amount: number;
  probability?: number;
  traderTier?: Tier;
  traderScore?: number;
  timestamp: Date;
}

// Platform sync status
export interface PlatformSyncStatus {
  platform: Platform;
  lastLeaderboardSync?: Date;
  lastMarketsSync?: Date;
  leaderboardCount: number;
  marketsCount: number;
  status: 'ok' | 'error' | 'pending' | 'unknown';
  errorMessage?: string;
  updatedAt: Date;
}

// Topic-market mapping
export interface TopicMarket {
  topicId: number;
  platform: Platform;
  marketId: string;
  marketTitle?: string;
  probability?: number;
  volume: number;
  relevanceScore: number;
}

// ===========================================
// Multi-Platform Event Types
// ===========================================

export interface TrendDetectedEvent extends BotEvent {
  type: 'TREND_DETECTED';
  payload: TrendingTopic;
}

export interface TrendUpdatedEvent extends BotEvent {
  type: 'TREND_UPDATED';
  payload: TrendingTopic;
}

export interface CrossSignalEvent extends BotEvent {
  type: 'CROSS_SIGNAL';
  payload: CrossPlatformSignal;
}

export interface SmartMoneyMoveEvent extends BotEvent {
  type: 'SMART_MONEY_MOVE';
  payload: SmartMoneyActivity;
}
