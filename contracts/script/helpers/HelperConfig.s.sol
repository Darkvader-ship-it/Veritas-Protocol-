// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "@forge-std/Script.sol";

/**
 * @title HelperConfig
 * @notice Network-specific configurations for Veritas deployment — Somnia only
 * @dev Provides addresses and parameters for Somnia Shannon/Mainnet
 * @author Veritas Team
 */
contract HelperConfig is Script {
    struct NetworkConfig {
        address dreamDEXAdapter; // placeholder for DreamDEX Event Contracts adapter
        string networkName;
        uint256 chainId;
        string rpcUrl;
        string explorerUrl;
        string explorerApiUrl;
    }

    NetworkConfig public activeNetworkConfig;

    function getActiveNetworkConfig() public view returns (NetworkConfig memory) {
        return activeNetworkConfig;
    }

    uint256 constant SOMNIA_SHANNON_CHAIN_ID = 50312;
    uint256 constant SOMNIA_MAINNET_CHAIN_ID = 5031;
    uint256 constant LOCAL_CHAIN_ID = 31337;

    address constant DREAMDEX_ADAPTER_SHANNON = 0x0000000000000000000000000000000000000000; // set after DreamDEX deploy
    address constant DREAMDEX_ADAPTER_MAINNET = 0x0000000000000000000000000000000000000000;

    constructor() {
        if (block.chainid == SOMNIA_MAINNET_CHAIN_ID) {
            activeNetworkConfig = getSomniaMainnetConfig();
        } else if (block.chainid == SOMNIA_SHANNON_CHAIN_ID) {
            activeNetworkConfig = getSomniaShannonConfig();
        } else {
            activeNetworkConfig = getAnvilConfig();
        }
    }

    function getSomniaMainnetConfig() public pure returns (NetworkConfig memory config) {
        config = NetworkConfig({
            dreamDEXAdapter: DREAMDEX_ADAPTER_MAINNET,
            networkName: "Somnia Mainnet",
            chainId: SOMNIA_MAINNET_CHAIN_ID,
            rpcUrl: "https://api.infra.mainnet.somnia.network",
            explorerUrl: "https://explorer.somnia.network",
            explorerApiUrl: "https://explorer.somnia.network/api"
        });
    }

    function getSomniaShannonConfig() public pure returns (NetworkConfig memory config) {
        config = NetworkConfig({
            dreamDEXAdapter: DREAMDEX_ADAPTER_SHANNON,
            networkName: "Somnia Shannon",
            chainId: SOMNIA_SHANNON_CHAIN_ID,
            rpcUrl: "https://dream-rpc.somnia.network",
            explorerUrl: "https://shannon-explorer.somnia.network",
            explorerApiUrl: "https://shannon-explorer.somnia.network/api"
        });
    }

    function getAnvilConfig() public pure returns (NetworkConfig memory config) {
        config = NetworkConfig({
            dreamDEXAdapter: address(0),
            networkName: "Anvil Local",
            chainId: LOCAL_CHAIN_ID,
            rpcUrl: "http://localhost:8545",
            explorerUrl: "http://localhost:8545",
            explorerApiUrl: ""
        });
    }

    function getConfigByChainId(uint256 chainId) public pure returns (NetworkConfig memory config) {
        if (chainId == SOMNIA_MAINNET_CHAIN_ID) {
            return getSomniaMainnetConfig();
        } else if (chainId == SOMNIA_SHANNON_CHAIN_ID) {
            return getSomniaShannonConfig();
        } else {
            return getAnvilConfig();
        }
    }

    function isLiveNetwork() public view returns (bool) {
        return block.chainid == SOMNIA_MAINNET_CHAIN_ID || block.chainid == SOMNIA_SHANNON_CHAIN_ID;
    }

    function getNetworkName() public view returns (string memory) {
        return activeNetworkConfig.networkName;
    }

    function getDreamDEXAdapterAddress() public view returns (address) {
        return activeNetworkConfig.dreamDEXAdapter;
    }
}
