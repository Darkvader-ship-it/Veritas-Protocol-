// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IPlatformAdapter} from "./IPlatformAdapter.sol";

/**
 * @title IVeritasCore
 * @notice Main protocol interface for Veritas reputation system
 * @dev Central contract that coordinates platform adapters, score calculation, and NFT minting
 * @author Veritas Team
 */
interface IVeritasCore {
    /**
     * @notice Struct representing a user's profile in the Veritas system
     * @param nftTokenId Token ID of the user's reputation NFT (0 if not minted)
     * @param veritasScore Current calculated VeritasScore
     * @param totalPredictions Aggregate count across all connected platforms
     * @param correctPredictions Aggregate count of correct predictions
     * @param totalVolume Total volume staked across all platforms (in wei)
     * @param connectedPlatforms Array of platform adapter addresses user has connected
     * @param lastUpdate Timestamp of last profile update
     * @param isActive Whether the profile is active
     */
    struct UserProfile {
        uint256 nftTokenId;
        uint256 veritasScore;
        uint256 totalPredictions;
        uint256 correctPredictions;
        uint256 totalVolume;
        address[] connectedPlatforms;
        uint256 lastUpdate;
        bool isActive;
    }

    /**
     * @notice Struct representing platform connection status
     * @param adapter Address of the platform adapter contract
     * @param isConnected Whether the platform is currently connected
     * @param lastSync Timestamp of last data synchronization
     * @param predictionCount Number of predictions imported from this platform
     */
    struct PlatformConnection {
        address adapter;
        bool isConnected;
        uint256 lastSync;
        uint256 predictionCount;
    }

    // ========================================
    // User Profile Management
    // ========================================

    /**
     * @notice Creates a new user profile and mints reputation NFT
     * @dev Can only be called once per address
     * @return nftTokenId The token ID of the newly minted reputation NFT
     */
    function createProfile() external returns (uint256 nftTokenId);

    /**
     * @notice Gets the complete profile for a user
     * @param user Address of the user
     * @return profile UserProfile struct containing all user data
     */
    function getUserProfile(address user) external view returns (UserProfile memory profile);

    /**
     * @notice Checks if a user has an active profile
     * @param user Address to check
     * @return True if user has an active profile
     */
    function hasProfile(address user) external view returns (bool);

    // ========================================
    // Platform Connection Management
    // ========================================

    /**
     * @notice Connects a user to a prediction market platform
     * @dev Imports initial prediction data and updates VeritasScore
     * @param platformAdapter Address of the platform adapter to connect
     * @return success True if connection was successful
     */
    function connectPlatform(address platformAdapter) external returns (bool success);

    /**
     * @notice Disconnects a user from a platform
     * @dev Does not delete historical data, only prevents future syncs
     * @param platformAdapter Address of the platform adapter to disconnect
     */
    function disconnectPlatform(address platformAdapter) external;

    /**
     * @notice Gets platform connection status for a user
     * @param user Address of the user
     * @param platformAdapter Address of the platform adapter
     * @return connection PlatformConnection struct
     */
    function getPlatformConnection(address user, address platformAdapter)
        external
        view
        returns (PlatformConnection memory connection);

    /**
     * @notice Gets all platforms a user is connected to
     * @param user Address of the user
     * @return platforms Array of platform adapter addresses
     */
    function getUserPlatforms(address user) external view returns (address[] memory platforms);

    // ========================================
    // Score Updates and Synchronization
    // ========================================

    /**
     * @notice Manually triggers a profile update by syncing all connected platforms
     * @dev Fetches latest data from all connected platforms and recalculates VeritasScore
     * @return newScore The updated VeritasScore
     */
    function updateProfile() external returns (uint256 newScore);

    /**
     * @notice Updates a specific user's profile (admin/keeper function)
     * @param user Address of the user to update
     * @return newScore The updated VeritasScore
     */
    function updateUserProfile(address user) external returns (uint256 newScore);

    /**
     * @notice Syncs data from a specific platform for the caller
     * @param platformAdapter Address of the platform to sync
     * @return predictionsImported Number of new predictions imported
     */
    function syncPlatform(address platformAdapter) external returns (uint256 predictionsImported);

    // ========================================
    // Platform Adapter Registry
    // ========================================

    /**
     * @notice Registers a new platform adapter (admin only)
     * @param adapter Address of the adapter contract
     * @param platformName Name of the platform
     */
    function registerAdapter(address adapter, string memory platformName) external;

    /**
     * @notice Unregisters a platform adapter (admin only)
     * @param adapter Address of the adapter to remove
     */
    function unregisterAdapter(address adapter) external;

    /**
     * @notice Checks if an adapter is registered
     * @param adapter Address to check
     * @return True if adapter is registered
     */
    function isAdapterRegistered(address adapter) external view returns (bool);

    /**
     * @notice Gets all registered adapters
     * @return adapters Array of registered adapter addresses
     */
    function getRegisteredAdapters() external view returns (address[] memory adapters);

    // ========================================
    // Leaderboard Queries
    // ========================================

    /**
     * @notice Gets top users by VeritasScore
     * @param count Number of users to return
     * @return users Array of addresses sorted by score (descending)
     * @return scores Array of corresponding VeritasScores
     */
    function getTopUsers(uint256 count) external view returns (address[] memory users, uint256[] memory scores);

    /**
     * @notice Gets a user's rank on the global leaderboard
     * @param user Address of the user
     * @return rank User's rank (1-based, 0 if not ranked)
     */
    function getUserRank(address user) external view returns (uint256 rank);

    // ========================================
    // Events
    // ========================================

    /**
     * @notice Emitted when a new user profile is created
     * @param user Address of the user
     * @param nftTokenId Token ID of minted reputation NFT
     */
    event ProfileCreated(address indexed user, uint256 indexed nftTokenId);

    /**
     * @notice Emitted when a user connects to a platform
     * @param user Address of the user
     * @param platform Address of the platform adapter
     * @param platformName Name of the platform
     */
    event PlatformConnected(address indexed user, address indexed platform, string platformName);

    /**
     * @notice Emitted when a user disconnects from a platform
     * @param user Address of the user
     * @param platform Address of the platform adapter
     */
    event PlatformDisconnected(address indexed user, address indexed platform);

    /**
     * @notice Emitted when a user's profile is updated
     * @param user Address of the user
     * @param oldScore Previous VeritasScore
     * @param newScore Updated VeritasScore
     * @param totalPredictions Updated prediction count
     */
    event ProfileUpdated(address indexed user, uint256 oldScore, uint256 newScore, uint256 totalPredictions);

    /**
     * @notice Emitted when a new platform adapter is registered
     * @param adapter Address of the adapter
     * @param platformName Name of the platform
     */
    event AdapterRegistered(address indexed adapter, string platformName);

    /**
     * @notice Emitted when a platform adapter is unregistered
     * @param adapter Address of the adapter
     */
    event AdapterUnregistered(address indexed adapter);

    /**
     * @notice Emitted when predictions are synced from a platform
     * @param user Address of the user
     * @param platform Address of the platform adapter
     * @param predictionsImported Number of predictions imported
     */
    event PlatformSynced(address indexed user, address indexed platform, uint256 predictionsImported);
}
