/**
 * VeritasScore - Unified Scoring System for Prediction Market Traders
 *
 * A statistically-grounded scoring system that measures trader skill
 * while accounting for sample size uncertainty.
 *
 * Core Formula: VeritasScore = Edge × Confidence
 *
 * References:
 * - Wilson, E.B. (1927). "Probable Inference, the Law of Succession, and Statistical Inference"
 * - Agresti, A. & Coull, B.A. (1998). "Approximate is Better than 'Exact' for Interval Estimation"
 * - Brown, L.D., Cai, T.T., & DasGupta, A. (2001). "Interval Estimation for a Binomial Proportion"
 *
 * @module veritasscore
 * @version 2.0.0
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

export const VERITASSCORE_CONFIG = {
  // Minimum requirements for eligibility
  MIN_BETS_BINARY: 30,        // Binary markets (50/50)
  MIN_BETS_ODDS: 20,          // Odds-based markets
  MIN_VOLUME_ODDS: 1000,      // Minimum $1000 volume for odds markets

  // Wilson Score z-value (1.96 = 95% confidence interval)
  WILSON_Z: 1.96,

  // Score scaling
  MAX_EDGE_POINTS: 500,       // Maximum points from edge
  MAX_SCORE: 1000,            // Maximum base score (before recency bonus)
  MAX_TOTAL_SCORE: 1300,      // Maximum total score (base + recency bonus)

  // Confidence curve parameters
  CONFIDENCE_MIN: 0.5,        // Minimum confidence multiplier
  CONFIDENCE_SCALE: 200,      // Bets needed for ~87% confidence

  // ROI confidence for odds markets
  ROI_VARIANCE_ESTIMATE: 0.25, // Conservative variance assumption
  ROI_Z_SCORE: 1.5,           // 93% confidence level

  // Recency bonus parameters
  RECENCY_MAX_BONUS: 300,     // Maximum recency bonus points
  RECENCY_FULL_DAYS: 7,       // Full bonus if traded within 7 days
  RECENCY_DECAY_DAYS: 90,     // Bonus decays to 0 over 90 days
} as const;

// ============================================================================
// TYPES
// ============================================================================

export type MarketType = 'binary' | 'odds';

export interface VeritasScoreInput {
  // For binary markets
  wins?: number;
  losses?: number;
  totalBets?: number;

  // For odds-based markets
  pnl?: number;
  volume?: number;
  trades?: number;

  // Platform identification
  platform: string;

  // Recency tracking
  lastTradeAt?: Date | string | number;  // Timestamp of last trade
}

export interface VeritasScoreResult {
  score: number;             // Base score (0-1000)
  totalScore: number;        // Total score with recency bonus (0-1300)
  eligible: boolean;

  // Breakdown components
  edge: number;              // Percentage edge (0-50)
  edgePoints: number;        // Points from edge (0-500)
  confidence: number;        // Confidence level (50-100%)
  recencyBonus: number;      // Recency bonus points (0-300)

  // Raw metrics
  rawWinRate?: number;       // Actual win rate
  provenWinRate?: number;    // Wilson-adjusted win rate
  rawROI?: number;           // Actual ROI
  provenROI?: number;        // Confidence-bounded ROI

  // Meta
  marketType: MarketType;
  sampleSize: number;
  lastTradeAt?: Date;        // When the trader last traded
  daysSinceLastTrade?: number;
  reason?: string;
}

export interface ScoreBreakdown {
  skill: string;
  confidence: string;
  recency: string;
  explanation: string;
}

// ============================================================================
// PLATFORM CLASSIFICATION
// ============================================================================

/**
 * Binary markets have fixed 50/50 odds (up/down, yes/no at even money)
 * Win rate is the correct metric for these markets.
 */
const BINARY_PLATFORMS = [
  'speedmarkets',
  'speed markets',
  'thales',
  'dreamdex',
] as const;

/**
 * Odds-based markets have variable odds/probabilities
 * ROI is the correct metric because win rate is meaningless
 * (betting on -500 favorites wins 80%+ but loses money)
 */
