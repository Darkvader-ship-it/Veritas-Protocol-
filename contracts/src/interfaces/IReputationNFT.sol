// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title IReputationNFT
 * @notice Interface for soulbound reputation NFTs in the Veritas system
 * @dev NFTs are non-transferable (soulbound) and represent verifiable on-chain reputation
 * @author Veritas Team
 */
interface IReputationNFT {
    /**
     * @notice Enum representing reputation tiers
     * @dev Tiers are determined by VeritasScore thresholds (0-1300 scale)
     */
    enum ReputationTier {
        BRONZE, // 0-199
        SILVER, // 200-399
        GOLD, // 400-649
        PLATINUM, // 650-899
        DIAMOND // 900+ (with recency bonus up to 1300)
    }

    /**
     * @notice Struct containing NFT metadata
     * @param veritasScore Current VeritasScore of the holder
     * @param tier Current reputation tier
     * @param totalPredictions Total number of predictions made
     * @param correctPredictions Number of correct predictions
     * @param winRate Win rate as a percentage (0-10000 for two decimals: 7550 = 75.50%)
     * @param totalVolume Total amount staked across all predictions (in wei)
     * @param connectedPlatforms Array of connected platform names
     * @param lastUpdate Timestamp of last metadata update
     * @param mintTimestamp When the NFT was originally minted
     */
    struct NFTMetadata {
        uint256 veritasScore;
        ReputationTier tier;
        uint256 totalPredictions;
        uint256 correctPredictions;
        uint256 winRate;
        uint256 totalVolume;
        string[] connectedPlatforms;
        uint256 lastUpdate;
        uint256 mintTimestamp;
    }

    // ========================================
    // Minting and Burning
    // ========================================

    /**
     * @notice Mints a new reputation NFT to an address
     * @dev Can only be called by VeritasCore contract
     * @dev Only one NFT per address is allowed
     * @param to Address to mint the NFT to
     * @return tokenId The ID of the newly minted token
     */
    function mint(address to) external returns (uint256 tokenId);

    /**
     * @notice Burns a reputation NFT
     * @dev Can only be called by VeritasCore or token owner
     * @param tokenId ID of the token to burn
     */
    function burn(uint256 tokenId) external;

    // ========================================
    // Metadata Management
    // ========================================

    /**
     * @notice Updates the metadata for a token
     * @dev Can only be called by VeritasCore contract
     * @param tokenId ID of the token to update
     * @param veritasScore New VeritasScore
     * @param totalPredictions Updated total predictions
     * @param correctPredictions Updated correct predictions
     * @param totalVolume Updated total volume in wei
     * @param connectedPlatforms Array of connected platform names
     */
    function updateMetadata(
        uint256 tokenId,
        uint256 veritasScore,
        uint256 totalPredictions,
        uint256 correctPredictions,
        uint256 totalVolume,
        string[] memory connectedPlatforms
    ) external;

    /**
     * @notice Gets the full metadata for a token
     * @param tokenId ID of the token
     * @return metadata NFTMetadata struct
     */
    function getMetadata(uint256 tokenId) external view returns (NFTMetadata memory metadata);

    /**
     * @notice Gets the reputation tier for a token
     * @param tokenId ID of the token
     * @return tier Current ReputationTier
     */
    function getTier(uint256 tokenId) external view returns (ReputationTier tier);

    /**
     * @notice Gets the VeritasScore for a token
     * @param tokenId ID of the token
     * @return veritasScore Current score
     */
    function getVeritasScore(uint256 tokenId) external view returns (uint256 veritasScore);

    // ========================================
    // Token Queries
    // ========================================

    /**
     * @notice Gets the token ID owned by an address
     * @dev Returns 0 if address doesn't own a token
     * @param owner Address to query
     * @return tokenId The token ID owned by the address (0 if none)
     */
    function tokenOfOwner(address owner) external view returns (uint256 tokenId);

    /**
     * @notice Checks if an address owns a reputation NFT
     * @param owner Address to check
     * @return True if address owns an NFT
     */
    function hasToken(address owner) external view returns (bool);

    /**
     * @notice Returns the dynamic token URI with on-chain SVG
     * @dev Generates SVG based on current metadata
     * @param tokenId ID of the token
     * @return URI containing base64-encoded JSON with embedded SVG
     */
    function tokenURI(uint256 tokenId) external view returns (string memory);

    // ========================================
    // Access Control
    // ========================================

    /**
     * @notice Sets the VeritasCore contract address
     * @dev Can only be called by contract owner
     * @param coreContract Address of the VeritasCore contract
     */
    function setCore(address coreContract) external;

    /**
     * @notice Gets the VeritasCore contract address
     * @return Address of the core contract
     */
    function getCore() external view returns (address);

    // ========================================
    // Events
    // ========================================

    /**
     * @notice Emitted when a reputation NFT is minted
     * @param to Address receiving the NFT
     * @param tokenId ID of the minted token
     * @param timestamp When the token was minted
     */
    event ReputationMinted(address indexed to, uint256 indexed tokenId, uint256 timestamp);

    /**
     * @notice Emitted when a reputation NFT is burned
     * @param from Address that owned the NFT
     * @param tokenId ID of the burned token
     * @param timestamp When the token was burned
     */
    event ReputationBurned(address indexed from, uint256 indexed tokenId, uint256 timestamp);

    /**
     * @notice Emitted when NFT metadata is updated
     * @param tokenId ID of the updated token
     * @param oldScore Previous VeritasScore
     * @param newScore New VeritasScore
     * @param oldTier Previous tier
     * @param newTier New tier
     */
    event MetadataUpdated(
        uint256 indexed tokenId, uint256 oldScore, uint256 newScore, ReputationTier oldTier, ReputationTier newTier
    );

    /**
     * @notice Emitted when a tier upgrade occurs
     * @param tokenId ID of the token
     * @param owner Address of the token owner
     * @param newTier The upgraded tier
     * @param veritasScore Score at time of upgrade
     */
    event TierUpgraded(uint256 indexed tokenId, address indexed owner, ReputationTier newTier, uint256 veritasScore);

    /**
     * @notice Emitted when core contract address is updated
     * @param oldCore Previous core contract address
     * @param newCore New core contract address
     */
    event CoreUpdated(address indexed oldCore, address indexed newCore);

    // ========================================
    // Errors
    // ========================================

    /**
     * @notice Error thrown when attempting to mint to an address that already has a token
     */
    error AlreadyHasToken(address owner);

    /**
     * @notice Error thrown when attempting to transfer a soulbound token
     */
    error TokenIsSoulbound();

    /**
     * @notice Error thrown when caller is not authorized
     */
    error Unauthorized();

    /**
     * @notice Error thrown when querying non-existent token
     */
    error TokenDoesNotExist(uint256 tokenId);
}
