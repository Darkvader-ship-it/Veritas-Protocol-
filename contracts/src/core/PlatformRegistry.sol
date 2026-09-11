// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PlatformRegistry
 * @notice Registry for managing prediction market platform adapters
 * @dev Centralized registry for scalable platform management
 * @author Veritas Team
 */
contract PlatformRegistry is Ownable {
    /**
     * @notice Enum representing types of prediction markets
     */
    enum PlatformType {
        BINARY_PREDICTION, // Yes/No predictions (e.g., DreamDEX)
        SPORTS_BETTING, // Sports betting markets
        CATEGORICAL, // Multiple outcome predictions
        CUSTOM // Custom platform types
    }

    /**
     * @notice Struct containing platform information
     * @param id Unique platform identifier
     * @param name Platform name (e.g., "DreamDEX")
     * @param adapter Address of the platform adapter contract
     * @param dataSource URL or identifier for data source
     * @param platformType Type of prediction market
     * @param isActive Whether the platform is currently active
     * @param registeredAt Timestamp when platform was registered
     * @param updatedAt Timestamp of last update
     */
    struct Platform {
        uint256 id;
        string name;
        address adapter;
        string dataSource;
        PlatformType platformType;
        bool isActive;
        uint256 registeredAt;
        uint256 updatedAt;
    }

    // Platform ID counter (starts at 1)
    uint256 private _nextPlatformId = 1;

    // Mapping from platform ID to Platform
    mapping(uint256 => Platform) private _platforms;

    // Mapping from adapter address to platform ID (for quick lookups)
    mapping(address => uint256) private _adapterToPlatformId;

    // Array of all platform IDs (for iteration)
    uint256[] private _allPlatformIds;

    // ============================================
    // Events
    // ============================================

    /**
     * @notice Emitted when a new platform is registered
     * @param platformId ID of the registered platform
     * @param name Name of the platform
     * @param adapter Address of the adapter contract
     * @param platformType Type of platform
     */
    event PlatformAdded(uint256 indexed platformId, string name, address indexed adapter, PlatformType platformType);

    /**
     * @notice Emitted when a platform is updated
     * @param platformId ID of the updated platform
     * @param name Updated name
     * @param adapter Updated adapter address
     */
    event PlatformUpdated(uint256 indexed platformId, string name, address indexed adapter);

    /**
     * @notice Emitted when a platform is deactivated
     * @param platformId ID of the deactivated platform
     * @param name Name of the platform
     */
    event PlatformDeactivated(uint256 indexed platformId, string name);

    /**
     * @notice Emitted when a platform is reactivated
     * @param platformId ID of the reactivated platform
     * @param name Name of the platform
     */
    event PlatformReactivated(uint256 indexed platformId, string name);

    // ============================================
    // Errors
    // ============================================

    error PlatformNotFound(uint256 platformId);
    error PlatformAlreadyExists(address adapter);
    error InvalidAdapter(address adapter);
    error InvalidPlatformId(uint256 platformId);
    error PlatformAlreadyActive(uint256 platformId);
    error PlatformAlreadyInactive(uint256 platformId);

    // ============================================
    // Constructor
    // ============================================

    constructor() Ownable(msg.sender) {}

    // ============================================
    // Platform Management
    // ============================================

    /**
     * @notice Registers a new prediction market platform
     * @dev Can only be called by contract owner
     * @param name Name of the platform
     * @param adapter Address of the platform adapter contract
     * @param dataSource URL or identifier for data source
     * @param platformType Type of prediction market
     * @return platformId The ID of the newly registered platform
     */
    function addPlatform(string memory name, address adapter, string memory dataSource, PlatformType platformType)
        external
        onlyOwner
        returns (uint256 platformId)
    {
        // Validate adapter address
        if (adapter == address(0)) {
            revert InvalidAdapter(adapter);
        }

        // Check if adapter is already registered
        if (_adapterToPlatformId[adapter] != 0) {
            revert PlatformAlreadyExists(adapter);
        }

        // Create new platform
        platformId = _nextPlatformId++;

        _platforms[platformId] = Platform({
            id: platformId,
            name: name,
            adapter: adapter,
            dataSource: dataSource,
            platformType: platformType,
            isActive: true,
            registeredAt: block.timestamp,
            updatedAt: block.timestamp
        });

        // Store adapter mapping
        _adapterToPlatformId[adapter] = platformId;

        // Add to platform IDs array
        _allPlatformIds.push(platformId);

        emit PlatformAdded(platformId, name, adapter, platformType);

        return platformId;
    }

    /**
     * @notice Updates an existing platform
     * @dev Can only be called by contract owner
     * @param platformId ID of the platform to update
     * @param name Updated name
     * @param adapter Updated adapter address
     * @param dataSource Updated data source
     * @param platformType Updated platform type
     */
    function updatePlatform(
        uint256 platformId,
        string memory name,
        address adapter,
        string memory dataSource,
        PlatformType platformType
    ) external onlyOwner {
        // Check if platform exists
        if (_platforms[platformId].id == 0) {
            revert PlatformNotFound(platformId);
        }

        // Validate adapter address
        if (adapter == address(0)) {
            revert InvalidAdapter(adapter);
        }

        Platform storage platform = _platforms[platformId];

        // If adapter address is changing, update mapping
        if (platform.adapter != adapter) {
            // Check if new adapter is already registered
            if (_adapterToPlatformId[adapter] != 0) {
                revert PlatformAlreadyExists(adapter);
            }

            // Remove old adapter mapping
            delete _adapterToPlatformId[platform.adapter];

            // Add new adapter mapping
            _adapterToPlatformId[adapter] = platformId;
        }

        // Update platform details
        platform.name = name;
        platform.adapter = adapter;
        platform.dataSource = dataSource;
        platform.platformType = platformType;
        platform.updatedAt = block.timestamp;

        emit PlatformUpdated(platformId, name, adapter);
    }

    /**
     * @notice Deactivates a platform
     * @dev Can only be called by contract owner
     * @param platformId ID of the platform to deactivate
     */
    function deactivatePlatform(uint256 platformId) external onlyOwner {
        // Check if platform exists
        if (_platforms[platformId].id == 0) {
            revert PlatformNotFound(platformId);
        }

        Platform storage platform = _platforms[platformId];

        // Check if already inactive
        if (!platform.isActive) {
            revert PlatformAlreadyInactive(platformId);
        }

        platform.isActive = false;
        platform.updatedAt = block.timestamp;

        emit PlatformDeactivated(platformId, platform.name);
    }

    /**
     * @notice Reactivates a platform
     * @dev Can only be called by contract owner
     * @param platformId ID of the platform to reactivate
     */
    function reactivatePlatform(uint256 platformId) external onlyOwner {
        // Check if platform exists
        if (_platforms[platformId].id == 0) {
            revert PlatformNotFound(platformId);
        }

        Platform storage platform = _platforms[platformId];

        // Check if already active
        if (platform.isActive) {
            revert PlatformAlreadyActive(platformId);
        }

        platform.isActive = true;
        platform.updatedAt = block.timestamp;

        emit PlatformReactivated(platformId, platform.name);
    }

    // ============================================
    // Platform Queries
    // ============================================

    /**
     * @notice Gets platform information by ID
     * @param platformId ID of the platform
     * @return platform Platform struct
     */
    function getPlatform(uint256 platformId) external view returns (Platform memory platform) {
        platform = _platforms[platformId];

        // Check if platform exists
        if (platform.id == 0) {
            revert PlatformNotFound(platformId);
        }

        return platform;
    }

    /**
     * @notice Gets platform ID by adapter address
     * @param adapter Address of the adapter
     * @return platformId Platform ID (0 if not found)
     */
    function getPlatformByAdapter(address adapter) external view returns (uint256 platformId) {
        return _adapterToPlatformId[adapter];
    }

    /**
     * @notice Gets all active platforms
     * @return platforms Array of active platforms
     */
    function getActivePlatforms() external view returns (Platform[] memory platforms) {
        // Count active platforms
        uint256 activeCount = 0;
        for (uint256 i = 0; i < _allPlatformIds.length; i++) {
            if (_platforms[_allPlatformIds[i]].isActive) {
                activeCount++;
            }
        }

        // Create array of active platforms
        platforms = new Platform[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < _allPlatformIds.length; i++) {
            uint256 platformId = _allPlatformIds[i];
            if (_platforms[platformId].isActive) {
                platforms[index] = _platforms[platformId];
                index++;
            }
        }

        return platforms;
    }

    /**
     * @notice Gets all platforms (active and inactive)
     * @return platforms Array of all platforms
     */
    function getAllPlatforms() external view returns (Platform[] memory platforms) {
        platforms = new Platform[](_allPlatformIds.length);

        for (uint256 i = 0; i < _allPlatformIds.length; i++) {
            platforms[i] = _platforms[_allPlatformIds[i]];
        }

        return platforms;
    }

    /**
     * @notice Gets the total number of registered platforms
     * @return count Total number of platforms
     */
    function getPlatformCount() external view returns (uint256 count) {
        return _allPlatformIds.length;
    }

    /**
     * @notice Gets the number of active platforms
     * @return count Number of active platforms
     */
    function getActivePlatformCount() external view returns (uint256 count) {
        uint256 activeCount = 0;
        for (uint256 i = 0; i < _allPlatformIds.length; i++) {
            if (_platforms[_allPlatformIds[i]].isActive) {
                activeCount++;
            }
        }
        return activeCount;
    }

    /**
     * @notice Checks if a platform is active
     * @param platformId ID of the platform
     * @return isActive True if platform is active
     */
    function isPlatformActive(uint256 platformId) external view returns (bool isActive) {
        Platform memory platform = _platforms[platformId];

        // Return false if platform doesn't exist
        if (platform.id == 0) {
            return false;
        }

        return platform.isActive;
    }

    /**
     * @notice Checks if an adapter is registered
     * @param adapter Address of the adapter
     * @return isRegistered True if adapter is registered
     */
    function isAdapterRegistered(address adapter) external view returns (bool isRegistered) {
        return _adapterToPlatformId[adapter] != 0;
    }

    /**
     * @notice Gets platforms by type
     * @param platformType Type of platforms to retrieve
     * @return platforms Array of platforms matching the type
     */
    function getPlatformsByType(PlatformType platformType) external view returns (Platform[] memory platforms) {
        // Count platforms of this type
        uint256 typeCount = 0;
        for (uint256 i = 0; i < _allPlatformIds.length; i++) {
            if (_platforms[_allPlatformIds[i]].platformType == platformType) {
                typeCount++;
            }
        }

        // Create array
        platforms = new Platform[](typeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < _allPlatformIds.length; i++) {
            uint256 platformId = _allPlatformIds[i];
            if (_platforms[platformId].platformType == platformType) {
                platforms[index] = _platforms[platformId];
                index++;
            }
        }

        return platforms;
    }

    // ============================================
    // Helper Functions
    // ============================================

    /**
     * @notice Gets the name of a platform type
     * @param platformType The platform type
     * @return name String name of the platform type
     */
    function getPlatformTypeName(PlatformType platformType) external pure returns (string memory name) {
        if (platformType == PlatformType.BINARY_PREDICTION) return "Binary Prediction";
        if (platformType == PlatformType.SPORTS_BETTING) return "Sports Betting";
        if (platformType == PlatformType.CATEGORICAL) return "Categorical";
        return "Custom";
    }
}
