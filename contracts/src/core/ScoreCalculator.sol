// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IScoreCalculator} from "../interfaces/IScoreCalculator.sol";

/**
 * @title ScoreCalculator
 * @notice Calculates VeritasScore for prediction market participants
 * @dev Implements the core reputation algorithm: VeritasScore = (winRate × 100) × sqrt(totalVolume) / 100
 * @author Veritas Team
 */
contract ScoreCalculator is IScoreCalculator {
    // Tier thresholds — aligned to ReputationNFT + frontend/lib/veritasScore.ts 0/200/400/650/900
    uint256 private constant BRONZE_THRESHOLD = 0;
    uint256 private constant SILVER_THRESHOLD = 200;
    uint256 private constant GOLD_THRESHOLD = 400;
    uint256 private constant PLATINUM_THRESHOLD = 650;
    uint256 private constant DIAMOND_THRESHOLD = 900;

    /**
     * @notice Calculates the VeritasScore for a user
     * @dev Formula: (winRate × 100) × sqrt(totalVolume) / 100
     *      Where winRate = (correctPredictions / totalPredictions) × 100
     * @param totalPredictions Total number of predictions made
     * @param correctPredictions Number of correct predictions
     * @param totalVolume Total amount staked in wei
     * @return score The calculated VeritasScore
     */
    function calculateVeritasScore(uint256 totalPredictions, uint256 correctPredictions, uint256 totalVolume)
        external
        pure
        override
        returns (uint256 score)
    {
        // Validate input
        if (totalPredictions == 0) {
            revert NoPredictions();
        }
        if (correctPredictions > totalPredictions) {
            revert InvalidPredictionData(totalPredictions, correctPredictions);
        }

        // Calculate win rate (0-10000, representing 0.00% to 100.00%)
        uint256 winRate = (correctPredictions * 10000) / totalPredictions;

        // Convert totalVolume from wei to native points (divide by 1e16 to get centi-token scale)
        // This gives us reasonable numbers: 1 STT/tUSDC (scaled) = 100 points
        uint256 volumePoints = totalVolume / 1e16;

        // Calculate: (winRate × 100) × sqrt(volumePoints) / 100
        // The × 100 / 100 normalizes the winRate scale
        uint256 volumeSqrt = sqrt(volumePoints);
        score = (winRate * volumeSqrt) / 100;

        return score;
    }

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
        override
        returns (ScoreBreakdown memory breakdown)
    {
        // Validate input
        if (totalPredictions == 0) {
            revert NoPredictions();
        }
        if (correctPredictions > totalPredictions) {
            revert InvalidPredictionData(totalPredictions, correctPredictions);
        }

        // Calculate win rate
        uint256 winRate = (correctPredictions * 10000) / totalPredictions;
        breakdown.baseScore = winRate; // Store raw win rate

        // Calculate volume component
        uint256 volumePoints = totalVolume / 1e16;
        breakdown.volumeMultiplier = sqrt(volumePoints);

        // Consistency bonus (not implemented in MVP - reserved for future)
        breakdown.consistencyBonus = 0;

        // Calculate final score
        breakdown.finalScore = (winRate * breakdown.volumeMultiplier) / 100;

        return breakdown;
    }

    /**
     * @notice Calculates win rate as a percentage with two decimal precision
     * @param totalPredictions Total number of predictions
     * @param correctPredictions Number of correct predictions
     * @return winRate Win rate (0-10000, where 7550 = 75.50%)
     */
    function calculateWinRate(uint256 totalPredictions, uint256 correctPredictions)
        external
        pure
        override
        returns (uint256 winRate)
    {
        if (totalPredictions == 0) {
            revert NoPredictions();
        }
        if (correctPredictions > totalPredictions) {
            revert InvalidPredictionData(totalPredictions, correctPredictions);
        }

        winRate = (correctPredictions * 10000) / totalPredictions;
        return winRate;
    }

    /**
     * @notice Determines the reputation tier based on VeritasScore
     * @param score The VeritasScore to evaluate
     * @return tier The corresponding reputation tier
     */
    function getTier(uint256 score) external pure override returns (Tier tier) {
        if (score >= DIAMOND_THRESHOLD) {
            return Tier.DIAMOND;
        } else if (score >= PLATINUM_THRESHOLD) {
            return Tier.PLATINUM;
        } else if (score >= GOLD_THRESHOLD) {
            return Tier.GOLD;
        } else if (score >= SILVER_THRESHOLD) {
            return Tier.SILVER;
        } else {
            return Tier.BRONZE;
        }
    }

    /**
     * @notice Gets the minimum score required for a specific tier
     * @param tier The tier to query
     * @return minScore Minimum VeritasScore for this tier
     */
    function getTierThreshold(Tier tier) external pure override returns (uint256 minScore) {
        if (tier == Tier.DIAMOND) {
            return DIAMOND_THRESHOLD;
        } else if (tier == Tier.PLATINUM) {
            return PLATINUM_THRESHOLD;
        } else if (tier == Tier.GOLD) {
            return GOLD_THRESHOLD;
        } else if (tier == Tier.SILVER) {
            return SILVER_THRESHOLD;
        } else {
            return BRONZE_THRESHOLD;
        }
    }

    /**
     * @notice Gets the score required for the next tier
     * @param currentScore Current VeritasScore
     * @return nextTierScore Score needed for next tier (0 if max tier)
     * @return pointsNeeded Points needed to reach next tier
     */
    function getNextTierRequirement(uint256 currentScore)
        external
        pure
        override
        returns (uint256 nextTierScore, uint256 pointsNeeded)
    {
        if (currentScore >= DIAMOND_THRESHOLD) {
            return (0, 0); // Already at max tier
        } else if (currentScore >= PLATINUM_THRESHOLD) {
            nextTierScore = DIAMOND_THRESHOLD;
        } else if (currentScore >= GOLD_THRESHOLD) {
            nextTierScore = PLATINUM_THRESHOLD;
        } else if (currentScore >= SILVER_THRESHOLD) {
            nextTierScore = GOLD_THRESHOLD;
        } else {
            nextTierScore = SILVER_THRESHOLD;
        }

        pointsNeeded = nextTierScore - currentScore;
        return (nextTierScore, pointsNeeded);
    }

    /**
     * @notice Gets the name of a tier
     * @param tier The tier to query
     * @return name String name of the tier (e.g., "GOLD")
     */
    function getTierName(Tier tier) external pure override returns (string memory name) {
        if (tier == Tier.DIAMOND) {
            return "DIAMOND";
        } else if (tier == Tier.PLATINUM) {
            return "PLATINUM";
        } else if (tier == Tier.GOLD) {
            return "GOLD";
        } else if (tier == Tier.SILVER) {
            return "SILVER";
        } else {
            return "BRONZE";
        }
    }

    /**
     * @notice Calculates square root for volume scaling
     * @dev Uses Babylonian method for gas-efficient square root calculation
     * @param x Number to calculate square root of
     * @return y Square root of x
     */
    function sqrt(uint256 x) public pure override returns (uint256 y) {
        if (x == 0) return 0;
        if (x <= 3) return 1;

        // Initial guess
        uint256 z = x;
        y = (x + 1) / 2;

        // Babylonian method (Newton's method)
        while (y < z) {
            z = y;
            y = (x / y + y) / 2;
        }

        return z;
    }

    /**
     * @notice Converts wei to native token (STT/tUSDC scaled) for display
     * @param weiAmount Amount in wei
     * @return sttAmount Amount in native units (kept alias for compat)
     */
    function weiToStt(uint256 weiAmount) external pure override returns (uint256 sttAmount) {
        return weiAmount / 1e18;
    }

    /**
     * @notice Converts wei to native token for display
     * @param weiAmount Amount in wei
     * @return amount Amount in native units (18dec)
     */
    function weiToNative(uint256 weiAmount) external pure returns (uint256 amount) {
        return weiAmount / 1e18;
    }

    /**
     * @notice Validates that prediction data is consistent
     * @param totalPredictions Total predictions claimed
     * @param correctPredictions Correct predictions claimed
     * @return isValid True if data is valid (correct <= total)
     */
    function validatePredictionData(uint256 totalPredictions, uint256 correctPredictions)
        external
        pure
        override
        returns (bool isValid)
    {
        return correctPredictions <= totalPredictions;
    }

    /**
     * @notice Calculates the maximum possible score for given parameters
     * @param totalVolume Total volume in wei
     * @return maxScore Maximum achievable score (100% win rate)
     */
    function getMaxPossibleScore(uint256 totalVolume) external pure override returns (uint256 maxScore) {
        // Max win rate is 10000 (100.00%)
        uint256 volumePoints = totalVolume / 1e16;
        uint256 volumeSqrt = sqrt(volumePoints);
        maxScore = (10000 * volumeSqrt) / 100;
        return maxScore;
    }
}
