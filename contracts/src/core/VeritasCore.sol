// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ReputationNFT} from "./ReputationNFT.sol";
import {ScoreCalculator} from "./ScoreCalculator.sol";
import {PlatformRegistry} from "./PlatformRegistry.sol";

/**
 * @title VeritasCore
 * @notice Main protocol contract that orchestrates the Veritas reputation system
 * @dev Coordinates ReputationNFT, ScoreCalculator, and PlatformRegistry
 * @author Veritas Team
 */
contract VeritasCore is Ownable, Pausable, ReentrancyGuard {
    // ============================================
    // State Variables
    // ============================================

    ReputationNFT public immutable reputationNFT;
    ScoreCalculator public immutable scoreCalculator;
    PlatformRegistry public immutable platformRegistry;

    /**
     * @notice Struct representing a user's profile
     * @param reputationNFTId Token ID of the user's reputation NFT
     * @param veritasScore Current calculated VeritasScore
     * @param totalPredictions Total predictions across all platforms
     * @param correctPredictions Total correct predictions
     * @param totalVolume Total volume staked in wei
     * @param connectedPlatforms Array of platform IDs user has connected
     * @param createdAt Timestamp when profile was created
     * @param lastUpdate Timestamp of last profile update
     */
    struct UserProfile {
        uint256 reputationNFTId;
        uint256 veritasScore;
        uint256 totalPredictions;
        uint256 correctPredictions;
        uint256 totalVolume;
        uint256[] connectedPlatforms;
        uint256 createdAt;
        uint256 lastUpdate;
    }

    // Mapping from user address to profile
    mapping(address => UserProfile) public profiles;

    // Mapping to track imported prediction batches (prevents double-imports)
    mapping(bytes32 => bool) public importedBatches;

    // Mapping to track last import time per user (rate limiting)
    mapping(address => uint256) public lastImportTime;

    // Rate limit duration (1 hour)
    uint256 public constant IMPORT_RATE_LIMIT = 1 hours;

    // Revenue Model: Minting fee (0.0005 STT = gas on Somnia Shannon)
    uint256 public constant MINT_FEE = 0.0005 ether;

    // Total fees collected (for transparency)
    uint256 public totalFeesCollected;

    // ============================================
    // Events
    // ============================================

    event UserRegistered(address indexed user, uint256 indexed nftTokenId, uint256 timestamp);
    event PlatformConnected(address indexed user, uint256 indexed platformId, string platformName);
    event PredictionsImported(address indexed user, uint256 indexed platformId, uint256 count, bytes32 batchHash);
    event VeritasScoreUpdated(address indexed user, uint256 oldScore, uint256 newScore);
    event ProfileUpdated(address indexed user, uint256 veritasScore, uint256 totalPredictions);
    event FeeCollected(address indexed user, uint256 amount, string feeType);
    event FeesWithdrawn(address indexed owner, uint256 amount);

    // ============================================
    // Errors
    // ============================================

    error AlreadyRegistered(address user);
    error NotRegistered(address user);
    error PlatformNotActive(uint256 platformId);
    error PlatformAlreadyConnected(uint256 platformId);
    error PlatformNotConnected(uint256 platformId);
    error BatchAlreadyImported(bytes32 batchHash);
    error RateLimitExceeded(uint256 timeRemaining);
    error InvalidPredictionData();
    error NoPlatformsConnected();
    error InsufficientFee(uint256 required, uint256 sent);

    // ============================================
    // Constructor
    // ============================================

    constructor(address _reputationNFT, address _scoreCalculator, address _platformRegistry) Ownable(msg.sender) {
        reputationNFT = ReputationNFT(_reputationNFT);
        scoreCalculator = ScoreCalculator(_scoreCalculator);
        platformRegistry = PlatformRegistry(_platformRegistry);
    }

    // ============================================
    // User Registration
    // ============================================

    /**
     * @notice Registers a new user and mints their reputation NFT
     * @dev Can only be called once per address, requires MINT_FEE payment
     * @return nftTokenId The token ID of the minted reputation NFT
     */
    function registerUser() external payable whenNotPaused nonReentrant returns (uint256 nftTokenId) {
        // Check minting fee
        if (msg.value < MINT_FEE) {
            revert InsufficientFee(MINT_FEE, msg.value);
        }

        // Check if user is already registered
        if (profiles[msg.sender].createdAt != 0) {
            revert AlreadyRegistered(msg.sender);
        }

        // Track collected fees
        totalFeesCollected += msg.value;
        emit FeeCollected(msg.sender, msg.value, "MINT");

        // Mint reputation NFT
        nftTokenId = reputationNFT.mint(msg.sender);

        // Create user profile
        profiles[msg.sender] = UserProfile({
            reputationNFTId: nftTokenId,
            veritasScore: 0,
            totalPredictions: 0,
            correctPredictions: 0,
            totalVolume: 0,
            connectedPlatforms: new uint256[](0),
            createdAt: block.timestamp,
            lastUpdate: block.timestamp
        });

        emit UserRegistered(msg.sender, nftTokenId, block.timestamp);

        // Refund excess payment
        if (msg.value > MINT_FEE) {
            payable(msg.sender).transfer(msg.value - MINT_FEE);
        }

        return nftTokenId;
    }

    /**
     * @notice Checks if a user is registered
     * @param user Address to check
     * @return True if user is registered
     */
    function hasRegistered(address user) external view returns (bool) {
        return profiles[user].createdAt != 0;
    }

    // ============================================
    // Platform Connection
    // ============================================

    /**
     * @notice Connects a user to a prediction market platform
     * @param platformId ID of the platform to connect
     */
    function connectPlatform(uint256 platformId) external whenNotPaused nonReentrant {
        // Check if user is registered
        if (profiles[msg.sender].createdAt == 0) {
            revert NotRegistered(msg.sender);
        }

        // Check if platform is active
        if (!platformRegistry.isPlatformActive(platformId)) {
            revert PlatformNotActive(platformId);
        }

        // Check if platform is already connected
        uint256[] memory connected = profiles[msg.sender].connectedPlatforms;
        for (uint256 i = 0; i < connected.length; i++) {
            if (connected[i] == platformId) {
                revert PlatformAlreadyConnected(platformId);
            }
        }

        // Add platform to user's connected platforms
        profiles[msg.sender].connectedPlatforms.push(platformId);

        // Get platform name for event
        PlatformRegistry.Platform memory platform = platformRegistry.getPlatform(platformId);

        emit PlatformConnected(msg.sender, platformId, platform.name);
    }

    /**
     * @notice Checks if a user has connected a specific platform
     * @param user Address of the user
     * @param platformId ID of the platform
     * @return True if platform is connected
     */
    function isPlatformConnected(address user, uint256 platformId) public view returns (bool) {
        uint256[] memory connected = profiles[user].connectedPlatforms;
        for (uint256 i = 0; i < connected.length; i++) {
            if (connected[i] == platformId) {
                return true;
            }
        }
        return false;
    }

    // ============================================
    // Prediction Import
    // ============================================

    /**
     * @notice Imports predictions from a connected platform
     * @dev Includes rate limiting and double-import prevention
     * @param platformId ID of the platform
     * @param totalPredictions Total predictions to import
     * @param correctPredictions Correct predictions to import
     * @param totalVolume Total volume in wei
     * @param proof Proof/batch identifier (hash of prediction data)
     */
    function importPredictions(
        uint256 platformId,
        uint256 totalPredictions,
        uint256 correctPredictions,
        uint256 totalVolume,
        bytes32 proof
    ) external whenNotPaused nonReentrant {
        // Check if user is registered
        if (profiles[msg.sender].createdAt == 0) {
            revert NotRegistered(msg.sender);
        }

        // Check if platform is connected
        if (!isPlatformConnected(msg.sender, platformId)) {
            revert PlatformNotConnected(platformId);
        }

        // Check rate limit (skip if first import)
        if (lastImportTime[msg.sender] != 0 && block.timestamp < lastImportTime[msg.sender] + IMPORT_RATE_LIMIT) {
            uint256 timeRemaining = (lastImportTime[msg.sender] + IMPORT_RATE_LIMIT) - block.timestamp;
            revert RateLimitExceeded(timeRemaining);
        }

        // Check if batch already imported
        if (importedBatches[proof]) {
            revert BatchAlreadyImported(proof);
        }

        // Validate prediction data
        if (correctPredictions > totalPredictions) {
            revert InvalidPredictionData();
        }

        // Mark batch as imported
        importedBatches[proof] = true;

        // Update last import time
        lastImportTime[msg.sender] = block.timestamp;

        // Update user profile
        UserProfile storage profile = profiles[msg.sender];
        profile.totalPredictions += totalPredictions;
        profile.correctPredictions += correctPredictions;
        profile.totalVolume += totalVolume;
        profile.lastUpdate = block.timestamp;

        emit PredictionsImported(msg.sender, platformId, totalPredictions, proof);

        // Auto-update VeritasScore
        _updateVeritasScore(msg.sender);
    }

    // ============================================
    // Score Update
    // ============================================

    /**
     * @notice Updates a user's VeritasScore and reputation NFT
     * @param user Address of the user to update
     */
    function updateVeritasScore(address user) external whenNotPaused {
        // Check if user is registered
        if (profiles[user].createdAt == 0) {
            revert NotRegistered(user);
        }

        _updateVeritasScore(user);
    }

    /**
     * @dev Internal function to update VeritasScore
     */
    function _updateVeritasScore(address user) internal {
        UserProfile storage profile = profiles[user];

        // Skip if no predictions
        if (profile.totalPredictions == 0) {
            return;
        }

        uint256 oldScore = profile.veritasScore;

        // Calculate new VeritasScore
        uint256 newScore = scoreCalculator.calculateVeritasScore(
            profile.totalPredictions, profile.correctPredictions, profile.totalVolume
        );

        profile.veritasScore = newScore;
        profile.lastUpdate = block.timestamp;

        // Update reputation NFT metadata
        string[] memory platformNames = _getPlatformNames(profile.connectedPlatforms);

        reputationNFT.updateMetadata(
            profile.reputationNFTId,
            newScore,
            profile.totalPredictions,
            profile.correctPredictions,
            profile.totalVolume,
            platformNames
        );

        emit VeritasScoreUpdated(user, oldScore, newScore);
        emit ProfileUpdated(user, newScore, profile.totalPredictions);
    }

    // ============================================
    // Profile Queries
    // ============================================

    /**
     * @notice Gets a user's complete profile
     * @param user Address of the user
     * @return profile UserProfile struct
     */
    function getUserProfile(address user) external view returns (UserProfile memory profile) {
        return profiles[user];
    }

    /**
     * @notice Gets a user's connected platforms
     * @param user Address of the user
     * @return platformIds Array of platform IDs
     */
    function getConnectedPlatforms(address user) external view returns (uint256[] memory platformIds) {
        return profiles[user].connectedPlatforms;
    }

    /**
     * @notice Gets the number of connected platforms for a user
     * @param user Address of the user
     * @return count Number of connected platforms
     */
    function getConnectedPlatformCount(address user) external view returns (uint256 count) {
        return profiles[user].connectedPlatforms.length;
    }

    /**
     * @notice Gets a user's win rate (in basis points)
     * @param user Address of the user
     * @return winRate Win rate (0-10000, where 7550 = 75.50%)
     */
    function getWinRate(address user) external view returns (uint256 winRate) {
        UserProfile memory profile = profiles[user];

        if (profile.totalPredictions == 0) {
            return 0;
        }

        return (profile.correctPredictions * 10000) / profile.totalPredictions;
    }

    // ============================================
    // Admin Functions
    // ============================================

    /**
     * @notice Pauses the contract
     * @dev Can only be called by owner
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpauses the contract
     * @dev Can only be called by owner
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Emergency function to update a user's score (admin only)
     * @param user Address of the user
     */
    function adminUpdateScore(address user) external onlyOwner {
        if (profiles[user].createdAt == 0) {
            revert NotRegistered(user);
        }
        _updateVeritasScore(user);
    }

    /**
     * @notice Withdraw collected fees (owner only)
     * @dev Transfers all accumulated fees to contract owner
     */
    function withdrawFees() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees to withdraw");

        emit FeesWithdrawn(owner(), balance);

        (bool success,) = payable(owner()).call{value: balance}("");
        require(success, "Transfer failed");
    }

    /**
     * @notice Get current contract balance (accumulated fees)
     * @return balance Current balance in wei
     */
    function getContractBalance() external view returns (uint256 balance) {
        return address(this).balance;
    }

    // ============================================
    // Internal Helper Functions
    // ============================================

    /**
     * @dev Gets platform names from platform IDs
     */
    function _getPlatformNames(uint256[] memory platformIds) internal view returns (string[] memory names) {
        names = new string[](platformIds.length);

        for (uint256 i = 0; i < platformIds.length; i++) {
            try platformRegistry.getPlatform(platformIds[i]) returns (PlatformRegistry.Platform memory platform) {
                names[i] = platform.name;
            } catch {
                names[i] = "Unknown";
            }
        }

        return names;
    }
}
