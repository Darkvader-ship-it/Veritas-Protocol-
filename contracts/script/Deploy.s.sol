// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "@forge-std/Script.sol";
import {ReputationNFT} from "../src/core/ReputationNFT.sol";
import {ScoreCalculator} from "../src/core/ScoreCalculator.sol";
import {PlatformRegistry} from "../src/core/PlatformRegistry.sol";
import {VeritasCore} from "../src/core/VeritasCore.sol";
import {DreamDEXAdapter} from "../src/adapters/DreamDEXAdapter.sol";
import {HelperConfig} from "./helpers/HelperConfig.s.sol";

/**
 * @title Deploy
 * @notice Main deployment script for Veritas protocol — Somnia only
 * @dev Deploys all contracts in correct order and configures them on Somnia Shannon/Mainnet
 * @author Veritas Team
 *
 * USAGE:
 * Deploy to Somnia Shannon Testnet:
 *   forge script script/Deploy.s.sol:Deploy --rpc-url $SOMNIA_TESTNET_RPC --broadcast --verify -vvvv
 *
 * Deploy to Somnia Mainnet:
 *   forge script script/Deploy.s.sol:Deploy --rpc-url $SOMNIA_MAINNET_RPC --broadcast --verify -vvvv
 *
 * Deploy locally (no verification):
 *   forge script script/Deploy.s.sol:Deploy --rpc-url http://localhost:8545 --broadcast -vvvv
 */
