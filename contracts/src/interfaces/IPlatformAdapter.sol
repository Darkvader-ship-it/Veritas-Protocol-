// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title IPlatformAdapter
 * @notice Standard interface for all prediction market platform adapters
 * @dev Implement this interface to connect any prediction market platform to Veritas
 * @author Veritas Team
 */
interface IPlatformAdapter {
    /**
     * @notice Struct containing prediction data from a platform
     * @param predictionId Unique identifier for the prediction on the source platform
     * @param predictor Address of the user who made the prediction
     * @param marketId Identifier of the market/round on the source platform
     * @param outcome The predicted outcome (platform-specific encoding)
     * @param amount Amount staked on this prediction (in wei)
     * @param timestamp When the prediction was made (block timestamp)
     * @param resolved Whether the market has been resolved
     * @param correct Whether the prediction was correct (only valid if resolved)
     */
    struct PredictionData {
        bytes32 predictionId;
        address predictor;
        bytes32 marketId;
        uint8 outcome;
        uint256 amount;
        uint256 timestamp;
        bool resolved;
        bool correct;
    }

    /**
     * @notice Struct containing aggregated user statistics from a platform
     * @param totalPredictions Total number of predictions made by the user
     * @param correctPredictions Number of correct predictions
     * @param totalVolume Total amount staked across all predictions (in wei)
     * @param activeMarkets Number of unresolved markets user is participating in
     */
    struct UserStats {
        uint256 totalPredictions;
        uint256 correctPredictions;
        uint256 totalVolume;
        uint256 activeMarkets;
    }

    /**
     * @notice Fetches prediction history for a specific user
     * @dev Should return all predictions, both resolved and unresolved
     * @param user Address of the user to fetch predictions for
     * @param startIndex Starting index for pagination (0-based)
     * @param count Maximum number of predictions to return
     * @return predictions Array of PredictionData structs
     * @return totalCount Total number of predictions available for this user
     */
    function fetchUserPredictions(address user, uint256 startIndex, uint256 count)
        external
        view
        returns (PredictionData[] memory predictions, uint256 totalCount);

    /**
     * @notice Gets aggregated statistics for a specific user
     * @dev Should efficiently calculate stats without fetching all predictions
     * @param user Address of the user to get statistics for
     * @return stats UserStats struct containing aggregated data
     */
    function getUserStats(address user) external view returns (UserStats memory stats);

    /**
     * @notice Returns the name of the platform this adapter connects to
     * @dev Used for display and identification purposes
     * @return Platform name (e.g., "DreamDEX")
     */
    function platformName() external view returns (string memory);

    /**
     * @notice Returns the address of the source platform contract
     * @dev Used to verify authenticity and enable direct contract calls
     * @return Address of the platform's main contract
     */
    function platformAddress() external view returns (address);

    /**
     * @notice Checks if a specific market has been resolved
     * @param marketId Identifier of the market to check
     * @return True if the market is resolved, false otherwise
     */
    function isMarketResolved(bytes32 marketId) external view returns (bool);

    /**
     * @notice Gets the winning outcome for a resolved market
     * @param marketId Identifier of the resolved market
     * @return The winning outcome (platform-specific encoding)
     * @dev Should revert if market is not resolved
     */
    function getMarketOutcome(bytes32 marketId) external view returns (uint8);

    /**
     * @notice Emitted when a new prediction is imported from the platform
     * @param user Address of the predictor
     * @param predictionId Unique identifier for the prediction
     * @param marketId Identifier of the market
     * @param amount Amount staked
     */
    event PredictionImported(
        address indexed user, bytes32 indexed predictionId, bytes32 indexed marketId, uint256 amount
    );

    /**
     * @notice Emitted when a market is resolved and predictions are updated
     * @param marketId Identifier of the resolved market
     * @param outcome The winning outcome
     * @param timestamp When the market was resolved
     */
    event MarketResolved(bytes32 indexed marketId, uint8 outcome, uint256 timestamp);
}
