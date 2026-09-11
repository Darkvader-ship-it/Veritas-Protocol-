/**
 * VeritasScore Calculation Module
 *
 * Implements robust prediction scoring with:
 * - Wilson Score Interval (fixes small sample size exploit)
 * - Minimum sample size requirements
 * - Stake-weighted metrics
 * - Account maturity factor
 * - Consistency bonus (Sharpe-like)
 *
 * Max Score: 1300 (matching Polymarket range)
 */

// Configuration
export const SCORING_CONFIG = {
  MAX_SCORE: 1300,

  // Minimum requirements
  MIN_BETS_FOR_LEADERBOARD: 10,    // Minimum bets to appear on leaderboard
  MIN_BETS_FOR_FULL_SCORE: 50,     // Bets needed for 100% score multiplier

  // Account maturity
  MATURITY_DAYS: 14,               // Days for full maturity bonus

  // Component weights
  SKILL_MAX: 500,
  ACTIVITY_MAX: 500,
  VOLUME_MAX: 200,
  CONSISTENCY_MAX: 100,

  // Wilson Score confidence level (1.96 = 95% confidence)
  WILSON_Z: 1.96,
};

/**
 * Calculate Wilson Score Lower Bound
 * This gives a conservative estimate of true win rate accounting for sample size
 *
 * With 3/3 wins: raw = 100%, Wilson = 43.8%
 * With 650/1000 wins: raw = 65%, Wilson = 62.1%
 *
 * @param {number} wins - Number of wins
 * @param {number} total - Total number of bets
 * @param {number} z - Z-score for confidence level (default 1.96 = 95%)
 * @returns {number} Lower bound of confidence interval (0-1)
 */
export function wilsonScoreLower(wins, total, z = SCORING_CONFIG.WILSON_Z) {
  if (total === 0) return 0;

  const p = wins / total;
  const denominator = 1 + (z * z) / total;
  const center = p + (z * z) / (2 * total);
  const spread = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total);

  return Math.max(0, (center - spread) / denominator);
}

/**
 * Calculate sample size confidence multiplier
 * Scales score based on number of bets (0-1)
 *
 * @param {number} totalBets - Total number of bets
 * @returns {number} Multiplier (0-1)
 */
export function getSampleSizeMultiplier(totalBets) {
  if (totalBets < SCORING_CONFIG.MIN_BETS_FOR_LEADERBOARD) {
    return 0; // Don't show on leaderboard
  }
  return Math.min(1, totalBets / SCORING_CONFIG.MIN_BETS_FOR_FULL_SCORE);
}

/**
 * Calculate account maturity multiplier
 * Newer accounts get reduced scores to prevent farming
 *
 * @param {Date|number} firstBetTimestamp - Timestamp of first bet
 * @returns {number} Multiplier (0-1)
 */
export function getMaturityMultiplier(firstBetTimestamp) {
  if (!firstBetTimestamp) return 0.5; // Default for unknown

  const firstBetDate = new Date(firstBetTimestamp);
  const now = new Date();
  const ageDays = (now - firstBetDate) / (1000 * 60 * 60 * 24);

  return Math.min(1, 0.5 + (ageDays / SCORING_CONFIG.MATURITY_DAYS) * 0.5);
}

/**
 * Calculate consistency score (Sharpe-like metric)
 * Rewards consistent performance, penalizes lucky streaks
 *
 * @param {Array<{won: boolean, amount: string}>} bets - Array of bet objects
 * @returns {number} Consistency bonus (0-100)
 */
export function calculateConsistencyBonus(bets) {
  if (!bets || bets.length < 10) return 0;

  // Calculate returns per bet (+1 for win, -1 for loss)
  const returns = bets.map(b => b.won ? 1 : -1);

  // Calculate mean return
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;

  // Calculate standard deviation
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  // Sharpe-like ratio (higher mean, lower variance = better)
  // stdDev ranges from 0 (all same result) to 1 (50/50 random)
  // A consistent winner has high mean and low stdDev

  if (stdDev === 0) {
    // Perfect consistency (all wins or all losses)
    return mean > 0 ? SCORING_CONFIG.CONSISTENCY_MAX : 0;
  }

  // Sharpe ratio: mean / stdDev
  // For a 60% win rate: mean = 0.2, stdDev ≈ 0.98, sharpe ≈ 0.2
  // For a 70% win rate: mean = 0.4, stdDev ≈ 0.92, sharpe ≈ 0.43
  // For a 80% win rate: mean = 0.6, stdDev ≈ 0.8, sharpe ≈ 0.75
  const sharpe = mean / stdDev;

  // Scale to 0-100, with sharpe > 0.5 getting full bonus
  return Math.min(SCORING_CONFIG.CONSISTENCY_MAX, Math.max(0, Math.floor(sharpe * 200)));
}

