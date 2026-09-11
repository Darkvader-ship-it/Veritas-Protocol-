// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console} from "@forge-std/Test.sol";
import {ReputationNFT} from "../../src/core/ReputationNFT.sol";
import {IReputationNFT} from "../../src/interfaces/IReputationNFT.sol";

/**
 * @title ReputationNFTTest
 * @notice Comprehensive tests for the ReputationNFT contract
 */
contract ReputationNFTTest is Test {
    ReputationNFT public nft;

    // Test addresses
    address public owner = address(1);
    address public coreContract = address(2);
    address public user1 = address(3);
    address public user2 = address(4);
    address public unauthorized = address(5);

    // Events to test
    event ReputationMinted(address indexed to, uint256 indexed tokenId, uint256 timestamp);
    event ReputationBurned(address indexed from, uint256 indexed tokenId, uint256 timestamp);
    event MetadataUpdated(
        uint256 indexed tokenId,
        uint256 oldScore,
        uint256 newScore,
        IReputationNFT.ReputationTier oldTier,
        IReputationNFT.ReputationTier newTier
    );
    event TierUpgraded(
        uint256 indexed tokenId, address indexed owner, IReputationNFT.ReputationTier newTier, uint256 veritasScore
    );
    event CoreUpdated(address indexed oldCore, address indexed newCore);

    function setUp() public {
        vm.startPrank(owner);
        nft = new ReputationNFT();
        nft.setCore(coreContract);
        vm.stopPrank();
    }

    // ============================================
    // Deployment Tests
    // ============================================

    function test_Deployment() public view {
        assertEq(nft.name(), "Veritas Reputation", "Name should be correct");
        assertEq(nft.symbol(), "VERITAS", "Symbol should be correct");
        assertEq(nft.owner(), owner, "Owner should be correct");
        assertEq(nft.getCore(), coreContract, "Core contract should be set");
    }

    // ============================================
    // Access Control Tests
    // ============================================

    function test_SetCore() public {
        address newCore = address(99);

        vm.expectEmit(true, true, false, false);
        emit CoreUpdated(coreContract, newCore);

        vm.prank(owner);
        nft.setCore(newCore);

        assertEq(nft.getCore(), newCore, "Core contract should be updated");
    }

    function test_SetCore_RevertWhen_NotOwner() public {
        vm.prank(unauthorized);
        vm.expectRevert();
        nft.setCore(address(99));
    }

    // ============================================
    // Minting Tests
    // ============================================

    function test_Mint() public {
        vm.expectEmit(true, true, false, true);
        emit ReputationMinted(user1, 1, block.timestamp);

        vm.prank(coreContract);
        uint256 tokenId = nft.mint(user1);

        assertEq(tokenId, 1, "First token ID should be 1");
        assertEq(nft.ownerOf(tokenId), user1, "User1 should own the token");
        assertEq(nft.tokenOfOwner(user1), tokenId, "User1 should have token 1");
        assertTrue(nft.hasToken(user1), "User1 should have a token");
    }

    function test_Mint_InitialMetadata() public {
        vm.prank(coreContract);
        uint256 tokenId = nft.mint(user1);

        IReputationNFT.NFTMetadata memory metadata = nft.getMetadata(tokenId);

        assertEq(metadata.veritasScore, 0, "Initial VeritasScore should be 0");
        assertEq(uint256(metadata.tier), uint256(IReputationNFT.ReputationTier.BRONZE), "Initial tier should be BRONZE");
        assertEq(metadata.totalPredictions, 0, "Initial predictions should be 0");
        assertEq(metadata.correctPredictions, 0, "Initial correct predictions should be 0");
        assertEq(metadata.winRate, 0, "Initial win rate should be 0");
        assertEq(metadata.totalVolume, 0, "Initial volume should be 0");
        assertEq(metadata.connectedPlatforms.length, 0, "Initial platforms should be empty");
        assertEq(metadata.mintTimestamp, block.timestamp, "Mint timestamp should be current time");
        assertEq(metadata.lastUpdate, block.timestamp, "Last update should be mint time");
    }

    function test_Mint_MultipleUsers() public {
        vm.prank(coreContract);
        uint256 tokenId1 = nft.mint(user1);

        vm.prank(coreContract);
        uint256 tokenId2 = nft.mint(user2);

        assertEq(tokenId1, 1, "First token should be ID 1");
        assertEq(tokenId2, 2, "Second token should be ID 2");
        assertEq(nft.ownerOf(tokenId1), user1, "User1 should own token 1");
        assertEq(nft.ownerOf(tokenId2), user2, "User2 should own token 2");
    }

    function test_Mint_RevertWhen_AlreadyHasToken() public {
        vm.prank(coreContract);
        nft.mint(user1);

        vm.expectRevert(abi.encodeWithSelector(IReputationNFT.AlreadyHasToken.selector, user1));
        vm.prank(coreContract);
        nft.mint(user1);
    }

    function test_Mint_RevertWhen_NotCore() public {
        vm.expectRevert(IReputationNFT.Unauthorized.selector);
        vm.prank(unauthorized);
        nft.mint(user1);
    }

    // ============================================
    // Burning Tests
    // ============================================

    function test_Burn_ByCore() public {
        vm.prank(coreContract);
        uint256 tokenId = nft.mint(user1);

        vm.expectEmit(true, true, false, true);
        emit ReputationBurned(user1, tokenId, block.timestamp);

        vm.prank(coreContract);
        nft.burn(tokenId);

        assertFalse(nft.hasToken(user1), "User1 should not have a token");
        assertEq(nft.tokenOfOwner(user1), 0, "User1 should have no token ID");

        vm.expectRevert();
        nft.ownerOf(tokenId);
    }

    function test_Burn_ByOwner() public {
        vm.prank(coreContract);
        uint256 tokenId = nft.mint(user1);

        vm.prank(user1);
        nft.burn(tokenId);

        assertFalse(nft.hasToken(user1), "User1 should not have a token");
    }

    function test_Burn_RevertWhen_Unauthorized() public {
        vm.prank(coreContract);
        uint256 tokenId = nft.mint(user1);

        vm.expectRevert(IReputationNFT.Unauthorized.selector);
        vm.prank(unauthorized);
        nft.burn(tokenId);
    }

    function test_Burn_AllowsReminting() public {
        // Mint
        vm.prank(coreContract);
        uint256 tokenId1 = nft.mint(user1);

        // Burn
        vm.prank(coreContract);
        nft.burn(tokenId1);

        // Can mint again
        vm.prank(coreContract);
        uint256 tokenId2 = nft.mint(user1);

        assertEq(tokenId2, 2, "New token should have next ID");
        assertEq(nft.ownerOf(tokenId2), user1, "User1 should own new token");
    }

    // ============================================
    // Soulbound Tests
    // ============================================

    function test_Soulbound_TransferReverts() public {
        vm.prank(coreContract);
        uint256 tokenId = nft.mint(user1);

        vm.expectRevert(IReputationNFT.TokenIsSoulbound.selector);
        vm.prank(user1);
        nft.transferFrom(user1, user2, tokenId);
    }

    function test_Soulbound_SafeTransferReverts() public {
        vm.prank(coreContract);
        uint256 tokenId = nft.mint(user1);

        vm.expectRevert(IReputationNFT.TokenIsSoulbound.selector);
        vm.prank(user1);
        nft.safeTransferFrom(user1, user2, tokenId);
    }

    function test_Soulbound_ApprovalStillWorks() public {
        vm.prank(coreContract);
        uint256 tokenId = nft.mint(user1);

        // Approval should work (even though transfers don't)
        vm.prank(user1);
        nft.approve(user2, tokenId);

        assertEq(nft.getApproved(tokenId), user2, "Approval should be set");

        // But transfer should still fail
        vm.expectRevert(IReputationNFT.TokenIsSoulbound.selector);
        vm.prank(user2);
        nft.transferFrom(user1, user2, tokenId);
    }

    // ============================================
    // Metadata Update Tests
    // ============================================

    function test_UpdateMetadata() public {
        vm.prank(coreContract);
        uint256 tokenId = nft.mint(user1);

        string[] memory platforms = new string[](2);
        platforms[0] = "DreamDEX";
        platforms[1] = "Polymarket";

        vm.expectEmit(true, false, false, true);
        emit MetadataUpdated(
            tokenId,
            0, // old score
            500, // new score
            IReputationNFT.ReputationTier.BRONZE, // old tier
            IReputationNFT.ReputationTier.GOLD // new tier
        );

        vm.expectEmit(true, true, false, true);
        emit TierUpgraded(tokenId, user1, IReputationNFT.ReputationTier.GOLD, 500);

        vm.prank(coreContract);
        nft.updateMetadata(
            tokenId,
            500, // veritasScore
            100, // totalPredictions
            75, // correctPredictions
            10 ether, // totalVolume
            platforms
        );

        IReputationNFT.NFTMetadata memory metadata = nft.getMetadata(tokenId);

        assertEq(metadata.veritasScore, 500, "VeritasScore should be updated");
        assertEq(uint256(metadata.tier), uint256(IReputationNFT.ReputationTier.GOLD), "Tier should be GOLD");
        assertEq(metadata.totalPredictions, 100, "Total predictions should be updated");
        assertEq(metadata.correctPredictions, 75, "Correct predictions should be updated");
        assertEq(metadata.winRate, 7500, "Win rate should be 75.00%");
        assertEq(metadata.totalVolume, 10 ether, "Volume should be updated");
        assertEq(metadata.connectedPlatforms.length, 2, "Should have 2 platforms");
        assertEq(metadata.connectedPlatforms[0], "DreamDEX", "First platform should match");
        assertEq(metadata.connectedPlatforms[1], "Polymarket", "Second platform should match");
    }

    function test_UpdateMetadata_TierProgression() public {
        vm.prank(coreContract);
        uint256 tokenId = nft.mint(user1);

        string[] memory platforms = new string[](0);

        // Update to SILVER (200)
        vm.prank(coreContract);
        nft.updateMetadata(tokenId, 200, 10, 5, 1 ether, platforms);
        assertEq(uint256(nft.getTier(tokenId)), uint256(IReputationNFT.ReputationTier.SILVER), "Should be SILVER");

        // Update to GOLD (400)
        vm.prank(coreContract);
        nft.updateMetadata(tokenId, 400, 20, 15, 5 ether, platforms);
        assertEq(uint256(nft.getTier(tokenId)), uint256(IReputationNFT.ReputationTier.GOLD), "Should be GOLD");

        // Update to PLATINUM (650)
        vm.prank(coreContract);
        nft.updateMetadata(tokenId, 650, 50, 40, 20 ether, platforms);
        assertEq(uint256(nft.getTier(tokenId)), uint256(IReputationNFT.ReputationTier.PLATINUM), "Should be PLATINUM");

        // Update to DIAMOND (900)
        vm.prank(coreContract);
        nft.updateMetadata(tokenId, 900, 100, 85, 100 ether, platforms);
        assertEq(uint256(nft.getTier(tokenId)), uint256(IReputationNFT.ReputationTier.DIAMOND), "Should be DIAMOND");
    }

    function test_UpdateMetadata_RevertWhen_NotCore() public {
        vm.prank(coreContract);
        uint256 tokenId = nft.mint(user1);

        string[] memory platforms = new string[](0);

        vm.expectRevert(IReputationNFT.Unauthorized.selector);
        vm.prank(unauthorized);
        nft.updateMetadata(tokenId, 1000, 10, 8, 1 ether, platforms);
    }

    function test_UpdateMetadata_RevertWhen_TokenDoesNotExist() public {
        string[] memory platforms = new string[](0);

        vm.expectRevert(abi.encodeWithSelector(IReputationNFT.TokenDoesNotExist.selector, 999));
        vm.prank(coreContract);
        nft.updateMetadata(999, 1000, 10, 8, 1 ether, platforms);
    }

    // ============================================
    // Metadata Query Tests
    // ============================================

    function test_GetMetadata() public {
        vm.prank(coreContract);
        uint256 tokenId = nft.mint(user1);

        IReputationNFT.NFTMetadata memory metadata = nft.getMetadata(tokenId);

        assertEq(metadata.veritasScore, 0, "Should return metadata");
    }

    function test_GetMetadata_RevertWhen_TokenDoesNotExist() public {
        vm.expectRevert(abi.encodeWithSelector(IReputationNFT.TokenDoesNotExist.selector, 999));
        nft.getMetadata(999);
    }

    function test_GetTier() public {
        vm.prank(coreContract);
        uint256 tokenId = nft.mint(user1);

        assertEq(uint256(nft.getTier(tokenId)), uint256(IReputationNFT.ReputationTier.BRONZE), "Should return tier");
    }

    function test_GetTier_RevertWhen_TokenDoesNotExist() public {
        vm.expectRevert(abi.encodeWithSelector(IReputationNFT.TokenDoesNotExist.selector, 999));
        nft.getTier(999);
    }

    function test_GetVeritasScore() public {
        vm.prank(coreContract);
        uint256 tokenId = nft.mint(user1);

        assertEq(nft.getVeritasScore(tokenId), 0, "Should return VeritasScore");
    }

    function test_GetVeritasScore_RevertWhen_TokenDoesNotExist() public {
        vm.expectRevert(abi.encodeWithSelector(IReputationNFT.TokenDoesNotExist.selector, 999));
        nft.getVeritasScore(999);
    }

    function test_TokenOfOwner() public {
        assertEq(nft.tokenOfOwner(user1), 0, "Should return 0 when no token");

        vm.prank(coreContract);
        uint256 tokenId = nft.mint(user1);

        assertEq(nft.tokenOfOwner(user1), tokenId, "Should return token ID");
    }

    function test_HasToken() public {
        assertFalse(nft.hasToken(user1), "Should return false when no token");

        vm.prank(coreContract);
        nft.mint(user1);

        assertTrue(nft.hasToken(user1), "Should return true when has token");
    }

    // ============================================
    // TokenURI Tests
    // ============================================

    function test_TokenURI_Bronze() public {
        vm.prank(coreContract);
        uint256 tokenId = nft.mint(user1);

        string memory uri = nft.tokenURI(tokenId);

        // Should start with data:application/json;base64,
        assertTrue(bytes(uri).length > 0, "URI should not be empty");
        assertEq(substring(uri, 0, 29), "data:application/json;base64,", "URI should have correct prefix");
    }

    function test_TokenURI_WithMetadata() public {
        vm.prank(coreContract);
        uint256 tokenId = nft.mint(user1);

        string[] memory platforms = new string[](1);
        platforms[0] = "DreamDEX";

        vm.prank(coreContract);
        nft.updateMetadata(tokenId, 1500, 100, 75, 10 ether, platforms);

        string memory uri = nft.tokenURI(tokenId);

        assertTrue(bytes(uri).length > 0, "URI with metadata should not be empty");
    }

    function test_TokenURI_RevertWhen_TokenDoesNotExist() public {
        vm.expectRevert(abi.encodeWithSelector(IReputationNFT.TokenDoesNotExist.selector, 999));
        nft.tokenURI(999);
    }

    // ============================================
    // Tier Calculation Tests
    // ============================================

    function test_TierCalculation_AllTiers() public {
        vm.startPrank(coreContract);

        string[] memory platforms = new string[](0);

        // BRONZE (0-199)
        uint256 tokenId1 = nft.mint(address(10));
        nft.updateMetadata(tokenId1, 100, 10, 5, 1 ether, platforms);
        assertEq(uint256(nft.getTier(tokenId1)), uint256(IReputationNFT.ReputationTier.BRONZE), "100 should be BRONZE");

        // SILVER (200-399)
        uint256 tokenId2 = nft.mint(address(11));
        nft.updateMetadata(tokenId2, 300, 10, 7, 1 ether, platforms);
        assertEq(uint256(nft.getTier(tokenId2)), uint256(IReputationNFT.ReputationTier.SILVER), "300 should be SILVER");

        // GOLD (400-649)
        uint256 tokenId3 = nft.mint(address(12));
        nft.updateMetadata(tokenId3, 500, 10, 9, 1 ether, platforms);
        assertEq(uint256(nft.getTier(tokenId3)), uint256(IReputationNFT.ReputationTier.GOLD), "500 should be GOLD");

        // PLATINUM (650-899)
        uint256 tokenId4 = nft.mint(address(13));
        nft.updateMetadata(tokenId4, 750, 10, 9, 1 ether, platforms);
        assertEq(
            uint256(nft.getTier(tokenId4)), uint256(IReputationNFT.ReputationTier.PLATINUM), "750 should be PLATINUM"
        );

        // DIAMOND (900+)
        uint256 tokenId5 = nft.mint(address(14));
        nft.updateMetadata(tokenId5, 1000, 10, 10, 1 ether, platforms);
        assertEq(
            uint256(nft.getTier(tokenId5)), uint256(IReputationNFT.ReputationTier.DIAMOND), "1000 should be DIAMOND"
        );

        vm.stopPrank();
    }

    // ============================================
    // Win Rate Calculation Tests
    // ============================================

    function test_WinRateCalculation() public {
        vm.startPrank(coreContract);

        string[] memory platforms = new string[](0);

        uint256 tokenId = nft.mint(user1);

        // 75% win rate
        nft.updateMetadata(tokenId, 1000, 100, 75, 1 ether, platforms);
        IReputationNFT.NFTMetadata memory metadata = nft.getMetadata(tokenId);
        assertEq(metadata.winRate, 7500, "Win rate should be 75.00%");

        // 100% win rate
        nft.updateMetadata(tokenId, 2000, 50, 50, 1 ether, platforms);
        metadata = nft.getMetadata(tokenId);
        assertEq(metadata.winRate, 10000, "Win rate should be 100.00%");

        // 0% win rate
        nft.updateMetadata(tokenId, 0, 50, 0, 1 ether, platforms);
        metadata = nft.getMetadata(tokenId);
        assertEq(metadata.winRate, 0, "Win rate should be 0.00%");

        vm.stopPrank();
    }

    // ============================================
    // Helper Functions
    // ============================================

    function substring(string memory str, uint256 start, uint256 end) internal pure returns (string memory) {
        bytes memory strBytes = bytes(str);
        bytes memory result = new bytes(end - start);
        for (uint256 i = start; i < end; i++) {
            result[i - start] = strBytes[i];
        }
        return string(result);
    }
}
