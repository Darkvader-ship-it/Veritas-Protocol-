// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "@forge-std/Script.sol";
import {DreamDEXAdapter} from "../src/adapters/DreamDEXAdapter.sol";
import {DreamDEXCopyVault} from "../src/core/DreamDEXCopyVault.sol";
import {AzuroAdapter} from "../src/adapters/AzuroAdapter.sol";
import {SXBetAdapter} from "../src/adapters/SXBetAdapter.sol";
import {PlatformRegistry} from "../src/core/PlatformRegistry.sol";

/**
 * @title DeployDreamDEX
 * @notice Deploys DreamDEX Event Contracts adapters + vault on Somnia
 * @dev Shannon Testnet 50312 (STT + tUSDC 6dec) + Mainnet 5031 (SOMI + USDso 18dec)
 *      CREATE3: BinaryMarketsModule 0x3ecC..., OutcomeToken6909 0xB52c..., BinarySettlement 0xbF4a..., OracleHub 0xe40db...
 *
 * USAGE:
 *   forge script contracts/script/DeployDreamDEX.s.sol:DeployDreamDEX --rpc-url $SOMNIA_TESTNET_RPC --broadcast -vvvv
 *   cast send $PLATFORM_REGISTRY addPlatform "DreamDEX Event Contracts" $ADAPTER "https://docs.dreamdex.io" 1 --rpc-url $SOMNIA_TESTNET_RPC --private-key $DEPLOYER_PRIVATE_KEY
 *   forge script contracts/script/DeployDreamDEX.s.sol:DeployDreamDEX --rpc-url $SOMNIA_MAINNET_RPC --broadcast --verify -vvvv
 *
 * Env:
 *   SOMNIA_TESTNET_RPC=https://dream-rpc.somnia.network
 *   SOMNIA_MAINNET_RPC=https://api.infra.mainnet.somnia.network
 *   PLATFORM_REGISTRY=0x... (already deployed Veritas PlatformRegistry on Somnia)
 *   COLLATERAL_TUSDC=0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E (Shannon) or USDso mainnet
 *   EXECUTOR=0x... (backend hot wallet for copy vault)
 */