contract Deploy is Script {
    ReputationNFT public reputationNFT;
    ScoreCalculator public scoreCalculator;
    PlatformRegistry public platformRegistry;
    VeritasCore public veritasCore;
    DreamDEXAdapter public dreamDEXAdapter;

    HelperConfig public helperConfig;

    function run() external returns (address, address, address, address, address) {
        helperConfig = new HelperConfig();
        HelperConfig.NetworkConfig memory config = helperConfig.getActiveNetworkConfig();

        console.log("\n==============================================");
        console.log("veritas DEPLOYMENT - Somnia");
        console.log("==============================================");
        console.log("Network:", config.networkName);
        console.log("Chain ID:", config.chainId);
        console.log("Deployer:", msg.sender);
        console.log("==============================================\n");

        vm.startBroadcast();

        console.log("1/7 Deploying ReputationNFT...");
        reputationNFT = new ReputationNFT();
        console.log("   ReputationNFT deployed at:", address(reputationNFT));

        console.log("\n2/7 Deploying ScoreCalculator...");
        scoreCalculator = new ScoreCalculator();
        console.log("   ScoreCalculator deployed at:", address(scoreCalculator));

        console.log("\n3/7 Deploying PlatformRegistry...");
        platformRegistry = new PlatformRegistry();
        console.log("   PlatformRegistry deployed at:", address(platformRegistry));

        console.log("\n4/7 Deploying VeritasCore...");
        veritasCore = new VeritasCore(address(reputationNFT), address(scoreCalculator), address(platformRegistry));
        console.log("   VeritasCore deployed at:", address(veritasCore));

        console.log("\n5/7 Deploying DreamDEXAdapter...");
        dreamDEXAdapter = new DreamDEXAdapter();
        console.log("   DreamDEXAdapter deployed at:", address(dreamDEXAdapter));
        console.log("   platformName:", dreamDEXAdapter.platformName());

        console.log("\n6/7 Registering DreamDEX platform...");
        uint256 platformId = platformRegistry.addPlatform(
            "DreamDEX Event Contracts",
            address(dreamDEXAdapter),
            config.explorerUrl,
            PlatformRegistry.PlatformType.BINARY_PREDICTION
        );
        console.log("   Platform registered with ID:", platformId);
        console.log("   Platform Name: DreamDEX Event Contracts");

        console.log("\n7/7 Setting VeritasCore as NFT minter...");
        reputationNFT.setCore(address(veritasCore));
        console.log("   VeritasCore set as minter");

        vm.stopBroadcast();

        _printDeploymentSummary(config);
        _generateDeploymentJson(config);

        return (
            address(reputationNFT),
            address(scoreCalculator),
            address(platformRegistry),
            address(veritasCore),
            address(dreamDEXAdapter)
        );
    }

    function _printDeploymentSummary(HelperConfig.NetworkConfig memory config) internal view {
        console.log("\n==============================================");
        console.log("DEPLOYMENT SUMMARY");
        console.log("==============================================");
        console.log("Network:", config.networkName);
        console.log("Chain ID:", config.chainId);
        console.log("Deployer:", msg.sender);
        console.log("----------------------------------------------");
        console.log("Core Contracts:");
        console.log("  ReputationNFT:      ", address(reputationNFT));
        console.log("  ScoreCalculator:    ", address(scoreCalculator));
        console.log("  PlatformRegistry:   ", address(platformRegistry));
        console.log("  VeritasCore:    ", address(veritasCore));
        console.log("----------------------------------------------");
        console.log("Adapters:");
        console.log("  DreamDEXAdapter:     ", address(dreamDEXAdapter));
        console.log("----------------------------------------------");
        console.log("Explorer:", config.explorerUrl);
        console.log("==============================================");

        if (helperConfig.isLiveNetwork()) {
            console.log("\nView on Explorer:");
            console.log(config.explorerUrl, "/address/", addressToString(address(veritasCore)));
            console.log("\nVerification:");
            console.log("forge verify-contract", addressToString(address(veritasCore)), "src/core/VeritasCore.sol:VeritasCore --chain-id", config.chainId);
        }
        console.log("\n");
    }

    function _generateDeploymentJson(HelperConfig.NetworkConfig memory config) internal view {
        console.log("\n==============================================");
        console.log("DEPLOYMENT JSON (save to deployments/*.json)");
        console.log("==============================================");
        console.log("{");
        console.log('  "network": "', config.networkName, '",');
        console.log('  "chainId":', config.chainId, ",");
        console.log('  "timestamp":', block.timestamp, ",");
        console.log('  "deployer": "', addressToString(msg.sender), '",');
        console.log('  "contracts": {');
        console.log('    "ReputationNFT": "', addressToString(address(reputationNFT)), '",');
        console.log('    "ScoreCalculator": "', addressToString(address(scoreCalculator)), '",');
        console.log('    "PlatformRegistry": "', addressToString(address(platformRegistry)), '",');
        console.log('    "VeritasCore": "', addressToString(address(veritasCore)), '",');
        console.log('    "DreamDEXAdapter": "', addressToString(address(dreamDEXAdapter)), '"');
        console.log("  }");
        console.log("}");
        console.log("==============================================\n");
    }

    function addressToString(address addr) internal pure returns (string memory) {
        bytes memory data = abi.encodePacked(addr);
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(42);
        str[0] = "0"; str[1] = "x";
        for (uint256 i = 0; i < 20; i++) {
            str[2 + i * 2] = alphabet[uint8(data[i] >> 4)];
            str[3 + i * 2] = alphabet[uint8(data[i] & 0x0f)];
        }
        return string(str);
    }

    function deployForTesting()
        external
        returns (ReputationNFT, ScoreCalculator, PlatformRegistry, VeritasCore, DreamDEXAdapter)
    {
        helperConfig = new HelperConfig();
        vm.startBroadcast();
        reputationNFT = new ReputationNFT();
        scoreCalculator = new ScoreCalculator();
        platformRegistry = new PlatformRegistry();
        veritasCore = new VeritasCore(address(reputationNFT), address(scoreCalculator), address(platformRegistry));
        dreamDEXAdapter = new DreamDEXAdapter();
        platformRegistry.addPlatform("DreamDEX Event Contracts", address(dreamDEXAdapter), "https://shannon-explorer.somnia.network", PlatformRegistry.PlatformType.BINARY_PREDICTION);
        reputationNFT.setCore(address(veritasCore));
        vm.stopBroadcast();
        return (reputationNFT, scoreCalculator, platformRegistry, veritasCore, dreamDEXAdapter);
    }
}