const ODDS_PLATFORMS = [
  'polymarket',
  'overtime',
  'azuro',
  'sxbet',
  'sx bet',
  'limitless',
  'drift',
  'manifold',
  'kalshi',
  'metaculus',
  'gnosis',
  'omen',
] as const;

/**
 * Determine market type from platform name
 */
export function getMarketType(platform: string): MarketType {
  const normalized = platform.toLowerCase().replace(/[^a-z]/g, '');

  for (const binary of BINARY_PLATFORMS) {
    if (normalized.includes(binary.replace(/[^a-z]/g, ''))) {
      return 'binary';
    }
  }

  return 'odds';
}

// ============================================================================
// WILSON SCORE IMPLEMENTATION
// ============================================================================

/**
 * Wilson Score Lower Bound
 *
 * Calculates a conservative estimate of the true win rate given observed data.
 * This is the lower bound of the confidence interval, which means:
 * - Small samples get heavily penalized (3/3 wins → ~44%, not 100%)
 * - Large samples converge to the true rate (600/1000 wins → ~57%)
 *
 * Mathematical Foundation:
 * The Wilson score interval is derived from inverting the z-test for proportions.
 * Unlike the normal approximation (Wald interval), it:
 * - Never produces intervals outside [0,1]
 * - Has better coverage probability for small n
 * - Is recommended by statisticians for binary proportion estimation
 *
 * Formula:
 * Lower bound = (p + z²/2n - z√(p(1-p)/n + z²/4n²)) / (1 + z²/n)
 *
 * Where:
 * - p = observed proportion (wins/total)
 * - n = sample size (total bets)
 * - z = z-score for desired confidence (1.96 for 95%)
 *
 * @param wins - Number of successful predictions
 * @param total - Total number of predictions
 * @param z - Z-score for confidence level (default 1.96 = 95%)
 * @returns Lower bound of Wilson confidence interval
 *
 * @example
 * wilsonScoreLower(3, 3)      // → 0.438 (not 1.0!)
 * wilsonScoreLower(60, 100)   // → 0.502
 * wilsonScoreLower(600, 1000) // → 0.569
 */
export function wilsonScoreLower(
  wins: number,
  total: number,
  z: number = VERITASSCORE_CONFIG.WILSON_Z
): number {
  if (total === 0) return 0;
  if (wins < 0 || wins > total) return 0;

  const p = wins / total;
  const denominator = 1 + (z * z) / total;
  const center = p + (z * z) / (2 * total);
  const spread = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total);

  return Math.max(0, (center - spread) / denominator);
}

/**
 * Wilson Score Upper Bound (for reference)
 */
export function wilsonScoreUpper(
  wins: number,
  total: number,
  z: number = VERITASSCORE_CONFIG.WILSON_Z
): number {
  if (total === 0) return 0;

  const p = wins / total;
  const denominator = 1 + (z * z) / total;
  const center = p + (z * z) / (2 * total);
  const spread = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total);

  return Math.min(1, (center + spread) / denominator);
}

// ============================================================================
// CONFIDENCE CALCULATION
// ============================================================================

/**
 * Calculate confidence multiplier based on sample size
 *
 * Uses an exponential decay function that:
 * - Starts at 50% for minimum sample sizes
 * - Approaches 100% as sample size increases
 * - Has diminishing returns (100 → 200 bets matters more than 1000 → 1100)
 *
 * Formula: confidence = 0.5 + 0.5 × (1 - e^(-n/scale))
 *
 * Examples (with scale=200):
 * - 30 bets  → 57% confidence
 * - 100 bets → 70% confidence
 * - 200 bets → 82% confidence
 * - 500 bets → 96% confidence
 * - 1000 bets → 99% confidence
 *
 * @param sampleSize - Number of bets/trades
 * @returns Confidence multiplier between 0.5 and 1.0
 */
export function calculateConfidence(sampleSize: number): number {
  const { CONFIDENCE_MIN, CONFIDENCE_SCALE } = VERITASSCORE_CONFIG;

  if (sampleSize <= 0) return CONFIDENCE_MIN;

  const confidenceGain = 1 - Math.exp(-sampleSize / CONFIDENCE_SCALE);
  return CONFIDENCE_MIN + (1 - CONFIDENCE_MIN) * confidenceGain;
}

