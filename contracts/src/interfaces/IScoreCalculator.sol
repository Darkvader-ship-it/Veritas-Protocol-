// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title IScoreCalculator
 * @notice Interface for VeritasScore calculation engine
 * @dev Implements the reputation algorithm for the Veritas protocol
 * @author Veritas Team
 */
interface IScoreCalculator {
    /**
     * @notice Enum representing reputation tiers based on VeritasScore
     * @dev Tiers determine user benefits and platform privileges (0-1300 scale)
     */
    enum Tier {
        BRONZE, // 0-199
        SILVER, // 200-399
        GOLD, // 400-649
        PLATINUM, // 650-899
        DIAMOND // 900+ (with recency bonus up to 1300)
    }

    /**
     * @notice Struct containing breakdown of score components
     * @param baseScore Score from win rate component
     * @param volumeMultiplier Multiplier from total volume staked
     * @param consistencyBonus Bonus for sustained performance
     * @param finalScore Total calculated VeritasScore
     */
    struct ScoreBreakdown {
        uint256 baseScore;
        uint256 volumeMultiplier;
        uint256 consistencyBonus;
        uint256 finalScore;
    }

    // ========================================
    // Core Calculation Functions
    // ========================================

    /**
     * @notice Calculates the VeritasScore for a user
     * @dev Formula: (winRate × 100) × sqrt(totalVolume) / 100
     * @param totalPredictions Total number of predictions made
     * @param correctPredictions Number of correct predictions
     * @param totalVolume Total amount staked in wei
     * @return score The calculated VeritasScore
     */
    function calculateVeritasScore(uint256 totalPredictions, uint256 correctPredictions, uint256 totalVolume)
        external
        pure
        returns (uint256 score);

    /**
     * @notice Calculates VeritasScore with detailed component breakdown
     * @param totalPredictions Total number of predictions made
     * @param correctPredictions Number of correct predictions
     * @param totalVolume Total amount staked in wei
     * @return breakdown ScoreBreakdown struct with component details
     */
    function calculateScoreWithBreakdown(uint256 totalPredictions, uint256 correctPredictions, uint256 totalVolume)
        external
        pure
        returns (ScoreBreakdown memory breakdown);

    /**
     * @notice Calculates win rate as a percentage with two decimal precision
     * @param totalPredictions Total number of predictions
     * @param correctPredictions Number of correct predictions
     * @return winRate Win rate (0-10000, where 7550 = 75.50%)
     */
    function calculateWinRate(uint256 totalPredictions, uint256 correctPredictions)
        external
        pure
        returns (uint256 winRate);

    // ========================================
    // Tier Functions
    // ========================================

    /**
     * @notice Determines the reputation tier based on VeritasScore
     * @param score The VeritasScore to evaluate
     * @return tier The corresponding reputation tier
     */
    function getTier(uint256 score) external pure returns (Tier tier);

    /**
     * @notice Gets the minimum score required for a specific tier
     * @param tier The tier to query
     * @return minScore Minimum VeritasScore for this tier
     */
    function getTierThreshold(Tier tier) external pure returns (uint256 minScore);

    /**
     * @notice Gets the score required for the next tier
     * @param currentScore Current VeritasScore
     * @return nextTierScore Score needed for next tier (0 if max tier)
     * @return pointsNeeded Points needed to reach next tier
     */
    function getNextTierRequirement(uint256 currentScore)
        external
        pure
        returns (uint256 nextTierScore, uint256 pointsNeeded);

    /**
     * @notice Gets the name of a tier
     * @param tier The tier to query
     * @return name String name of the tier (e.g., "GOLD")
     */
    function getTierName(Tier tier) external pure returns (string memory name);

    // ========================================
    // Helper Functions
    // ========================================

    /**
     * @notice Calculates square root for volume scaling
     * @dev Used in VeritasScore formula for diminishing returns on volume
     * @param x Number to calculate square root of
     * @return y Square root of x
     */
    function sqrt(uint256 x) external pure returns (uint256 y);

    /**
     * @notice Converts wei to native token (STT/tUSDC scaled) for display
     * @param weiAmount Amount in wei
     * @return sttAmount Amount in native units (kept alias for compat)
     */
    function weiToStt(uint256 weiAmount) external pure returns (uint256 sttAmount);
    function weiToNative(uint256 weiAmount) external pure returns (uint256 amount);

    // ========================================
    // Validation Functions
    // ========================================

    /**
     * @notice Validates that prediction data is consistent
     * @param totalPredictions Total predictions claimed
     * @param correctPredictions Correct predictions claimed
     * @return isValid True if data is valid (correct <= total)
     */
    function validatePredictionData(uint256 totalPredictions, uint256 correctPredictions)
        external
        pure
        returns (bool isValid);

    /**
     * @notice Calculates the maximum possible score for given parameters
     * @param totalVolume Total volume in wei
     * @return maxScore Maximum achievable score (100% win rate)
     */
    function getMaxPossibleScore(uint256 totalVolume) external pure returns (uint256 maxScore);

    // ========================================
    // Events
    // ========================================

    /**
     * @notice Emitted when a score is calculated (for analytics)
     * @param totalPredictions Number of predictions used in calculation
     * @param correctPredictions Number of correct predictions
     * @param totalVolume Volume used in calculation
     * @param score Resulting VeritasScore
     */
    event ScoreCalculated(uint256 totalPredictions, uint256 correctPredictions, uint256 totalVolume, uint256 score);

    // ========================================
    // Errors
    // ========================================

    /**
     * @notice Error thrown when correct predictions exceeds total predictions
     */
    error InvalidPredictionData(uint256 total, uint256 correct);

    /**
     * @notice Error thrown when attempting to calculate score with zero predictions
     */
    error NoPredictions();
}