contract DeployDreamDEX is Script {
    DreamDEXAdapter public adapter;
    DreamDEXCopyVault public vault;
    AzuroAdapter public azuroAdapter;
    SXBetAdapter public sxAdapter;

    // Somnia Shannon 50312 defaults
    address public constant COLLATERAL_TUSDC_SHANNON = 0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E;
    address public constant COLLATERAL_USDSO_MAINNET = 0x0000000000000000000000000000000000000001;
    // Azuro/SX core defaults (Somnia hub - if 0, adapter deployed with placeholder and can be re-deployed per chain)
    address public constant AZURO_CORE_DEFAULT = 0x2B35345b8d4e4A93c3cB5A5FA5dBEd89ef413624; // Azuro LP Polygon (hub proxy)
    address public constant SX_CORE_DEFAULT = 0x0000000000000000000000000000000000000000; // Set via SX_CORE env

    function run() external returns (address adapterAddr, address vaultAddr) {
        uint256 chainId = block.chainid;
        bool isMainnet = chainId == 5031;
        address collateral = isMainnet ? COLLATERAL_USDSO_MAINNET : COLLATERAL_TUSDC_SHANNON;

        // Allow override via env
        address envCollateral = vm.envOr("COLLATERAL", address(0));
        if (envCollateral != address(0)) collateral = envCollateral;

        address envRegistry = vm.envOr("PLATFORM_REGISTRY", address(0));
        address executor = vm.envOr("EXECUTOR", msg.sender);

        console.log("\n==============================================");
        console.log("DreamDEX DEPLOYMENT - Somnia");
        console.log("==============================================");
        console.log("Chain ID:", chainId);
        console.log("Deployer:", msg.sender);
        console.log("Collateral:", collateral);
        console.log("Executor:", executor);
        if (envRegistry != address(0)) console.log("PlatformRegistry:", envRegistry);
        console.log("==============================================\n");

        vm.startBroadcast();

        // 1. Deploy DreamDEXAdapter
        console.log("1/5 Deploying DreamDEXAdapter...");
        adapter = new DreamDEXAdapter();
        console.log("   DreamDEXAdapter deployed at:", address(adapter));
        console.log("   platformName():", adapter.platformName());
        console.log("   platformAddress():", adapter.platformAddress());
        console.log("   venueId:", vm.toString(adapter.getVenueId()));
        console.log("   collateral:", adapter.getCollateral());

        // 2. Deploy DreamDEXCopyVault
        console.log("\n2/5 Deploying DreamDEXCopyVault...");
        vault = new DreamDEXCopyVault(collateral, executor);
        console.log("   DreamDEXCopyVault deployed at:", address(vault));
        (uint256 tvl, uint256 trades, uint256 vol, address exec, address col, uint256 dec) = vault.getVaultStats();
        console.log("   collateral:", col);
        console.log("   decimals:", dec);
        console.log("   executor:", exec);
        console.log("   TVL:", tvl);

        // 3. Deploy AzuroAdapter (Somnia hub)
        console.log("\n3/5 Deploying AzuroAdapter (Somnia hub)...");
        address azuroCore = vm.envOr("AZURO_CORE", AZURO_CORE_DEFAULT);
        azuroAdapter = new AzuroAdapter(azuroCore);
        console.log("   AzuroAdapter deployed at:", address(azuroAdapter));
        console.log("   platformName():", azuroAdapter.platformName());
        console.log("   azuroCore:", azuroCore);

        // 4. Deploy SXBetAdapter (Somnia hub)
        console.log("\n4/5 Deploying SXBetAdapter (Somnia hub)...");
        address sxCore = vm.envOr("SX_CORE", SX_CORE_DEFAULT);
        if (sxCore == address(0)) {
            // Use DreamDEX adapter address as placeholder hub if SX_CORE not set - still registers name for wiring
            sxCore = address(adapter);
            console.log("   SX_CORE env not set, using placeholder hub:", sxCore);
        }
        sxAdapter = new SXBetAdapter(sxCore);
        console.log("   SXBetAdapter deployed at:", address(sxAdapter));
        console.log("   platformName():", sxAdapter.platformName());

        // 5. Optional: Register all in PlatformRegistry if provided
        if (envRegistry != address(0)) {
            console.log("\n5/5 Registering platforms in PlatformRegistry...");
            PlatformRegistry registry = PlatformRegistry(envRegistry);
            // DreamDEX
            try registry.addPlatform("DreamDEX Event Contracts", address(adapter), "https://docs.dreamdex.io", PlatformRegistry.PlatformType.BINARY_PREDICTION) returns (uint256 pid) {
                console.log("   DreamDEX registered ID:", pid);
            } catch Error(string memory r) { console.log("   DreamDEX register failed:", r); } catch { console.log("   DreamDEX register failed"); }
            // Azuro
            try registry.addPlatform("Azuro", address(azuroAdapter), "https://azuro.org", PlatformRegistry.PlatformType.BINARY_PREDICTION) returns (uint256 pid2) {
                console.log("   Azuro registered ID:", pid2);
            } catch Error(string memory r) { console.log("   Azuro register failed:", r); } catch { console.log("   Azuro register failed"); }
            // SX Bet
            try registry.addPlatform("SX Bet", address(sxAdapter), "https://sx.bet", PlatformRegistry.PlatformType.BINARY_PREDICTION) returns (uint256 pid3) {
                console.log("   SX Bet registered ID:", pid3);
            } catch Error(string memory r) { console.log("   SX Bet register failed:", r); } catch { console.log("   SX Bet register failed"); }
        } else {
            console.log("\n5/5 Skipping PlatformRegistry registration (set PLATFORM_REGISTRY env to register)");
            console.log("   Manual: cast send $PLATFORM_REGISTRY \"addPlatform(string,address,string,uint8)\" \"DreamDEX Event Contracts\" $ADAPTER \"https://docs.dreamdex.io\" 1 --rpc-url $SOMNIA_RPC --private-key $PK");
            console.log("   Manual: cast send $PLATFORM_REGISTRY \"addPlatform(string,address,string,uint8)\" \"Azuro\" $AZURO_ADAPTER \"https://azuro.org\" 1 --rpc-url $SOMNIA_RPC --private-key $PK");
            console.log("   Manual: cast send $PLATFORM_REGISTRY \"addPlatform(string,address,string,uint8)\" \"SX Bet\" $SX_ADAPTER \"https://sx.bet\" 1 --rpc-url $SOMNIA_RPC --private-key $PK");
        }

        vm.stopBroadcast();

        _printSummary(chainId, collateral, executor, envRegistry);
        _printJson(chainId, collateral, executor);

        return (address(adapter), address(vault));
    }

    function _printSummary(uint256 chainId, address collateral, address executor, address registry) internal view {
        console.log("\n==============================================");
        console.log("DEPLOYMENT SUMMARY - DreamDEX + Azuro + SX");
        console.log("==============================================");
        console.log("Chain ID:", chainId);
        console.log("DreamDEXAdapter:", address(adapter));
        console.log("DreamDEXCopyVault:", address(vault));
        console.log("AzuroAdapter:", address(azuroAdapter));
        console.log("SXBetAdapter:", address(sxAdapter));
        console.log("Collateral:", collateral);
        console.log("Executor:", executor);
        if (registry != address(0)) console.log("PlatformRegistry:", registry);
        console.log("VenueId (Shannon): 0x679795a0195a1b76cdebb7c51d74e058aee92919b8c3389af86ef24535e8a28c");
        console.log("OutcomeToken6909: 0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9");
        console.log("BinaryMarketsModule: 0x3ecC694Cef705358864a646142ac17A90E29e388");
        console.log("BinarySettlement: 0xbF4a49e0Dfd092e5FBE8E5761064C49533e6Ed23");
        console.log("Explorer: https://shannon-explorer.somnia.network/address/");
        console.log("==============================================\n");
    }

    function _printJson(uint256 chainId, address collateral, address executor) internal view {
        console.log("DEPLOYMENT JSON (save to deployments/somnia-testnet.json):");
        console.log("{");
        console.log('  "chainId":', chainId, ",");
        console.log('  "collateral": "', _addrToString(collateral), '",');
        console.log('  "executor": "', _addrToString(executor), '",');
        console.log('  "contracts": {');
        console.log('    "DreamDEXAdapter": "', _addrToString(address(adapter)), '",');
        console.log('    "DreamDEXCopyVault": "', _addrToString(address(vault)), '",');
        console.log('    "AzuroAdapter": "', _addrToString(address(azuroAdapter)), '",');
        console.log('    "SXBetAdapter": "', _addrToString(address(sxAdapter)), '"');
        console.log("  }");
        console.log("}");
    }

    function _addrToString(address addr) internal pure returns (string memory) {
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
}