// ============================================================================
// ROI CONFIDENCE BOUNDS
// ============================================================================

/**
 * Calculate conservative ROI with confidence bounds
 *
 * For odds-based markets where we can't use win rate directly,
 * we use ROI (Return on Investment) as the skill metric.
 *
 * To account for variance in returns, we calculate:
 * Conservative ROI = Observed ROI - z × Standard Error
 *
 * This gives us a lower bound estimate that accounts for:
 * - Lucky streaks that inflate observed ROI
 * - Small sample sizes with high variance
 *
 * Standard Error approximation:
 * SE = √(variance / n) ≈ 0.5 / √n (assuming binary-ish outcomes)
 *
 * @param pnl - Profit and loss
 * @param volume - Total volume traded
 * @param trades - Number of trades
 * @returns Conservative ROI estimate
 */
export function calculateConservativeROI(
  pnl: number,
  volume: number,
  trades: number
): number {
  if (volume <= 0 || trades <= 0) return 0;

  const roi = pnl / volume;

  // Estimate standard error of ROI
  const { ROI_VARIANCE_ESTIMATE, ROI_Z_SCORE } = VERITASSCORE_CONFIG;
  const stdError = Math.sqrt(ROI_VARIANCE_ESTIMATE / trades);

  // Conservative ROI (lower bound)
  const conservativeROI = roi - (ROI_Z_SCORE * stdError);

  return conservativeROI;
}

// ============================================================================
// RECENCY BONUS CALCULATION
// ============================================================================

/**
 * Calculate recency bonus based on time since last trade
 *
 * Rewards active traders with up to 300 bonus points.
 * - Full bonus (300 pts) for trades within 7 days
 * - Linear decay from 300 → 0 over 7-90 days
 * - Zero bonus after 90 days of inactivity
 *
 * This prevents stale profiles from dominating leaderboards
 * and incentivizes continuous participation.
 *
 * @param lastTradeAt - Timestamp of last trade
 * @returns Recency bonus points (0-300)
 */
export function calculateRecencyBonus(lastTradeAt?: Date | string | number): {
  bonus: number;
  daysSince: number;
} {
  const { RECENCY_MAX_BONUS, RECENCY_FULL_DAYS, RECENCY_DECAY_DAYS } = VERITASSCORE_CONFIG;

  if (!lastTradeAt) {
    return { bonus: 0, daysSince: Infinity };
  }

  const lastTrade = new Date(lastTradeAt);
  const now = new Date();
  const daysSince = Math.floor((now.getTime() - lastTrade.getTime()) / (1000 * 60 * 60 * 24));

  // Full bonus if traded within RECENCY_FULL_DAYS
  if (daysSince <= RECENCY_FULL_DAYS) {
    return { bonus: RECENCY_MAX_BONUS, daysSince };
  }

  // No bonus after RECENCY_DECAY_DAYS
  if (daysSince >= RECENCY_DECAY_DAYS) {
    return { bonus: 0, daysSince };
  }

  // Linear decay between RECENCY_FULL_DAYS and RECENCY_DECAY_DAYS
  const decayRange = RECENCY_DECAY_DAYS - RECENCY_FULL_DAYS;
  const daysIntoDecay = daysSince - RECENCY_FULL_DAYS;
  const decayProgress = daysIntoDecay / decayRange;
  const bonus = Math.round(RECENCY_MAX_BONUS * (1 - decayProgress));

  return { bonus, daysSince };
}

// ============================================================================
// MAIN SCORING FUNCTIONS
// ============================================================================

/**
 * Calculate VeritasScore for Binary Markets
 *
 * Binary markets have 50/50 base odds (like coin flips).
 * Skill is measured as edge above 50%.
 *
 * Formula:
 * 1. provenWinRate = wilsonScoreLower(wins, total)
 * 2. edge = max(0, provenWinRate - 0.5)
 * 3. edgePoints = edge × 5000 (capped at 500)
 * 4. confidence = calculateConfidence(total)
 * 5. score = edgePoints × confidence × 2
 *
 * @param wins - Number of winning bets
 * @param total - Total number of bets
 * @param platform - Platform name
 */