/**
 * Calculate stake-weighted win rate
 * Weights wins by bet amount to prevent small-bet gaming
 *
 * @param {Array<{won: boolean, amount: string}>} bets - Array of bet objects
 * @returns {number} Stake-weighted win rate (0-1)
 */
export function calculateStakeWeightedWinRate(bets) {
  if (!bets || bets.length === 0) return 0;

  let totalStake = 0n;
  let winningStake = 0n;

  for (const bet of bets) {
    const amount = BigInt(bet.amount || '0');
    totalStake += amount;
    if (bet.won) {
      winningStake += amount;
    }
  }

  if (totalStake === 0n) return 0;

  return Number(winningStake) / Number(totalStake);
}

/**
 * Calculate VeritasScore for DreamDEX Event Contracts
 *
 * @param {Object} params - Scoring parameters
 * @param {number} params.wins - Number of wins
 * @param {number} params.totalBets - Total number of bets
 * @param {string} params.volume - Total volume in wei
 * @param {Array} params.bets - Array of bet objects (for consistency)
 * @param {Date|number} params.firstBetAt - Timestamp of first bet
 * @returns {Object} Score breakdown
 */
export function calculateDreamDEXScore({ wins, totalBets, volume, bets = [], firstBetAt = null }) {
  // Check minimum requirements
  if (totalBets < SCORING_CONFIG.MIN_BETS_FOR_LEADERBOARD) {
    return {
      score: 0,
      skillScore: 0,
      activityScore: 0,
      volumeBonus: 0,
      consistencyBonus: 0,
      sampleMultiplier: 0,
      maturityMultiplier: 0,
      rawWinRate: totalBets > 0 ? (wins / totalBets) * 100 : 0,
      adjustedWinRate: 0,
      eligible: false,
      reason: `Minimum ${SCORING_CONFIG.MIN_BETS_FOR_LEADERBOARD} bets required`,
    };
  }

  // Calculate Wilson Score adjusted win rate
  const rawWinRate = wins / totalBets;
  const adjustedWinRate = wilsonScoreLower(wins, totalBets);

  // Skill Score: Based on Wilson-adjusted win rate (0-500)
  // Baseline is 50% (random chance in binary prediction)
  const skillScore = Math.min(
    SCORING_CONFIG.SKILL_MAX,
    Math.max(0, Math.floor((adjustedWinRate - 0.5) * 1000))
  );

  // Activity Score: Logarithmic based on wins (0-500)
  // log10(10) = 1, log10(100) = 2, log10(1000) = 3
  const activityScore = wins > 0
    ? Math.min(SCORING_CONFIG.ACTIVITY_MAX, Math.floor(Math.log10(wins) * 166))
    : 0;

  // Volume Bonus: Logarithmic based on volume in STT (0-200)
  // Reduced from 300 to make room for consistency bonus
  const volumeSTT = Number(volume) / 1e18;
  const volumeBonus = volumeSTT >= 1
    ? Math.min(SCORING_CONFIG.VOLUME_MAX, Math.floor(Math.log10(volumeSTT) * 100))
    : 0;

  // Consistency Bonus: Rewards steady performance (0-100)
  const consistencyBonus = calculateConsistencyBonus(bets);

  // Sample size multiplier (0-1)
  const sampleMultiplier = getSampleSizeMultiplier(totalBets);

  // Account maturity multiplier (0.5-1)
  const maturityMultiplier = getMaturityMultiplier(firstBetAt);

  // Calculate raw score
  const rawScore = skillScore + activityScore + volumeBonus + consistencyBonus;

  // Apply multipliers
  const adjustedScore = Math.floor(rawScore * sampleMultiplier * maturityMultiplier);

  // Cap at max score
  const finalScore = Math.min(SCORING_CONFIG.MAX_SCORE, adjustedScore);

  return {
    score: finalScore,
    skillScore,
    activityScore,
    volumeBonus,
    consistencyBonus,
    sampleMultiplier: Math.round(sampleMultiplier * 100) / 100,
    maturityMultiplier: Math.round(maturityMultiplier * 100) / 100,
    rawWinRate: Math.round(rawWinRate * 10000) / 100,
    adjustedWinRate: Math.round(adjustedWinRate * 10000) / 100,
    eligible: true,
  };
}

