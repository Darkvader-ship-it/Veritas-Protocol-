// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "@forge-std/Test.sol";
import {VeritasCore} from "../../src/core/VeritasCore.sol";
import {ReputationNFT} from "../../src/core/ReputationNFT.sol";
import {ScoreCalculator} from "../../src/core/ScoreCalculator.sol";
import {PlatformRegistry} from "../../src/core/PlatformRegistry.sol";
import {IReputationNFT} from "../../src/interfaces/IReputationNFT.sol";

/**
 * @title VeritasCoreTest
 * @notice Integration tests for the complete Veritas system
 */
contract VeritasCoreTest is Test {
    VeritasCore public core;
    ReputationNFT public nft;
    ScoreCalculator public calculator;
    PlatformRegistry public registry;

    // Test addresses
    address public owner = address(1);
    address public user1 = address(2);
    address public user2 = address(3);
    address public unauthorized = address(4);

    // Mock adapter addresses
    address public dreamdexAdapter = address(100);
    address public polymarketAdapter = address(101);

    // Platform IDs
    uint256 public dreamdexPlatformId;
    uint256 public polymarketPlatformId;

    // Mint fee constant (must match VeritasCore.MINT_FEE)
    uint256 public constant MINT_FEE = 0.0005 ether;

    function setUp() public {
        // Fund test accounts
        vm.deal(user1, 100 ether);
        vm.deal(user2, 100 ether);
        vm.deal(unauthorized, 100 ether);
        vm.startPrank(owner);

        // Deploy contracts
        nft = new ReputationNFT();
        calculator = new ScoreCalculator();
        registry = new PlatformRegistry();

        // Deploy core
        core = new VeritasCore(address(nft), address(calculator), address(registry));

        // Set core as NFT controller
        nft.setCore(address(core));

        // Register platforms
        dreamdexPlatformId = registry.addPlatform(
            "DreamDEX",
            dreamdexAdapter,
            "https://dreamdex.finance",
            PlatformRegistry.PlatformType.BINARY_PREDICTION
        );

        polymarketPlatformId = registry.addPlatform(
            "Polymarket", polymarketAdapter, "https://polymarket.com", PlatformRegistry.PlatformType.CATEGORICAL
        );

        vm.stopPrank();
    }

    // ============================================
    // User Registration Tests
    // ============================================

    function test_RegisterUser() public {
        vm.prank(user1);
        uint256 nftTokenId = core.registerUser{value: MINT_FEE}();

        assertEq(nftTokenId, 1, "NFT token ID should be 1");
        assertTrue(core.hasRegistered(user1), "User should be registered");
        assertEq(nft.ownerOf(nftTokenId), user1, "User should own NFT");

        VeritasCore.UserProfile memory profile = core.getUserProfile(user1);
        assertEq(profile.reputationNFTId, nftTokenId, "Profile should have NFT ID");
        assertEq(profile.veritasScore, 0, "Initial score should be 0");
        assertEq(profile.totalPredictions, 0, "Initial predictions should be 0");
        assertEq(profile.connectedPlatforms.length, 0, "No platforms connected initially");
    }

    function test_RegisterUser_RevertWhen_AlreadyRegistered() public {
        vm.startPrank(user1);
        core.registerUser{value: MINT_FEE}();

        vm.expectRevert(abi.encodeWithSelector(VeritasCore.AlreadyRegistered.selector, user1));
        core.registerUser{value: MINT_FEE}();
        vm.stopPrank();
    }

    function test_HasRegistered() public {
        assertFalse(core.hasRegistered(user1), "User should not be registered initially");

        vm.prank(user1);
        core.registerUser{value: MINT_FEE}();

        assertTrue(core.hasRegistered(user1), "User should be registered after registration");
    }

    // ============================================
    // Platform Connection Tests
    // ============================================

    function test_ConnectPlatform() public {
        vm.startPrank(user1);
        core.registerUser{value: MINT_FEE}();
        core.connectPlatform(dreamdexPlatformId);
        vm.stopPrank();

        assertTrue(core.isPlatformConnected(user1, dreamdexPlatformId), "Platform should be connected");
        assertEq(core.getConnectedPlatformCount(user1), 1, "Should have 1 connected platform");

        uint256[] memory connected = core.getConnectedPlatforms(user1);
        assertEq(connected[0], dreamdexPlatformId, "Platform ID should match");
    }

    function test_ConnectPlatform_Multiple() public {
        vm.startPrank(user1);
        core.registerUser{value: MINT_FEE}();
        core.connectPlatform(dreamdexPlatformId);
        core.connectPlatform(polymarketPlatformId);
        vm.stopPrank();

        assertEq(core.getConnectedPlatformCount(user1), 2, "Should have 2 connected platforms");
        assertTrue(core.isPlatformConnected(user1, dreamdexPlatformId), "DreamDEX should be connected");
        assertTrue(core.isPlatformConnected(user1, polymarketPlatformId), "Polymarket should be connected");
    }

    function test_ConnectPlatform_RevertWhen_NotRegistered() public {
        vm.expectRevert(abi.encodeWithSelector(VeritasCore.NotRegistered.selector, user1));
        vm.prank(user1);
        core.connectPlatform(dreamdexPlatformId);
    }

    function test_ConnectPlatform_RevertWhen_PlatformNotActive() public {
        vm.startPrank(user1);
        core.registerUser{value: MINT_FEE}();
        vm.stopPrank();

        // Deactivate platform
        vm.prank(owner);
        registry.deactivatePlatform(dreamdexPlatformId);

        vm.expectRevert(abi.encodeWithSelector(VeritasCore.PlatformNotActive.selector, dreamdexPlatformId));
        vm.prank(user1);
        core.connectPlatform(dreamdexPlatformId);
    }

    function test_ConnectPlatform_RevertWhen_AlreadyConnected() public {
        vm.startPrank(user1);
        core.registerUser{value: MINT_FEE}();
        core.connectPlatform(dreamdexPlatformId);

        vm.expectRevert(abi.encodeWithSelector(VeritasCore.PlatformAlreadyConnected.selector, dreamdexPlatformId));
        core.connectPlatform(dreamdexPlatformId);
        vm.stopPrank();
    }

    // ============================================
    // Prediction Import Tests
    // ============================================

    function test_ImportPredictions() public {
        vm.startPrank(user1);
        core.registerUser{value: MINT_FEE}();
        core.connectPlatform(dreamdexPlatformId);

        bytes32 proof = keccak256("batch1");

        core.importPredictions(
            dreamdexPlatformId,
            100, // totalPredictions
            75, // correctPredictions
            10 ether, // totalVolume
            proof
        );

        vm.stopPrank();

        VeritasCore.UserProfile memory profile = core.getUserProfile(user1);
        assertEq(profile.totalPredictions, 100, "Total predictions should be updated");
        assertEq(profile.correctPredictions, 75, "Correct predictions should be updated");
        assertEq(profile.totalVolume, 10 ether, "Volume should be updated");
        assertGt(profile.veritasScore, 0, "VeritasScore should be calculated");
    }

    function test_ImportPredictions_UpdatesNFT() public {
        vm.startPrank(user1);
        uint256 tokenId = core.registerUser{value: MINT_FEE}();
        core.connectPlatform(dreamdexPlatformId);

        bytes32 proof = keccak256("batch1");

        core.importPredictions(dreamdexPlatformId, 100, 75, 10 ether, proof);

        vm.stopPrank();

        IReputationNFT.NFTMetadata memory metadata = nft.getMetadata(tokenId);
        assertGt(metadata.veritasScore, 0, "NFT VeritasScore should be updated");
        assertEq(metadata.totalPredictions, 100, "NFT predictions should be updated");
        assertEq(metadata.winRate, 7500, "NFT win rate should be 75%");
    }

    function test_ImportPredictions_MultipleBatches() public {
        vm.startPrank(user1);
        core.registerUser{value: MINT_FEE}();
        core.connectPlatform(dreamdexPlatformId);

        // First import
        bytes32 proof1 = keccak256("batch1");
        core.importPredictions(dreamdexPlatformId, 50, 40, 5 ether, proof1);

        // Wait for rate limit
        vm.warp(block.timestamp + 1 hours + 1);

        // Second import
        bytes32 proof2 = keccak256("batch2");
        core.importPredictions(dreamdexPlatformId, 50, 35, 5 ether, proof2);

        vm.stopPrank();

        VeritasCore.UserProfile memory profile = core.getUserProfile(user1);
        assertEq(profile.totalPredictions, 100, "Should have cumulative predictions");
        assertEq(profile.correctPredictions, 75, "Should have cumulative correct predictions");
        assertEq(profile.totalVolume, 10 ether, "Should have cumulative volume");
    }

    function test_ImportPredictions_RevertWhen_NotConnected() public {
        vm.startPrank(user1);
        core.registerUser{value: MINT_FEE}();

        bytes32 proof = keccak256("batch1");

        vm.expectRevert(abi.encodeWithSelector(VeritasCore.PlatformNotConnected.selector, dreamdexPlatformId));
        core.importPredictions(dreamdexPlatformId, 100, 75, 10 ether, proof);

        vm.stopPrank();
    }

    function test_ImportPredictions_RevertWhen_RateLimited() public {
        vm.startPrank(user1);
        core.registerUser{value: MINT_FEE}();
        core.connectPlatform(dreamdexPlatformId);

        bytes32 proof1 = keccak256("batch1");
        core.importPredictions(dreamdexPlatformId, 100, 75, 10 ether, proof1);

        // Try importing again immediately
        bytes32 proof2 = keccak256("batch2");
        vm.expectRevert();
        core.importPredictions(dreamdexPlatformId, 50, 40, 5 ether, proof2);

        vm.stopPrank();
    }

    function test_ImportPredictions_RevertWhen_DuplicateBatch() public {
        vm.startPrank(user1);
        core.registerUser{value: MINT_FEE}();
        core.connectPlatform(dreamdexPlatformId);

        bytes32 proof = keccak256("batch1");
        core.importPredictions(dreamdexPlatformId, 100, 75, 10 ether, proof);

        vm.warp(block.timestamp + 1 hours + 1);

        vm.expectRevert(abi.encodeWithSelector(VeritasCore.BatchAlreadyImported.selector, proof));
        core.importPredictions(dreamdexPlatformId, 100, 75, 10 ether, proof);

        vm.stopPrank();
    }

    function test_ImportPredictions_RevertWhen_InvalidData() public {
        vm.startPrank(user1);
        core.registerUser{value: MINT_FEE}();
        core.connectPlatform(dreamdexPlatformId);

        bytes32 proof = keccak256("batch1");

        vm.expectRevert(VeritasCore.InvalidPredictionData.selector);
        core.importPredictions(
            dreamdexPlatformId,
            100, // totalPredictions
            150, // correctPredictions (more than total!)
            10 ether,
            proof
        );

        vm.stopPrank();
    }

    // ============================================
    // Score Update Tests
    // ============================================

    function test_UpdateVeritasScore() public {
        vm.startPrank(user1);
        core.registerUser{value: MINT_FEE}();
        core.connectPlatform(dreamdexPlatformId);

        bytes32 proof = keccak256("batch1");
        core.importPredictions(dreamdexPlatformId, 100, 75, 10 ether, proof);
        vm.stopPrank();

        uint256 scoreBefore = core.getUserProfile(user1).veritasScore;

        // External update (anyone can trigger)
        vm.prank(unauthorized);
        core.updateVeritasScore(user1);

        uint256 scoreAfter = core.getUserProfile(user1).veritasScore;

        // Score should be the same (no new predictions)
        assertEq(scoreAfter, scoreBefore, "Score should remain the same");
    }

    function test_UpdateVeritasScore_RevertWhen_NotRegistered() public {
        vm.expectRevert(abi.encodeWithSelector(VeritasCore.NotRegistered.selector, user1));
        core.updateVeritasScore(user1);
    }

    // ============================================
    // Profile Query Tests
    // ============================================

    function test_GetUserProfile() public {
        vm.startPrank(user1);
        core.registerUser{value: MINT_FEE}();
        core.connectPlatform(dreamdexPlatformId);

        bytes32 proof = keccak256("batch1");
        core.importPredictions(dreamdexPlatformId, 100, 75, 10 ether, proof);
        vm.stopPrank();

        VeritasCore.UserProfile memory profile = core.getUserProfile(user1);

        assertEq(profile.reputationNFTId, 1, "NFT ID should be 1");
        assertGt(profile.veritasScore, 0, "Should have a score");
        assertEq(profile.totalPredictions, 100, "Should have 100 predictions");
        assertEq(profile.correctPredictions, 75, "Should have 75 correct");
        assertEq(profile.totalVolume, 10 ether, "Should have 10 ether volume");
        assertEq(profile.connectedPlatforms.length, 1, "Should have 1 platform");
    }

    function test_GetWinRate() public {
        vm.startPrank(user1);
        core.registerUser{value: MINT_FEE}();
        core.connectPlatform(dreamdexPlatformId);

        bytes32 proof = keccak256("batch1");
        core.importPredictions(dreamdexPlatformId, 100, 75, 10 ether, proof);
        vm.stopPrank();

        uint256 winRate = core.getWinRate(user1);
        assertEq(winRate, 7500, "Win rate should be 75.00%");
    }

    function test_GetWinRate_ZeroWhenNoPredictions() public {
        vm.prank(user1);
        core.registerUser{value: MINT_FEE}();

        uint256 winRate = core.getWinRate(user1);
        assertEq(winRate, 0, "Win rate should be 0 with no predictions");
    }

    // ============================================
    // Pause/Unpause Tests
    // ============================================

    function test_Pause() public {
        vm.prank(owner);
        core.pause();

        vm.expectRevert();
        vm.prank(user1);
        core.registerUser();
    }

    function test_Unpause() public {
        vm.startPrank(owner);
        core.pause();
        core.unpause();
        vm.stopPrank();

        vm.prank(user1);
        core.registerUser{value: MINT_FEE}(); // Should work now
    }

    function test_Pause_RevertWhen_NotOwner() public {
        vm.expectRevert();
        vm.prank(unauthorized);
        core.pause();
    }

    // ============================================
    // Admin Functions Tests
    // ============================================

    function test_AdminUpdateScore() public {
        vm.startPrank(user1);
        core.registerUser{value: MINT_FEE}();
        core.connectPlatform(dreamdexPlatformId);

        bytes32 proof = keccak256("batch1");
        core.importPredictions(dreamdexPlatformId, 100, 75, 10 ether, proof);
        vm.stopPrank();

        vm.prank(owner);
        core.adminUpdateScore(user1);

        // Should not revert
    }

    function test_AdminUpdateScore_RevertWhen_NotOwner() public {
        vm.prank(user1);
        core.registerUser{value: MINT_FEE}();

        vm.expectRevert();
        vm.prank(unauthorized);
        core.adminUpdateScore(user1);
    }

    // ============================================
    // Integration: Full User Journey
    // ============================================

    function test_Integration_FullUserJourney() public {
        // 1. User registers
        vm.prank(user1);
        uint256 nftTokenId = core.registerUser{value: MINT_FEE}();

        assertEq(nftTokenId, 1, "NFT should be minted");
        assertTrue(core.hasRegistered(user1), "User should be registered");

        // 2. User connects platform
        vm.prank(user1);
        core.connectPlatform(dreamdexPlatformId);

        assertTrue(core.isPlatformConnected(user1, dreamdexPlatformId), "Platform should be connected");

        // 3. User imports predictions
        vm.prank(user1);
        bytes32 proof = keccak256("batch1");
        core.importPredictions(dreamdexPlatformId, 100, 80, 20 ether, proof);

        // 4. Verify profile
        VeritasCore.UserProfile memory profile = core.getUserProfile(user1);
        assertEq(profile.totalPredictions, 100, "Predictions should be imported");
        assertEq(profile.correctPredictions, 80, "Correct predictions should be tracked");
        assertGt(profile.veritasScore, 0, "VeritasScore should be calculated");

        // 5. Verify NFT metadata
        IReputationNFT.NFTMetadata memory metadata = nft.getMetadata(nftTokenId);
        assertEq(metadata.veritasScore, profile.veritasScore, "NFT score should match profile");
        assertEq(metadata.totalPredictions, 100, "NFT predictions should match");
        assertEq(metadata.winRate, 8000, "NFT win rate should be 80%");

        // 6. Connect second platform
        vm.prank(user1);
        core.connectPlatform(polymarketPlatformId);

        assertEq(core.getConnectedPlatformCount(user1), 2, "Should have 2 platforms");

        // 7. Import from second platform (after rate limit)
        vm.warp(block.timestamp + 1 hours + 1);

        vm.prank(user1);
        bytes32 proof2 = keccak256("batch2");
        core.importPredictions(polymarketPlatformId, 50, 40, 5 ether, proof2);

        // 8. Verify cumulative stats
        profile = core.getUserProfile(user1);
        assertEq(profile.totalPredictions, 150, "Should have cumulative predictions");
        assertEq(profile.correctPredictions, 120, "Should have cumulative correct");
        assertEq(profile.totalVolume, 25 ether, "Should have cumulative volume");

        // 9. Verify win rate
        uint256 winRate = core.getWinRate(user1);
        assertEq(winRate, 8000, "Win rate should be 80%");
    }

    // ============================================
    // Multi-User Tests
    // ============================================

    function test_MultipleUsers() public {
        // User 1 journey
        vm.startPrank(user1);
        core.registerUser{value: MINT_FEE}();
        core.connectPlatform(dreamdexPlatformId);
        core.importPredictions(dreamdexPlatformId, 100, 80, 10 ether, keccak256("user1batch1"));
        vm.stopPrank();

        // User 2 journey
        vm.startPrank(user2);
        core.registerUser{value: MINT_FEE}();
        core.connectPlatform(polymarketPlatformId);
        core.importPredictions(polymarketPlatformId, 50, 30, 5 ether, keccak256("user2batch1"));
        vm.stopPrank();

        // Verify both users
        VeritasCore.UserProfile memory profile1 = core.getUserProfile(user1);
        VeritasCore.UserProfile memory profile2 = core.getUserProfile(user2);

        assertEq(profile1.totalPredictions, 100, "User1 should have 100 predictions");
        assertEq(profile2.totalPredictions, 50, "User2 should have 50 predictions");

        assertGt(profile1.veritasScore, profile2.veritasScore, "User1 should have higher score (better win rate)");
    }
}