export function scoreBinaryTrader(
  wins: number,
  total: number,
  platform: string,
  lastTradeAt?: Date | string | number
): VeritasScoreResult {
  const { MIN_BETS_BINARY, MAX_EDGE_POINTS, MAX_SCORE, MAX_TOTAL_SCORE } = VERITASSCORE_CONFIG;

  // Calculate recency bonus
  const { bonus: recencyBonus, daysSince: daysSinceLastTrade } = calculateRecencyBonus(lastTradeAt);

  // Eligibility check
  if (total < MIN_BETS_BINARY) {
    return {
      score: 0,
      totalScore: 0,
      eligible: false,
      edge: 0,
      edgePoints: 0,
      confidence: 0,
      recencyBonus: 0,
      rawWinRate: total > 0 ? wins / total : 0,
      provenWinRate: 0,
      marketType: 'binary',
      sampleSize: total,
      lastTradeAt: lastTradeAt ? new Date(lastTradeAt) : undefined,
      daysSinceLastTrade: daysSinceLastTrade === Infinity ? undefined : daysSinceLastTrade,
      reason: `Need ${MIN_BETS_BINARY}+ bets (have ${total})`,
    };
  }

  // Calculate proven win rate using Wilson Score
  const rawWinRate = wins / total;
  const provenWinRate = wilsonScoreLower(wins, total);

  // Edge = how much above 50% (coin flip baseline)
  const edge = Math.max(0, provenWinRate - 0.5);
  const edgePercent = edge * 100;

  // Convert edge to points (10% edge = 500 points max)
  const edgePoints = Math.min(MAX_EDGE_POINTS, Math.round(edge * 5000));

  // Confidence based on sample size
  const confidence = calculateConfidence(total);
  const confidencePercent = Math.round(confidence * 100);

  // Base score (capped at 1000)
  const score = Math.min(MAX_SCORE, Math.round(edgePoints * confidence * 2));

  // Total score with recency bonus (capped at 1300)
  const totalScore = Math.min(MAX_TOTAL_SCORE, score + recencyBonus);

  return {
    score,
    totalScore,
    eligible: true,
    edge: Math.round(edgePercent * 10) / 10,
    edgePoints,
    confidence: confidencePercent,
    recencyBonus,
    rawWinRate: Math.round(rawWinRate * 1000) / 10,
    provenWinRate: Math.round(provenWinRate * 1000) / 10,
    marketType: 'binary',
    sampleSize: total,
    lastTradeAt: lastTradeAt ? new Date(lastTradeAt) : undefined,
    daysSinceLastTrade: daysSinceLastTrade === Infinity ? undefined : daysSinceLastTrade,
  };
}

/**
 * Calculate VeritasScore for Odds-Based Markets
 *
 * Odds markets have variable probabilities, so win rate is meaningless.
 * A trader betting only on heavy favorites (-500) will "win" 80%+
 * but likely lose money overall.
 *
 * Instead, we use ROI (Return on Investment) as the skill metric.
 *
 * Formula:
 * 1. rawROI = pnl / volume
 * 2. provenROI = rawROI - z × stdError
 * 3. edge = max(0, provenROI)
 * 4. edgePoints = edge × 5000 (capped at 500)
 * 5. confidence = calculateConfidence(trades)
 * 6. score = edgePoints × confidence × 2
 *
 * @param pnl - Profit and loss
 * @param volume - Total volume traded
 * @param trades - Number of trades
 * @param platform - Platform name
 */
