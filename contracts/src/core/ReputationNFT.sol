// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {IReputationNFT} from "../interfaces/IReputationNFT.sol";

/**
 * @title ReputationNFT
 * @notice Soulbound NFT representing user reputation in Veritas
 * @dev Non-transferable ERC721 with dynamic on-chain SVG metadata
 * @author Veritas Team
 */
contract ReputationNFT is ERC721, Ownable, IReputationNFT {
    using Strings for uint256;

    // VeritasCore contract (only address authorized to mint/update)
    address private coreContract;

    // Token ID counter
    uint256 private _nextTokenId = 1;

    // Mapping from token ID to metadata
    mapping(uint256 => NFTMetadata) private _metadata;

    // Mapping from owner to token ID (enforce one NFT per address)
    mapping(address => uint256) private _ownerToTokenId;

    // ============================================
    // Constructor
    // ============================================

    constructor() ERC721("Veritas Reputation", "VERITAS") Ownable(msg.sender) {}

    // ============================================
    // Modifiers
    // ============================================

    modifier onlyCore() {
        if (msg.sender != coreContract) {
            revert Unauthorized();
        }
        _;
    }

    // ============================================
    // Minting and Burning
    // ============================================

    /**
     * @notice Mints a new reputation NFT to an address
     * @dev Can only be called by VeritasCore contract
     * @dev Only one NFT per address is allowed
     * @param to Address to mint the NFT to
     * @return tokenId The ID of the newly minted token
     */
    function mint(address to) external override onlyCore returns (uint256 tokenId) {
        // Check if address already has a token
        if (_ownerToTokenId[to] != 0) {
            revert AlreadyHasToken(to);
        }

        tokenId = _nextTokenId++;
        _safeMint(to, tokenId);

        // Initialize metadata
        _metadata[tokenId] = NFTMetadata({
            veritasScore: 0,
            tier: ReputationTier.BRONZE,
            totalPredictions: 0,
            correctPredictions: 0,
            winRate: 0,
            totalVolume: 0,
            connectedPlatforms: new string[](0),
            lastUpdate: block.timestamp,
            mintTimestamp: block.timestamp
        });

        // Store owner to token ID mapping
        _ownerToTokenId[to] = tokenId;

        emit ReputationMinted(to, tokenId, block.timestamp);
        return tokenId;
    }

    /**
     * @notice Burns a reputation NFT
     * @dev Can only be called by VeritasCore or token owner
     * @param tokenId ID of the token to burn
     */
    function burn(uint256 tokenId) external override {
        address owner = ownerOf(tokenId);

        // Check authorization
        if (msg.sender != coreContract && msg.sender != owner) {
            revert Unauthorized();
        }

        // Clear owner to token ID mapping
        delete _ownerToTokenId[owner];

        // Clear metadata
        delete _metadata[tokenId];

        _burn(tokenId);

        emit ReputationBurned(owner, tokenId, block.timestamp);
    }

    // ============================================
    // Metadata Management
    // ============================================

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
    ) external override onlyCore {
        if (_ownerOf(tokenId) == address(0)) {
            revert TokenDoesNotExist(tokenId);
        }

        NFTMetadata storage metadata = _metadata[tokenId];

        uint256 oldScore = metadata.veritasScore;
        ReputationTier oldTier = metadata.tier;

        // Calculate new tier
        ReputationTier newTier = _calculateTier(veritasScore);

        // Calculate win rate
        uint256 winRate = totalPredictions > 0 ? (correctPredictions * 10000) / totalPredictions : 0;

        // Update metadata
        metadata.veritasScore = veritasScore;
        metadata.tier = newTier;
        metadata.totalPredictions = totalPredictions;
        metadata.correctPredictions = correctPredictions;
        metadata.winRate = winRate;
        metadata.totalVolume = totalVolume;
        metadata.connectedPlatforms = connectedPlatforms;
        metadata.lastUpdate = block.timestamp;

        emit MetadataUpdated(tokenId, oldScore, veritasScore, oldTier, newTier);

        // Emit tier upgrade event if tier increased
        if (uint256(newTier) > uint256(oldTier)) {
            emit TierUpgraded(tokenId, ownerOf(tokenId), newTier, veritasScore);
        }
    }

    /**
     * @notice Gets the full metadata for a token
     * @param tokenId ID of the token
     * @return metadata NFTMetadata struct
     */
    function getMetadata(uint256 tokenId) external view override returns (NFTMetadata memory metadata) {
        if (_ownerOf(tokenId) == address(0)) {
            revert TokenDoesNotExist(tokenId);
        }
        return _metadata[tokenId];
    }

    /**
     * @notice Gets the reputation tier for a token
     * @param tokenId ID of the token
     * @return tier Current ReputationTier
     */
    function getTier(uint256 tokenId) external view override returns (ReputationTier tier) {
        if (_ownerOf(tokenId) == address(0)) {
            revert TokenDoesNotExist(tokenId);
        }
        return _metadata[tokenId].tier;
    }

    /**
     * @notice Gets the VeritasScore for a token
     * @param tokenId ID of the token
     * @return veritasScore Current score
     */
    function getVeritasScore(uint256 tokenId) external view override returns (uint256 veritasScore) {
        if (_ownerOf(tokenId) == address(0)) {
            revert TokenDoesNotExist(tokenId);
        }
        return _metadata[tokenId].veritasScore;
    }

    // ============================================
    // Token Queries
    // ============================================

    /**
     * @notice Gets the token ID owned by an address
     * @dev Returns 0 if address doesn't own a token
     * @param owner Address to query
     * @return tokenId The token ID owned by the address (0 if none)
     */
    function tokenOfOwner(address owner) external view override returns (uint256 tokenId) {
        return _ownerToTokenId[owner];
    }

    /**
     * @notice Checks if an address owns a reputation NFT
     * @param owner Address to check
     * @return True if address owns an NFT
     */
    function hasToken(address owner) external view override returns (bool) {
        return _ownerToTokenId[owner] != 0;
    }

    /**
     * @notice Returns the dynamic token URI with on-chain SVG
     * @dev Generates SVG based on current metadata
     * @param tokenId ID of the token
     * @return URI containing base64-encoded JSON with embedded SVG
     */
    function tokenURI(uint256 tokenId) public view override(ERC721, IReputationNFT) returns (string memory) {
        if (_ownerOf(tokenId) == address(0)) {
            revert TokenDoesNotExist(tokenId);
        }

        NFTMetadata memory metadata = _metadata[tokenId];

        // Generate SVG
        string memory svg = _generateSVG(metadata);

        // Create JSON metadata
        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{"name": "Veritas Reputation #',
                        tokenId.toString(),
                        '", "description": "Soulbound reputation NFT representing prediction market performance", "image": "data:image/svg+xml;base64,',
                        Base64.encode(bytes(svg)),
                        '", "attributes": [',
                        '{"trait_type": "VeritasScore", "value": ',
                        metadata.veritasScore.toString(),
                        "},",
                        '{"trait_type": "Tier", "value": "',
                        _getTierName(metadata.tier),
                        '"},',
                        '{"trait_type": "Win Rate", "value": ',
                        (metadata.winRate / 100).toString(),
                        "},",
                        '{"trait_type": "Total Predictions", "value": ',
                        metadata.totalPredictions.toString(),
                        "}]}"
                    )
                )
            )
        );

        return string(abi.encodePacked("data:application/json;base64,", json));
    }

    // ============================================
    // Soulbound: Override Transfer Functions
    // ============================================

    /**
     * @dev Override to prevent transfers (soulbound)
     */
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);

        // Allow minting (from == address(0)) and burning (to == address(0))
        // Block all other transfers
        if (from != address(0) && to != address(0)) {
            revert TokenIsSoulbound();
        }

        return super._update(to, tokenId, auth);
    }

    // ============================================
    // Access Control
    // ============================================

    /**
     * @notice Sets the VeritasCore contract address
     * @dev Can only be called by contract owner
     * @param coreContract_ Address of the VeritasCore contract
     */
    function setCore(address coreContract_) external override onlyOwner {
        address oldCore = coreContract;
        coreContract = coreContract_;
        emit CoreUpdated(oldCore, coreContract_);
    }

    /**
     * @notice Gets the VeritasCore contract address
     * @return Address of the core contract
     */
    function getCore() external view override returns (address) {
        return coreContract;
    }

    // ============================================
    // Internal Helper Functions
    // ============================================

    /**
     * @dev Calculates tier based on VeritasScore (0-1300 scale)
     * Thresholds aligned with frontend/lib/contracts.ts:
     * - Diamond: 900+ (top performers)
     * - Platinum: 650-899
     * - Gold: 400-649
     * - Silver: 200-399
     * - Bronze: 0-199
     */
    function _calculateTier(uint256 score) internal pure returns (ReputationTier) {
        if (score >= 900) return ReputationTier.DIAMOND;
        if (score >= 650) return ReputationTier.PLATINUM;
        if (score >= 400) return ReputationTier.GOLD;
        if (score >= 200) return ReputationTier.SILVER;
        return ReputationTier.BRONZE;
    }

    /**
     * @dev Gets tier name as string
     */
    function _getTierName(ReputationTier tier) internal pure returns (string memory) {
        if (tier == ReputationTier.DIAMOND) return "DIAMOND";
        if (tier == ReputationTier.PLATINUM) return "PLATINUM";
        if (tier == ReputationTier.GOLD) return "GOLD";
        if (tier == ReputationTier.SILVER) return "SILVER";
        return "BRONZE";
    }

    /**
     * @dev Gets tier color for SVG
     */
    function _getTierColor(ReputationTier tier) internal pure returns (string memory) {
        if (tier == ReputationTier.DIAMOND) return "#B9F2FF";
        if (tier == ReputationTier.PLATINUM) return "#E5E4E2";
        if (tier == ReputationTier.GOLD) return "#FFD700";
        if (tier == ReputationTier.SILVER) return "#C0C0C0";
        return "#CD7F32"; // Bronze
    }

    /**
     * @dev Generates SVG for token URI
     */
    function _generateSVG(NFTMetadata memory metadata) internal pure returns (string memory) {
        string memory tierColor = _getTierColor(metadata.tier);
        string memory tierName = _getTierName(metadata.tier);

        return string(
            abi.encodePacked(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">',
                "<defs>",
                '<linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">',
                '<stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1" />',
                '<stop offset="100%" style="stop-color:#16213e;stop-opacity:1" />',
                "</linearGradient>",
                "</defs>",
                '<rect width="400" height="400" fill="url(#bg)"/>',
                // Title
                '<text x="200" y="40" font-family="Arial" font-size="24" font-weight="bold" fill="white" text-anchor="middle">VERITAS</text>',
                // Tier Badge
                '<rect x="125" y="60" width="150" height="50" rx="10" fill="',
                tierColor,
                '" opacity="0.3"/>',
                '<text x="200" y="92" font-family="Arial" font-size="20" font-weight="bold" fill="',
                tierColor,
                '" text-anchor="middle">',
                tierName,
                "</text>",
                // VeritasScore (prominent)
                '<text x="200" y="180" font-family="Arial" font-size="18" fill="#888" text-anchor="middle">VeritasScore</text>',
                '<text x="200" y="220" font-family="Arial" font-size="48" font-weight="bold" fill="',
                tierColor,
                '" text-anchor="middle">',
                metadata.veritasScore.toString(),
                "</text>",
                // Win Rate
                '<text x="100" y="280" font-family="Arial" font-size="16" fill="#888">Win Rate:</text>',
                '<text x="300" y="280" font-family="Arial" font-size="16" font-weight="bold" fill="white" text-anchor="end">',
                (metadata.winRate / 100).toString(),
                ".",
                _twoDigits(metadata.winRate % 100),
                "%</text>",
                // Total Predictions
                '<text x="100" y="320" font-family="Arial" font-size="16" fill="#888">Predictions:</text>',
                '<text x="300" y="320" font-family="Arial" font-size="16" font-weight="bold" fill="white" text-anchor="end">',
                metadata.totalPredictions.toString(),
                "</text>",
                // Footer
                '<text x="200" y="370" font-family="Arial" font-size="12" fill="#666" text-anchor="middle">Soulbound - Non-Transferable</text>',
                "</svg>"
            )
        );
    }

    /**
     * @dev Helper to format two-digit numbers with leading zero
     */
    function _twoDigits(uint256 num) internal pure returns (string memory) {
        if (num < 10) {
            return string(abi.encodePacked("0", num.toString()));
        }
        return num.toString();
    }
}
