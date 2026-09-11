// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console} from "@forge-std/Test.sol";
import {VeritasCore} from "../../src/core/VeritasCore.sol";
import {ReputationNFT} from "../../src/core/ReputationNFT.sol";
import {IReputationNFT} from "../../src/interfaces/IReputationNFT.sol";
import {ScoreCalculator} from "../../src/core/ScoreCalculator.sol";
import {PlatformRegistry} from "../../src/core/PlatformRegistry.sol";
import {DreamDEXAdapter} from "../../src/adapters/DreamDEXAdapter.sol";

/**
 * @title FullUserJourneyTest
 * @notice Comprehensive integration test simulating complete MVP user flow
 * @dev Tests the entire user journey from registration to NFT updates
 * @author Veritas Team
 */
contract FullUserJourneyTest is Test {
    // ============================================
    // Contracts
    // ============================================

    VeritasCore public core;
    ReputationNFT public nft;
    ScoreCalculator public calculator;
    PlatformRegistry public registry;
    DreamDEXAdapter public adapter;

    // ============================================
    // Test Accounts
    // ============================================

    address public owner;
    address public alice;
    address public bob;

    // Mock DreamDEX address
    address public mockDreamDEX;

    // Platform ID
    uint256 public dreamDEXPlatformId;

    // Mint fee constant (must match VeritasCore.MINT_FEE)
    uint256 public constant MINT_FEE = 0.0005 ether;

    // ============================================
    // Setup
    // ============================================

    function setUp() public {
        owner = address(this);
        alice = makeAddr("alice");
        bob = makeAddr("bob");
        mockDreamDEX = makeAddr("dreamDEX");

        // Fund test accounts
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);

        // Deploy contracts
        console.log("\n==============================================");
        console.log("DEPLOYING CONTRACTS");
        console.log("==============================================");

        nft = new ReputationNFT();
        console.log("ReputationNFT deployed");

        calculator = new ScoreCalculator();
        console.log("ScoreCalculator deployed");

        registry = new PlatformRegistry();
        console.log("PlatformRegistry deployed");

        core = new VeritasCore(address(nft), address(calculator), address(registry));
        console.log("VeritasCore deployed");

        adapter = new DreamDEXAdapter();
        console.log("DreamDEXAdapter deployed");

        // Configure contracts
        nft.setCore(address(core));
        console.log("NFT minter configured");

        // Register platform
        dreamDEXPlatformId = registry.addPlatform(
            "DreamDEX Event Contracts",
            address(adapter),
            "https://shannon-explorer.somnia.network",
            PlatformRegistry.PlatformType.BINARY_PREDICTION
        );
        console.log("Platform registered with ID:", dreamDEXPlatformId);
        console.log("==============================================\n");
    }

    // ============================================
    // Full User Journey Test
    // ============================================

    function test_FullUserJourney_CompleteFlow() public {
        console.log("\n==============================================");
        console.log("FULL USER JOURNEY TEST");
        console.log("==============================================");
        console.log("User: Alice");
        console.log("Scenario: 50 predictions, 35 wins, 5 STT volume");
        console.log("Expected: ~1,247 VeritasScore, GOLD tier");
        console.log("==============================================\n");

        // ============================================
        // STEP 1: User Registration
        // ============================================

        console.log("STEP 1: User Registration");
        console.log("----------------------------------------------");

        // Check not registered initially
        assertFalse(core.hasRegistered(alice), "Alice should not be registered initially");
        assertEq(nft.balanceOf(alice), 0, "Alice should have 0 NFTs initially");

        // Register Alice
        vm.prank(alice);
        uint256 tokenId = core.registerUser{value: MINT_FEE}();

        console.log("Alice registered with NFT Token ID:", tokenId);

        // Verify registration
        assertTrue(core.hasRegistered(alice), "Alice should be registered");
        assertEq(nft.balanceOf(alice), 1, "Alice should have 1 NFT");
        assertEq(nft.tokenOfOwner(alice), tokenId, "Token ID should match");
        assertEq(nft.ownerOf(tokenId), alice, "Alice should own the NFT");

        // Verify initial profile
        VeritasCore.UserProfile memory profile = core.getUserProfile(alice);
        assertEq(profile.reputationNFTId, tokenId, "Profile NFT ID should match");
        assertEq(profile.veritasScore, 0, "Initial VeritasScore should be 0");
        assertEq(profile.totalPredictions, 0, "Initial predictions should be 0");
        assertEq(profile.correctPredictions, 0, "Initial correct predictions should be 0");
        assertEq(profile.totalVolume, 0, "Initial volume should be 0");
        assertEq(profile.connectedPlatforms.length, 0, "No platforms connected initially");

        console.log("Profile verified: Initial state correct");
        console.log("");

        // ============================================
        // STEP 2: Connect Platform
        // ============================================

        console.log("STEP 2: Connect DreamDEX Platform");
        console.log("----------------------------------------------");

        // Verify platform is active
        assertTrue(registry.isPlatformActive(dreamDEXPlatformId), "Platform should be active");

        // Connect platform
        vm.prank(alice);
        core.connectPlatform(dreamDEXPlatformId);

        console.log("Platform connected with ID:", dreamDEXPlatformId);

        // Verify connection
        assertTrue(core.isPlatformConnected(alice, dreamDEXPlatformId), "Platform should be connected");
        assertEq(core.getConnectedPlatformCount(alice), 1, "Should have 1 connected platform");

        uint256[] memory connectedPlatforms = core.getConnectedPlatforms(alice);
        assertEq(connectedPlatforms.length, 1, "Should return 1 platform");
        assertEq(connectedPlatforms[0], dreamDEXPlatformId, "Platform ID should match");

        console.log("Platform connection verified");
        console.log("");

        // ============================================
        // STEP 3: Import Predictions
        // ============================================

        console.log("STEP 3: Import Predictions");
        console.log("----------------------------------------------");

        // Test data: 50 predictions, 35 wins (70% win rate), 5 STT volume
        uint256 totalPredictions = 50;
        uint256 correctPredictions = 35;
        uint256 totalVolume = 5 ether;
        bytes32 proof = keccak256(abi.encodePacked(alice, dreamDEXPlatformId, block.timestamp));

        console.log("Importing:");
        console.log("  Total Predictions:", totalPredictions);
        console.log("  Correct Predictions:", correctPredictions);
        console.log("  Win Rate:", (correctPredictions * 100) / totalPredictions, "%");
        console.log("  Total Volume:", totalVolume / 1e18, "STT");

        // Import predictions
        vm.prank(alice);
        core.importPredictions(dreamDEXPlatformId, totalPredictions, correctPredictions, totalVolume, proof);

        console.log("Predictions imported successfully");

        // Verify profile updated
        profile = core.getUserProfile(alice);
        assertEq(profile.totalPredictions, totalPredictions, "Total predictions should match");
        assertEq(profile.correctPredictions, correctPredictions, "Correct predictions should match");
        assertEq(profile.totalVolume, totalVolume, "Total volume should match");

        console.log("Profile data verified");
        console.log("");

        // ============================================
        // STEP 4: Calculate VeritasScore
        // ============================================

        console.log("STEP 4: Calculate VeritasScore");
        console.log("----------------------------------------------");

        // Score should be auto-calculated during import
        uint256 veritasScore = profile.veritasScore;
        console.log("VeritasScore:", veritasScore);

        // Calculate expected score manually
        // Formula: VeritasScore = (winRate × 100) × sqrt(totalVolume) / 100
        // Win rate: 35/50 = 70% = 7000 basis points
        // Volume: 5 STT = 5e18 wei = 500 points (5e18 / 1e16)
        // sqrt(500) ≈ 22.36 ≈ 22
        // Score = (7000 × 22) / 100 = 1540
        uint256 expectedScore = calculator.calculateVeritasScore(totalPredictions, correctPredictions, totalVolume);
        console.log("Expected Score:", expectedScore);

        assertEq(veritasScore, expectedScore, "VeritasScore should match calculated value");

        // Score should be approximately 1,540 (may vary due to sqrt precision)
        assertGe(veritasScore, 1500, "Score should be at least 1,500");
        assertLe(veritasScore, 1600, "Score should be at most 1,600");

        console.log("VeritasScore calculation verified");
        console.log("");

        // ============================================
        // STEP 5: Verify Win Rate
        // ============================================

        console.log("STEP 5: Verify Win Rate");
        console.log("----------------------------------------------");

        uint256 winRate = core.getWinRate(alice);
        console.log("Win Rate (bps):", winRate);

        // Win rate should be 70% = 7000 basis points
        assertEq(winRate, 7000, "Win rate should be 70%");

        console.log("Win rate verified: 70%");
        console.log("");

        // ============================================
        // STEP 6: Verify NFT Metadata
        // ============================================

        console.log("STEP 6: Verify NFT Metadata");
        console.log("----------------------------------------------");

        IReputationNFT.NFTMetadata memory metadata = nft.getMetadata(tokenId);

        console.log("NFT Metadata:");
        console.log("  VeritasScore:", metadata.veritasScore);
        console.log("  Tier:", _tierToString(metadata.tier));
        console.log("  Total Predictions:", metadata.totalPredictions);
        console.log("  Correct Predictions:", metadata.correctPredictions);
        console.log("  Win Rate (bps):", metadata.winRate);
        console.log("  Total Volume:", metadata.totalVolume / 1e18, "STT");

        // Verify metadata matches profile
        assertEq(metadata.veritasScore, veritasScore, "Metadata score should match profile");
        assertEq(metadata.totalPredictions, totalPredictions, "Metadata predictions should match");
        assertEq(metadata.correctPredictions, correctPredictions, "Metadata correct predictions should match");
        assertEq(metadata.totalVolume, totalVolume, "Metadata volume should match");
        assertEq(metadata.winRate, winRate, "Metadata win rate should match");

        console.log("NFT metadata verified");
        console.log("");

        // ============================================
        // STEP 7: Verify NFT Tier
        // ============================================

        console.log("STEP 7: Verify NFT Tier");
        console.log("----------------------------------------------");

        IReputationNFT.ReputationTier tier = nft.getTier(tokenId);
        console.log("NFT Tier:", _tierToString(tier));

        // Score ~1,540 should be DIAMOND tier (900+ with new thresholds 0/200/400/650/900)
        assertEq(uint256(tier), uint256(IReputationNFT.ReputationTier.DIAMOND), "Tier should be DIAMOND");

        console.log("Tier verified: DIAMOND");
        console.log("");

        // ============================================
        // STEP 8: Verify TokenURI (SVG)
        // ============================================

        console.log("STEP 8: Verify TokenURI (SVG)");
        console.log("----------------------------------------------");

        string memory tokenURI = nft.tokenURI(tokenId);

        // Token URI should be a data URI with base64 encoded JSON
        assertTrue(bytes(tokenURI).length > 0, "Token URI should not be empty");

        // Check it starts with data:application/json;base64,
        bytes memory uriBytes = bytes(tokenURI);
        bytes memory prefix = bytes("data:application/json;base64,");

        bool hasCorrectPrefix = true;
        for (uint256 i = 0; i < prefix.length; i++) {
            if (uriBytes[i] != prefix[i]) {
                hasCorrectPrefix = false;
                break;
            }
        }
        assertTrue(hasCorrectPrefix, "Token URI should start with correct prefix");

        console.log("TokenURI format verified");
        console.log("TokenURI length:", bytes(tokenURI).length, "bytes");
        console.log("");

        // ============================================
        // STEP 9: Verify Soulbound (Cannot Transfer)
        // ============================================

        console.log("STEP 9: Verify Soulbound (Cannot Transfer)");
        console.log("----------------------------------------------");

        // Try to transfer NFT from Alice to Bob (should fail)
        vm.prank(alice);
        vm.expectRevert(IReputationNFT.TokenIsSoulbound.selector);
        nft.transferFrom(alice, bob, tokenId);

        console.log("Transfer blocked: NFT is soulbound");

        // Verify Alice still owns the NFT
        assertEq(nft.ownerOf(tokenId), alice, "Alice should still own the NFT");
        assertEq(nft.balanceOf(alice), 1, "Alice should still have 1 NFT");
        assertEq(nft.balanceOf(bob), 0, "Bob should have 0 NFTs");

        console.log("Soulbound property verified");
        console.log("");

        // ============================================
        // STEP 10: Additional Verifications
        // ============================================

        console.log("STEP 10: Additional Verifications");
        console.log("----------------------------------------------");

        // Verify can't register twice
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(VeritasCore.AlreadyRegistered.selector, alice));
        core.registerUser{value: MINT_FEE}();
        console.log("Double registration blocked");

        // Verify can't connect same platform twice
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(VeritasCore.PlatformAlreadyConnected.selector, dreamDEXPlatformId));
        core.connectPlatform(dreamDEXPlatformId);
        console.log("Double platform connection blocked");

        // Verify can't import duplicate batch (need to skip time first to pass rate limit)
        vm.warp(block.timestamp + 1 hours + 1);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(VeritasCore.BatchAlreadyImported.selector, proof));
        core.importPredictions(dreamDEXPlatformId, totalPredictions, correctPredictions, totalVolume, proof);
        console.log("Duplicate batch import blocked");

        // Verify score can be updated manually
        vm.prank(alice);
        core.updateVeritasScore(alice);
        console.log("Manual score update successful");

        console.log("");

        // ============================================
        // FINAL SUMMARY
        // ============================================

        console.log("==============================================");
        console.log("FINAL SUMMARY");
        console.log("==============================================");
        console.log("User: Alice");
        console.log("NFT Token ID:", tokenId);
        console.log("VeritasScore:", veritasScore);
        console.log("Tier:", _tierToString(tier));
        console.log("Total Predictions:", totalPredictions);
        console.log("Correct Predictions:", correctPredictions);
        console.log("Win Rate (bps):", winRate);
        console.log("Total Volume (wei):", totalVolume);
        console.log("Connected Platforms:", core.getConnectedPlatformCount(alice));
        console.log("==============================================");
        console.log("ALL TESTS PASSED!");
        console.log("==============================================\n");
    }

    // ============================================
    // Additional Test: Multiple Users
    // ============================================

    function test_FullUserJourney_MultipleUsers() public {
        console.log("\n==============================================");
        console.log("MULTIPLE USERS TEST");
        console.log("==============================================\n");

        // Register Alice and Bob
        vm.prank(alice);
        uint256 aliceTokenId = core.registerUser{value: MINT_FEE}();
        console.log("Alice registered with token ID:", aliceTokenId);

        vm.prank(bob);
        uint256 bobTokenId = core.registerUser{value: MINT_FEE}();
        console.log("Bob registered with token ID:", bobTokenId);

        // Connect platforms
        vm.prank(alice);
        core.connectPlatform(dreamDEXPlatformId);

        vm.prank(bob);
        core.connectPlatform(dreamDEXPlatformId);

        console.log("Both users connected to platform");

        // Alice: Good trader (75% win rate, 10 STT)
        bytes32 aliceProof = keccak256(abi.encodePacked(alice, "batch1"));
        vm.prank(alice);
        core.importPredictions(dreamDEXPlatformId, 100, 75, 10 ether, aliceProof);

        // Bob: Average trader (55% win rate, 2 STT)
        bytes32 bobProof = keccak256(abi.encodePacked(bob, "batch1"));
        vm.prank(bob);
        core.importPredictions(dreamDEXPlatformId, 100, 55, 2 ether, bobProof);

        console.log("");

        // Compare scores
        VeritasCore.UserProfile memory aliceProfile = core.getUserProfile(alice);
        VeritasCore.UserProfile memory bobProfile = core.getUserProfile(bob);

        console.log("Alice:");
        console.log("  VeritasScore:", aliceProfile.veritasScore);
        console.log("  Tier:", _tierToString(nft.getTier(aliceTokenId)));
        console.log("  Win Rate (bps):", core.getWinRate(alice));

        console.log("");

        console.log("Bob:");
        console.log("  VeritasScore:", bobProfile.veritasScore);
        console.log("  Tier:", _tierToString(nft.getTier(bobTokenId)));
        console.log("  Win Rate:", core.getWinRate(bob) / 100, "%");

        console.log("");

        // Alice should have higher score
        assertGt(aliceProfile.veritasScore, bobProfile.veritasScore, "Alice should have higher score than Bob");

        console.log("Comparison verified: Alice > Bob");
        console.log("==============================================\n");
    }

    // ============================================
    // Test: Tier Progression
    // ============================================

    function test_FullUserJourney_TierProgression() public {
        console.log("\n==============================================");
        console.log("TIER PROGRESSION TEST");
        console.log("==============================================\n");

        // Register Alice
        vm.prank(alice);
        uint256 tokenId = core.registerUser{value: MINT_FEE}();

        // Connect platform
        vm.prank(alice);
        core.connectPlatform(dreamDEXPlatformId);

        // Test BRONZE tier
        bytes32 proof1 = keccak256(abi.encodePacked(alice, uint256(1)));
        vm.prank(alice);
        core.importPredictions(dreamDEXPlatformId, 10, 6, 0.5 ether, proof1);
        console.log(
            "Import 1: Score =", core.getUserProfile(alice).veritasScore, "Tier =", _tierToString(nft.getTier(tokenId))
        );

        // Advance time for rate limit
        skip(1 hours + 1);

        // Test SILVER tier
        bytes32 proof2 = keccak256(abi.encodePacked(alice, uint256(2)));
        vm.prank(alice);
        core.importPredictions(dreamDEXPlatformId, 50, 35, 3 ether, proof2);
        console.log(
            "Import 2: Score =", core.getUserProfile(alice).veritasScore, "Tier =", _tierToString(nft.getTier(tokenId))
        );

        skip(1 hours + 1);

        // Test GOLD tier
        bytes32 proof3 = keccak256(abi.encodePacked(alice, uint256(3)));
        vm.prank(alice);
        core.importPredictions(dreamDEXPlatformId, 100, 75, 10 ether, proof3);
        console.log(
            "Import 3: Score =", core.getUserProfile(alice).veritasScore, "Tier =", _tierToString(nft.getTier(tokenId))
        );

        skip(1 hours + 1);

        // Test PLATINUM tier
        bytes32 proof4 = keccak256(abi.encodePacked(alice, uint256(4)));
        vm.prank(alice);
        core.importPredictions(dreamDEXPlatformId, 300, 240, 50 ether, proof4);
        console.log(
            "Import 4: Score =", core.getUserProfile(alice).veritasScore, "Tier =", _tierToString(nft.getTier(tokenId))
        );

        skip(1 hours + 1);

        // Test DIAMOND tier
        bytes32 proof5 = keccak256(abi.encodePacked(alice, uint256(5)));
        vm.prank(alice);
        core.importPredictions(dreamDEXPlatformId, 500, 425, 200 ether, proof5);
        console.log(
            "Import 5: Score =", core.getUserProfile(alice).veritasScore, "Tier =", _tierToString(nft.getTier(tokenId))
        );

        // Final score should be DIAMOND
        IReputationNFT.ReputationTier finalTier = nft.getTier(tokenId);
        assertEq(uint256(finalTier), uint256(IReputationNFT.ReputationTier.DIAMOND), "Final tier should be DIAMOND");

        console.log("\nTier progression verified: Reached DIAMOND");
        console.log("==============================================\n");
    }

    // ============================================
    // Helper Functions
    // ============================================

    function _tierToString(IReputationNFT.ReputationTier tier) internal pure returns (string memory) {
        if (tier == IReputationNFT.ReputationTier.BRONZE) return "BRONZE";
        if (tier == IReputationNFT.ReputationTier.SILVER) return "SILVER";
        if (tier == IReputationNFT.ReputationTier.GOLD) return "GOLD";
        if (tier == IReputationNFT.ReputationTier.PLATINUM) return "PLATINUM";
        if (tier == IReputationNFT.ReputationTier.DIAMOND) return "DIAMOND";
        return "UNKNOWN";
    }
}