export function scoreOddsTrader(
  pnl: number,
  volume: number,
  trades: number,
  platform: string,
  lastTradeAt?: Date | string | number
): VeritasScoreResult {
  const { MIN_BETS_ODDS, MIN_VOLUME_ODDS, MAX_EDGE_POINTS, MAX_SCORE, MAX_TOTAL_SCORE } = VERITASSCORE_CONFIG;

  // Calculate recency bonus
  const { bonus: recencyBonus, daysSince: daysSinceLastTrade } = calculateRecencyBonus(lastTradeAt);

  // Eligibility checks
  if (trades < MIN_BETS_ODDS) {
    return {
      score: 0,
      totalScore: 0,
      eligible: false,
      edge: 0,
      edgePoints: 0,
      confidence: 0,
      recencyBonus: 0,
      rawROI: volume > 0 ? (pnl / volume) * 100 : 0,
      provenROI: 0,
      marketType: 'odds',
      sampleSize: trades,
      lastTradeAt: lastTradeAt ? new Date(lastTradeAt) : undefined,
      daysSinceLastTrade: daysSinceLastTrade === Infinity ? undefined : daysSinceLastTrade,
      reason: `Need ${MIN_BETS_ODDS}+ trades (have ${trades})`,
    };
  }

  if (volume < MIN_VOLUME_ODDS) {
    return {
      score: 0,
      totalScore: 0,
      eligible: false,
      edge: 0,
      edgePoints: 0,
      confidence: 0,
      recencyBonus: 0,
      rawROI: volume > 0 ? (pnl / volume) * 100 : 0,
      provenROI: 0,
      marketType: 'odds',
      sampleSize: trades,
      lastTradeAt: lastTradeAt ? new Date(lastTradeAt) : undefined,
      daysSinceLastTrade: daysSinceLastTrade === Infinity ? undefined : daysSinceLastTrade,
      reason: `Need $${MIN_VOLUME_ODDS}+ volume (have $${Math.round(volume)})`,
    };
  }

  // Calculate ROI
  const rawROI = pnl / volume;
  const provenROI = calculateConservativeROI(pnl, volume, trades);

  // Edge = positive proven ROI (negative = no edge)
  const edge = Math.max(0, provenROI);
  const edgePercent = edge * 100;

  // Convert edge to points (10% ROI edge = 500 points max)
  const edgePoints = Math.min(MAX_EDGE_POINTS, Math.round(edge * 5000));

  // Confidence based on sample size
  const confidence = calculateConfidence(trades);
  const confidencePercent = Math.round(confidence * 100);

  // Base score (capped at 1000)
  const score = Math.min(MAX_SCORE, Math.round(edgePoints * confidence * 2));

  // Total score with recency bonus (capped at 1300)
  const totalScore = Math.min(MAX_TOTAL_SCORE, score + recencyBonus);

  return {
    score,
    totalScore,
    eligible: true,
    edge: Math.round(edgePercent * 10) / 10,
    edgePoints,
    confidence: confidencePercent,
    recencyBonus,
    rawROI: Math.round(rawROI * 1000) / 10,
    provenROI: Math.round(provenROI * 1000) / 10,
    marketType: 'odds',
    sampleSize: trades,
    lastTradeAt: lastTradeAt ? new Date(lastTradeAt) : undefined,
    daysSinceLastTrade: daysSinceLastTrade === Infinity ? undefined : daysSinceLastTrade,
  };
}

// ============================================================================
// UNIFIED INTERFACE
// ============================================================================

/**
 * Calculate VeritasScore - Unified Entry Point
 *
 * Automatically detects market type and routes to appropriate scorer.
 *
 * @param input - Scoring input with platform and relevant metrics
 * @returns VeritasScore result with breakdown
 */
