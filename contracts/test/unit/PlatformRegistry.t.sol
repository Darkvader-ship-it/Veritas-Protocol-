// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "@forge-std/Test.sol";
import {PlatformRegistry} from "../../src/core/PlatformRegistry.sol";

/**
 * @title PlatformRegistryTest
 * @notice Comprehensive tests for the PlatformRegistry contract
 */
contract PlatformRegistryTest is Test {
    PlatformRegistry public registry;

    // Test addresses
    address public owner = address(1);
    address public unauthorized = address(2);
    address public adapter1 = address(100);
    address public adapter2 = address(101);
    address public adapter3 = address(102);

    // Events to test
    event PlatformAdded(
        uint256 indexed platformId, string name, address indexed adapter, PlatformRegistry.PlatformType platformType
    );
    event PlatformUpdated(uint256 indexed platformId, string name, address indexed adapter);
    event PlatformDeactivated(uint256 indexed platformId, string name);
    event PlatformReactivated(uint256 indexed platformId, string name);

    function setUp() public {
        vm.prank(owner);
        registry = new PlatformRegistry();
    }

    // ============================================
    // Deployment Tests
    // ============================================

    function test_Deployment() public view {
        assertEq(registry.owner(), owner, "Owner should be correct");
        assertEq(registry.getPlatformCount(), 0, "Initial platform count should be 0");
        assertEq(registry.getActivePlatformCount(), 0, "Initial active count should be 0");
    }

    // ============================================
    // Add Platform Tests
    // ============================================

    function test_AddPlatform() public {
        vm.expectEmit(true, true, false, true);
        emit PlatformAdded(1, "DreamDEX", adapter1, PlatformRegistry.PlatformType.BINARY_PREDICTION);

        vm.prank(owner);
        uint256 platformId = registry.addPlatform(
            "DreamDEX",
            adapter1,
            "https://dreamdex.finance",
            PlatformRegistry.PlatformType.BINARY_PREDICTION
        );

        assertEq(platformId, 1, "First platform ID should be 1");
        assertEq(registry.getPlatformCount(), 1, "Platform count should be 1");
        assertEq(registry.getActivePlatformCount(), 1, "Active count should be 1");
    }

    function test_AddPlatform_Details() public {
        vm.prank(owner);
        uint256 platformId = registry.addPlatform(
            "DreamDEX",
            adapter1,
            "https://dreamdex.finance",
            PlatformRegistry.PlatformType.BINARY_PREDICTION
        );

        PlatformRegistry.Platform memory platform = registry.getPlatform(platformId);

        assertEq(platform.id, 1, "Platform ID should be 1");
        assertEq(platform.name, "DreamDEX", "Name should match");
        assertEq(platform.adapter, adapter1, "Adapter should match");
        assertEq(platform.dataSource, "https://dreamdex.finance", "Data source should match");
        assertEq(
            uint256(platform.platformType),
            uint256(PlatformRegistry.PlatformType.BINARY_PREDICTION),
            "Type should match"
        );
        assertTrue(platform.isActive, "Should be active");
        assertEq(platform.registeredAt, block.timestamp, "Registration timestamp should be current");
        assertEq(platform.updatedAt, block.timestamp, "Update timestamp should be current");
    }

    function test_AddPlatform_Multiple() public {
        vm.startPrank(owner);

        uint256 id1 = registry.addPlatform(
            "DreamDEX",
            adapter1,
            "https://dreamdex.finance",
            PlatformRegistry.PlatformType.BINARY_PREDICTION
        );

        uint256 id2 = registry.addPlatform(
            "Polymarket", adapter2, "https://polymarket.com", PlatformRegistry.PlatformType.CATEGORICAL
        );

        uint256 id3 = registry.addPlatform(
            "Sportsbet", adapter3, "https://sportsbet.io", PlatformRegistry.PlatformType.SPORTS_BETTING
        );

        vm.stopPrank();

        assertEq(id1, 1, "First ID should be 1");
        assertEq(id2, 2, "Second ID should be 2");
        assertEq(id3, 3, "Third ID should be 3");
        assertEq(registry.getPlatformCount(), 3, "Should have 3 platforms");
        assertEq(registry.getActivePlatformCount(), 3, "Should have 3 active platforms");
    }

    function test_AddPlatform_RevertWhen_NotOwner() public {
        vm.expectRevert();
        vm.prank(unauthorized);
        registry.addPlatform(
            "DreamDEX",
            adapter1,
            "https://dreamdex.finance",
            PlatformRegistry.PlatformType.BINARY_PREDICTION
        );
    }

    function test_AddPlatform_RevertWhen_ZeroAddress() public {
        vm.expectRevert(abi.encodeWithSelector(PlatformRegistry.InvalidAdapter.selector, address(0)));
        vm.prank(owner);
        registry.addPlatform(
            "DreamDEX",
            address(0),
            "https://dreamdex.finance",
            PlatformRegistry.PlatformType.BINARY_PREDICTION
        );
    }

    function test_AddPlatform_RevertWhen_DuplicateAdapter() public {
        vm.startPrank(owner);

        registry.addPlatform(
            "DreamDEX",
            adapter1,
            "https://dreamdex.finance",
            PlatformRegistry.PlatformType.BINARY_PREDICTION
        );

        vm.expectRevert(abi.encodeWithSelector(PlatformRegistry.PlatformAlreadyExists.selector, adapter1));
        registry.addPlatform(
            "Duplicate", adapter1, "https://duplicate.com", PlatformRegistry.PlatformType.BINARY_PREDICTION
        );

        vm.stopPrank();
    }

    // ============================================
    // Update Platform Tests
    // ============================================

    function test_UpdatePlatform() public {
        vm.startPrank(owner);

        uint256 platformId = registry.addPlatform(
            "DreamDEX",
            adapter1,
            "https://dreamdex.finance",
            PlatformRegistry.PlatformType.BINARY_PREDICTION
        );

        vm.expectEmit(true, true, false, true);
        emit PlatformUpdated(platformId, "DreamDEX V2", adapter1);

        registry.updatePlatform(
            platformId,
            "DreamDEX V2",
            adapter1,
            "https://dreamdex.finance/v2",
            PlatformRegistry.PlatformType.BINARY_PREDICTION
        );

        vm.stopPrank();

        PlatformRegistry.Platform memory platform = registry.getPlatform(platformId);

        assertEq(platform.name, "DreamDEX V2", "Name should be updated");
        assertEq(platform.dataSource, "https://dreamdex.finance/v2", "Data source should be updated");
    }

    function test_UpdatePlatform_ChangeAdapter() public {
        vm.startPrank(owner);

        uint256 platformId = registry.addPlatform(
            "DreamDEX",
            adapter1,
            "https://dreamdex.finance",
            PlatformRegistry.PlatformType.BINARY_PREDICTION
        );

        // Change adapter
        registry.updatePlatform(
            platformId,
            "DreamDEX",
            adapter2,
            "https://dreamdex.finance",
            PlatformRegistry.PlatformType.BINARY_PREDICTION
        );

        vm.stopPrank();

        PlatformRegistry.Platform memory platform = registry.getPlatform(platformId);

        assertEq(platform.adapter, adapter2, "Adapter should be updated");
        assertEq(registry.getPlatformByAdapter(adapter2), platformId, "New adapter should map to platform");
        assertEq(registry.getPlatformByAdapter(adapter1), 0, "Old adapter should not map to platform");
    }

    function test_UpdatePlatform_RevertWhen_NotOwner() public {
        vm.prank(owner);
        uint256 platformId = registry.addPlatform(
            "DreamDEX",
            adapter1,
            "https://dreamdex.finance",
            PlatformRegistry.PlatformType.BINARY_PREDICTION
        );

        vm.expectRevert();
        vm.prank(unauthorized);
        registry.updatePlatform(
            platformId, "Updated", adapter1, "https://updated.com", PlatformRegistry.PlatformType.BINARY_PREDICTION
        );
    }

    function test_UpdatePlatform_RevertWhen_PlatformNotFound() public {
        vm.expectRevert(abi.encodeWithSelector(PlatformRegistry.PlatformNotFound.selector, 999));
        vm.prank(owner);
        registry.updatePlatform(
            999, "NotFound", adapter1, "https://notfound.com", PlatformRegistry.PlatformType.BINARY_PREDICTION
        );
    }

    function test_UpdatePlatform_RevertWhen_NewAdapterAlreadyExists() public {
        vm.startPrank(owner);

        uint256 id1 = registry.addPlatform(
            "Platform1", adapter1, "https://platform1.com", PlatformRegistry.PlatformType.BINARY_PREDICTION
        );

        registry.addPlatform("Platform2", adapter2, "https://platform2.com", PlatformRegistry.PlatformType.CATEGORICAL);

        // Try to change platform1's adapter to adapter2 (which is already used)
        vm.expectRevert(abi.encodeWithSelector(PlatformRegistry.PlatformAlreadyExists.selector, adapter2));
        registry.updatePlatform(
            id1, "Platform1", adapter2, "https://platform1.com", PlatformRegistry.PlatformType.BINARY_PREDICTION
        );

        vm.stopPrank();
    }

    // ============================================
    // Deactivate/Reactivate Tests
    // ============================================

    function test_DeactivatePlatform() public {
        vm.startPrank(owner);

        uint256 platformId = registry.addPlatform(
            "DreamDEX",
            adapter1,
            "https://dreamdex.finance",
            PlatformRegistry.PlatformType.BINARY_PREDICTION
        );

        vm.expectEmit(true, false, false, true);
        emit PlatformDeactivated(platformId, "DreamDEX");

        registry.deactivatePlatform(platformId);

        vm.stopPrank();

        PlatformRegistry.Platform memory platform = registry.getPlatform(platformId);
        assertFalse(platform.isActive, "Platform should be inactive");
        assertEq(registry.getActivePlatformCount(), 0, "Active count should be 0");
    }

    function test_ReactivatePlatform() public {
        vm.startPrank(owner);

        uint256 platformId = registry.addPlatform(
            "DreamDEX",
            adapter1,
            "https://dreamdex.finance",
            PlatformRegistry.PlatformType.BINARY_PREDICTION
        );

        registry.deactivatePlatform(platformId);

        vm.expectEmit(true, false, false, true);
        emit PlatformReactivated(platformId, "DreamDEX");

        registry.reactivatePlatform(platformId);

        vm.stopPrank();

        PlatformRegistry.Platform memory platform = registry.getPlatform(platformId);
        assertTrue(platform.isActive, "Platform should be active");
        assertEq(registry.getActivePlatformCount(), 1, "Active count should be 1");
    }

    function test_DeactivatePlatform_RevertWhen_NotOwner() public {
        vm.prank(owner);
        uint256 platformId = registry.addPlatform(
            "DreamDEX",
            adapter1,
            "https://dreamdex.finance",
            PlatformRegistry.PlatformType.BINARY_PREDICTION
        );

        vm.expectRevert();
        vm.prank(unauthorized);
        registry.deactivatePlatform(platformId);
    }

    function test_DeactivatePlatform_RevertWhen_AlreadyInactive() public {
        vm.startPrank(owner);

        uint256 platformId = registry.addPlatform(
            "DreamDEX",
            adapter1,
            "https://dreamdex.finance",
            PlatformRegistry.PlatformType.BINARY_PREDICTION
        );

        registry.deactivatePlatform(platformId);

        vm.expectRevert(abi.encodeWithSelector(PlatformRegistry.PlatformAlreadyInactive.selector, platformId));
        registry.deactivatePlatform(platformId);

        vm.stopPrank();
    }

    function test_ReactivatePlatform_RevertWhen_AlreadyActive() public {
        vm.startPrank(owner);

        uint256 platformId = registry.addPlatform(
            "DreamDEX",
            adapter1,
            "https://dreamdex.finance",
            PlatformRegistry.PlatformType.BINARY_PREDICTION
        );

        vm.expectRevert(abi.encodeWithSelector(PlatformRegistry.PlatformAlreadyActive.selector, platformId));
        registry.reactivatePlatform(platformId);

        vm.stopPrank();
    }

    // ============================================
    // Query Tests
    // ============================================

    function test_GetPlatform() public {
        vm.prank(owner);
        uint256 platformId = registry.addPlatform(
            "DreamDEX",
            adapter1,
            "https://dreamdex.finance",
            PlatformRegistry.PlatformType.BINARY_PREDICTION
        );

        PlatformRegistry.Platform memory platform = registry.getPlatform(platformId);

        assertEq(platform.id, platformId, "Platform ID should match");
        assertEq(platform.name, "DreamDEX", "Name should match");
    }

    function test_GetPlatform_RevertWhen_NotFound() public {
        vm.expectRevert(abi.encodeWithSelector(PlatformRegistry.PlatformNotFound.selector, 999));
        registry.getPlatform(999);
    }

    function test_GetPlatformByAdapter() public {
        vm.prank(owner);
        uint256 platformId = registry.addPlatform(
            "DreamDEX",
            adapter1,
            "https://dreamdex.finance",
            PlatformRegistry.PlatformType.BINARY_PREDICTION
        );

        assertEq(registry.getPlatformByAdapter(adapter1), platformId, "Should return correct platform ID");
        assertEq(registry.getPlatformByAdapter(adapter2), 0, "Should return 0 for unregistered adapter");
    }

    function test_GetActivePlatforms() public {
        vm.startPrank(owner);

        registry.addPlatform(
            "Platform1", adapter1, "https://platform1.com", PlatformRegistry.PlatformType.BINARY_PREDICTION
        );

        uint256 id2 = registry.addPlatform(
            "Platform2", adapter2, "https://platform2.com", PlatformRegistry.PlatformType.CATEGORICAL
        );

        registry.addPlatform(
            "Platform3", adapter3, "https://platform3.com", PlatformRegistry.PlatformType.SPORTS_BETTING
        );

        // Deactivate platform 2
        registry.deactivatePlatform(id2);

        vm.stopPrank();

        PlatformRegistry.Platform[] memory activePlatforms = registry.getActivePlatforms();

        assertEq(activePlatforms.length, 2, "Should have 2 active platforms");
        assertEq(activePlatforms[0].name, "Platform1", "First active platform should be Platform1");
        assertEq(activePlatforms[1].name, "Platform3", "Second active platform should be Platform3");
    }

    function test_GetAllPlatforms() public {
        vm.startPrank(owner);

        registry.addPlatform(
            "Platform1", adapter1, "https://platform1.com", PlatformRegistry.PlatformType.BINARY_PREDICTION
        );

        uint256 id2 = registry.addPlatform(
            "Platform2", adapter2, "https://platform2.com", PlatformRegistry.PlatformType.CATEGORICAL
        );

        registry.deactivatePlatform(id2);

        vm.stopPrank();

        PlatformRegistry.Platform[] memory allPlatforms = registry.getAllPlatforms();

        assertEq(allPlatforms.length, 2, "Should return all platforms");
        assertTrue(allPlatforms[0].isActive, "Platform1 should be active");
        assertFalse(allPlatforms[1].isActive, "Platform2 should be inactive");
    }

    function test_GetPlatformCount() public {
        assertEq(registry.getPlatformCount(), 0, "Initial count should be 0");

        vm.startPrank(owner);

        registry.addPlatform(
            "Platform1", adapter1, "https://platform1.com", PlatformRegistry.PlatformType.BINARY_PREDICTION
        );

        assertEq(registry.getPlatformCount(), 1, "Count should be 1");

        registry.addPlatform("Platform2", adapter2, "https://platform2.com", PlatformRegistry.PlatformType.CATEGORICAL);

        assertEq(registry.getPlatformCount(), 2, "Count should be 2");

        vm.stopPrank();
    }

    function test_IsPlatformActive() public {
        vm.startPrank(owner);

        uint256 platformId = registry.addPlatform(
            "Platform1", adapter1, "https://platform1.com", PlatformRegistry.PlatformType.BINARY_PREDICTION
        );

        assertTrue(registry.isPlatformActive(platformId), "Platform should be active");

        registry.deactivatePlatform(platformId);

        assertFalse(registry.isPlatformActive(platformId), "Platform should be inactive");

        vm.stopPrank();

        assertFalse(registry.isPlatformActive(999), "Non-existent platform should return false");
    }

    function test_IsAdapterRegistered() public {
        assertFalse(registry.isAdapterRegistered(adapter1), "Adapter should not be registered initially");

        vm.prank(owner);
        registry.addPlatform(
            "Platform1", adapter1, "https://platform1.com", PlatformRegistry.PlatformType.BINARY_PREDICTION
        );

        assertTrue(registry.isAdapterRegistered(adapter1), "Adapter should be registered");
        assertFalse(registry.isAdapterRegistered(adapter2), "Other adapter should not be registered");
    }

    function test_GetPlatformsByType() public {
        vm.startPrank(owner);

        registry.addPlatform(
            "Binary1", adapter1, "https://binary1.com", PlatformRegistry.PlatformType.BINARY_PREDICTION
        );

        registry.addPlatform(
            "Sports1", address(200), "https://sports1.com", PlatformRegistry.PlatformType.SPORTS_BETTING
        );

        registry.addPlatform(
            "Binary2", adapter2, "https://binary2.com", PlatformRegistry.PlatformType.BINARY_PREDICTION
        );

        registry.addPlatform("Categorical1", adapter3, "https://cat1.com", PlatformRegistry.PlatformType.CATEGORICAL);

        vm.stopPrank();

        PlatformRegistry.Platform[] memory binaryPlatforms =
            registry.getPlatformsByType(PlatformRegistry.PlatformType.BINARY_PREDICTION);

        assertEq(binaryPlatforms.length, 2, "Should have 2 binary platforms");
        assertEq(binaryPlatforms[0].name, "Binary1", "First binary platform should be Binary1");
        assertEq(binaryPlatforms[1].name, "Binary2", "Second binary platform should be Binary2");

        PlatformRegistry.Platform[] memory sportsPlatforms =
            registry.getPlatformsByType(PlatformRegistry.PlatformType.SPORTS_BETTING);

        assertEq(sportsPlatforms.length, 1, "Should have 1 sports platform");
        assertEq(sportsPlatforms[0].name, "Sports1", "Sports platform should be Sports1");
    }

    // ============================================
    // Helper Function Tests
    // ============================================

    function test_GetPlatformTypeName() public view {
        assertEq(
            registry.getPlatformTypeName(PlatformRegistry.PlatformType.BINARY_PREDICTION),
            "Binary Prediction",
            "Binary type name should match"
        );
        assertEq(
            registry.getPlatformTypeName(PlatformRegistry.PlatformType.SPORTS_BETTING),
            "Sports Betting",
            "Sports type name should match"
        );
        assertEq(
            registry.getPlatformTypeName(PlatformRegistry.PlatformType.CATEGORICAL),
            "Categorical",
            "Categorical type name should match"
        );
        assertEq(
            registry.getPlatformTypeName(PlatformRegistry.PlatformType.CUSTOM),
            "Custom",
            "Custom type name should match"
        );
    }

    // ============================================
    // Integration Tests
    // ============================================

    function test_Integration_FullLifecycle() public {
        vm.startPrank(owner);

        // Add platforms
        uint256 id1 = registry.addPlatform(
            "DreamDEX",
            adapter1,
            "https://dreamdex.finance",
            PlatformRegistry.PlatformType.BINARY_PREDICTION
        );

        uint256 id2 = registry.addPlatform(
            "Polymarket", adapter2, "https://polymarket.com", PlatformRegistry.PlatformType.CATEGORICAL
        );

        assertEq(registry.getPlatformCount(), 2, "Should have 2 platforms");
        assertEq(registry.getActivePlatformCount(), 2, "Should have 2 active platforms");

        // Update platform
        registry.updatePlatform(
            id1,
            "DreamDEX V2",
            adapter1,
            "https://dreamdex.finance/v2",
            PlatformRegistry.PlatformType.BINARY_PREDICTION
        );

        PlatformRegistry.Platform memory updated = registry.getPlatform(id1);
        assertEq(updated.name, "DreamDEX V2", "Name should be updated");

        // Deactivate platform
        registry.deactivatePlatform(id2);
        assertEq(registry.getActivePlatformCount(), 1, "Should have 1 active platform");

        // Reactivate platform
        registry.reactivatePlatform(id2);
        assertEq(registry.getActivePlatformCount(), 2, "Should have 2 active platforms again");

        vm.stopPrank();
    }
}