/**
 * Calculate VeritasScore for Polymarket
 *
 * @param {Object} params - Scoring parameters
 * @param {number} params.pnl - Profit/Loss in USD
 * @param {number} params.volume - Total volume in USD
 * @param {number} params.estimatedTrades - Estimated number of trades (optional)
 * @returns {Object} Score breakdown
 */
export function calculatePolymarketScore({ pnl, volume, estimatedTrades = null }) {
  if (volume <= 0) {
    return {
      score: 0,
      skillScore: 0,
      activityScore: 0,
      profitBonus: 0,
      roi: 0,
      eligible: false,
      reason: 'No trading volume',
    };
  }

  // Calculate ROI
  const roi = pnl / volume;

  // Skill Score: Based on ROI (0-500)
  // 50% ROI = 500 points (capped)
  // Negative ROI = 0 points
  const skillScore = Math.min(
    SCORING_CONFIG.SKILL_MAX,
    Math.max(0, Math.floor(roi * 1000))
  );

  // Activity Score: Logarithmic based on volume (0-500)
  // $1000 = 195, $10000 = 260, $100000 = 325, $1000000 = 390
  const activityScore = Math.min(
    SCORING_CONFIG.ACTIVITY_MAX,
    Math.max(0, Math.floor(Math.log10(volume) * 65))
  );

  // Profit Bonus: Logarithmic based on absolute profit (0-200)
  // Only for profitable traders
  const profitBonus = pnl > 0
    ? Math.min(SCORING_CONFIG.VOLUME_MAX, Math.floor(Math.log10(pnl) * 50))
    : 0;

  // Sample size adjustment for Polymarket
  // Use volume as proxy for number of trades
  // Assume average trade size of $100-$500
  const estimatedBets = estimatedTrades || Math.floor(volume / 250);
  const sampleMultiplier = getSampleSizeMultiplier(estimatedBets);

  // Calculate raw score
  const rawScore = skillScore + activityScore + profitBonus;

  // Apply sample size multiplier
  const adjustedScore = Math.floor(rawScore * sampleMultiplier);

  // Cap at max score
  const finalScore = Math.min(SCORING_CONFIG.MAX_SCORE, adjustedScore);

  return {
    score: finalScore,
    skillScore,
    activityScore,
    profitBonus,
    sampleMultiplier: Math.round(sampleMultiplier * 100) / 100,
    roi: Math.round(roi * 10000) / 100,
    eligible: true,
  };
}

/**
 * Simplified score calculation for live indexer (without full bet history)
 * Used when we only have aggregate stats
 *
 * @param {Object} params - Scoring parameters
 * @param {number} params.wins - Number of wins
 * @param {number} params.totalBets - Total number of bets
 * @param {string} params.volume - Total volume in wei
 * @returns {number} VeritasScore
 */
export function calculateSimpleScore({ wins, totalBets, volume }) {
  if (totalBets < SCORING_CONFIG.MIN_BETS_FOR_LEADERBOARD) {
    return 0;
  }

  // Wilson Score adjusted win rate
  const adjustedWinRate = wilsonScoreLower(wins, totalBets);

  // Skill Score
  const skillScore = Math.min(
    SCORING_CONFIG.SKILL_MAX,
    Math.max(0, Math.floor((adjustedWinRate - 0.5) * 1000))
  );

  // Activity Score
  const activityScore = wins > 0
    ? Math.min(SCORING_CONFIG.ACTIVITY_MAX, Math.floor(Math.log10(wins) * 166))
    : 0;

  // Volume Bonus
  const volumeSTT = Number(volume) / 1e18;
  const volumeBonus = volumeSTT >= 1
    ? Math.min(SCORING_CONFIG.VOLUME_MAX, Math.floor(Math.log10(volumeSTT) * 100))
    : 0;

  // Sample size multiplier
  const sampleMultiplier = getSampleSizeMultiplier(totalBets);

  // Calculate and cap score
  const rawScore = skillScore + activityScore + volumeBonus;
  const adjustedScore = Math.floor(rawScore * sampleMultiplier);

  return Math.min(SCORING_CONFIG.MAX_SCORE, adjustedScore);
}

// For CommonJS compatibility
export default {
  SCORING_CONFIG,
  wilsonScoreLower,
  getSampleSizeMultiplier,
  getMaturityMultiplier,
  calculateConsistencyBonus,
  calculateStakeWeightedWinRate,
  calculateDreamDEXScore,
  calculatePolymarketScore,
  calculateSimpleScore,
};