export function calculateVeritasScore(input: VeritasScoreInput): VeritasScoreResult {
  const marketType = getMarketType(input.platform);

  if (marketType === 'binary') {
    const wins = input.wins ?? 0;
    const total = input.totalBets ?? (wins + (input.losses ?? 0));
    return scoreBinaryTrader(wins, total, input.platform, input.lastTradeAt);
  }

  // Odds-based market
  const pnl = input.pnl ?? 0;
  const volume = input.volume ?? 0;
  const trades = input.trades ?? input.totalBets ?? 0;

  return scoreOddsTrader(pnl, volume, trades, input.platform, input.lastTradeAt);
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

/**
 * Get human-readable breakdown of score
 */
export function getScoreBreakdown(result: VeritasScoreResult): ScoreBreakdown {
  if (!result.eligible) {
    return {
      skill: 'Not eligible',
      confidence: 'N/A',
      recency: 'N/A',
      explanation: result.reason || 'Insufficient data',
    };
  }

  const edgeDescription = result.marketType === 'binary'
    ? `${result.edge}% above coin flip`
    : `${result.edge}% ROI`;

  let skillLevel: string;
  if (result.edge >= 10) skillLevel = 'Elite';
  else if (result.edge >= 7) skillLevel = 'Excellent';
  else if (result.edge >= 5) skillLevel = 'Strong';
  else if (result.edge >= 3) skillLevel = 'Good';
  else if (result.edge >= 1) skillLevel = 'Slight edge';
  else skillLevel = 'No proven edge';

  let confidenceLevel: string;
  if (result.confidence >= 95) confidenceLevel = 'Very high';
  else if (result.confidence >= 85) confidenceLevel = 'High';
  else if (result.confidence >= 70) confidenceLevel = 'Moderate';
  else if (result.confidence >= 55) confidenceLevel = 'Low';
  else confidenceLevel = 'Very low';

  // Recency description
  let recencyLevel: string;
  if (result.recencyBonus >= 250) recencyLevel = 'Very active';
  else if (result.recencyBonus >= 150) recencyLevel = 'Active';
  else if (result.recencyBonus >= 50) recencyLevel = 'Moderate';
  else if (result.recencyBonus > 0) recencyLevel = 'Low activity';
  else recencyLevel = 'Inactive';

  const daysText = result.daysSinceLastTrade !== undefined
    ? `${result.daysSinceLastTrade} days ago`
    : 'unknown';

  return {
    skill: `${skillLevel} (${edgeDescription})`,
    confidence: `${confidenceLevel} (${result.confidence}%, ${result.sampleSize} ${result.marketType === 'binary' ? 'bets' : 'trades'})`,
    recency: `${recencyLevel} (+${result.recencyBonus} pts, last trade ${daysText})`,
    explanation: `${skillLevel} performer with ${confidenceLevel.toLowerCase()} confidence. ${recencyLevel} trader with +${result.recencyBonus} recency bonus.`,
  };
}

/**
 * Get tier name from score (0-1300 scale)
 *
 * Tier thresholds aligned with contracts.ts:
 * - Diamond: 900+ (top performers with recency bonus)
 * - Platinum: 650-899
 * - Gold: 400-649
 * - Silver: 200-399
 * - Bronze: 0-199
 */
export function getScoreTier(score: number): string {
  if (score >= 1100) return 'Legendary';  // Diamond+ with max recency
  if (score >= 900) return 'Diamond';
  if (score >= 650) return 'Platinum';
  if (score >= 400) return 'Gold';
  if (score >= 200) return 'Silver';
  return 'Bronze';
}

/**
 * Get tier color class (0-1300 scale)
 */
export function getScoreTierColor(score: number): string {
  if (score >= 1100) return 'text-yellow-400'; // Legendary - Gold glow
  if (score >= 900) return 'text-cyan-400';    // Diamond - Cyan
  if (score >= 650) return 'text-purple-400';  // Platinum - Purple
  if (score >= 400) return 'text-yellow-500';  // Gold - Yellow
  if (score >= 200) return 'text-gray-400';    // Silver - Gray
  return 'text-amber-600';                     // Bronze - Amber
}

// ============================================================================
// LEGACY COMPATIBILITY
// ============================================================================

/**
 * Legacy scoring function for backwards compatibility
 * Maps old format to new VeritasScore system
 *
 * @deprecated Use calculateVeritasScore instead
 */
export function legacyCalculateScore(
  wins: number,
  total: number,
  volume: number,
  pnl: number = 0,
  platform: string = 'dreamdex',
  lastTradeAt?: Date | string | number
): number {
  const marketType = getMarketType(platform);

  if (marketType === 'binary') {
    return scoreBinaryTrader(wins, total, platform, lastTradeAt).totalScore;
  }

  return scoreOddsTrader(pnl, volume, total, platform, lastTradeAt).totalScore;
}
