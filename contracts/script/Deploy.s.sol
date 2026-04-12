// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title VaultMind Deployment Script
 * @author VaultMind Team — OKX Build X Hackathon
 * @notice Foundry deployment script for X Layer Mainnet (Chain ID 196)
 *
 * @dev Usage:
 *   forge script script/Deploy.s.sol:DeployVaultMind \
 *     --rpc-url $XLAYER_RPC_URL \
 *     --private-key $PRIVATE_KEY \
 *     --broadcast \
 *     --verify \
 *     --etherscan-api-key $ETHERSCAN_API_KEY
 *
 * X Layer V3 Addresses (verified):
 *   Aave V3.6 Pool:              0xdFf435BCcf782f11187D3a4454d96702eD78e092
 *   WOKB:                        0xe538905cf8410324e03a5a23c1c177a474d59b2b
 *   USDC:                        0x74b7f16337b8972027f6196a17a631ac6de26d22
 */

import {Script, console2} from "forge-std/Script.sol";
import {VaultMindCore} from "../src/core/VaultMindCore.sol";
import {FlashRescue} from "../src/modules/FlashRescue.sol";
import {LiquidityManager} from "../src/modules/LiquidityManager.sol";

contract DeployVaultMind is Script {
    // ═══════════════════════════════════════════════════════════════════
    //                    X LAYER MAINNET ADDRESSES
    // ═══════════════════════════════════════════════════════════════════

    /// @notice Aave V3.6 Pool Addresses Provider on X Layer
    address public constant AAVE_POOL_ADDRESSES_PROVIDER =
        0xdFf435BCcf782f11187D3a4454d96702eD78e092; // Aave V3.6 Pool (proxy)

    /// @notice OKX DEX Aggregator on X Layer
    /// @dev This is used for collateral → debt asset swaps inside FlashRescue
    address public constant OKX_DEX_ROUTER = 0xD1b8997AaC08c619d40Be2e4284c9C72cAB33954;

    /// @notice Uniswap V3 NonfungiblePositionManager on X Layer
    address public constant UNISWAP_V3_POSITION_MANAGER = 0x315e413A11AB0df498eF83873012430ca36638Ae;

    /// @notice Uniswap V3 Factory on X Layer
    address public constant UNISWAP_V3_FACTORY = 0x4B2ab38DBF28D31D467aA8993f6c2585981D6804;

    // ═══════════════════════════════════════════════════════════════════
    //                    X LAYER TOKEN ADDRESSES
    // ═══════════════════════════════════════════════════════════════════

    address public constant WOKB  = 0xe538905cf8410324e03A5A23C1c177a474D59b2b;
    address public constant USDC  = 0x74b7F16337b8972027F6196A17a631aC6dE26d22;

    // ═══════════════════════════════════════════════════════════════════
    //                          RUN
    // ═══════════════════════════════════════════════════════════════════

    function run() external returns (
        address vaultMindCore,
        address flashRescue,
        address liquidityManager
    ) {
        uint256 deployerKey = vm.envUint("XLAYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        console2.log("=== VaultMind Deployment ===");
        console2.log("Chain ID:          ", block.chainid);
        console2.log("Deployer:          ", deployer);
        console2.log("Deployer balance:  ", deployer.balance / 1e18, "OKB");
        console2.log("");
        console2.log("Aave Pool Provider:", AAVE_POOL_ADDRESSES_PROVIDER);
        console2.log("WOKB:              ", WOKB);
        console2.log("USDC:              ", USDC);

        // ── Validate we're on X Layer ──
        require(block.chainid == 196, "Deploy: Must deploy on X Layer (chain 196)");

        vm.startBroadcast(deployerKey);

        // ─── 1. Deploy VaultMindCore ───
        VaultMindCore core = new VaultMindCore();
        vaultMindCore = address(core);
        console2.log("\n[1/3] VaultMindCore deployed:", vaultMindCore);

        // ─── 2. Deploy FlashRescue ───
        FlashRescue rescue = new FlashRescue(
            AAVE_POOL_ADDRESSES_PROVIDER,
            OKX_DEX_ROUTER,
            vaultMindCore
        );
        flashRescue = address(rescue);
        console2.log("[2/3] FlashRescue deployed:   ", flashRescue);

        // ─── 3. Deploy LiquidityManager ───
        LiquidityManager liqManager = new LiquidityManager(
            UNISWAP_V3_POSITION_MANAGER,
            UNISWAP_V3_FACTORY,
            vaultMindCore,
            OKX_DEX_ROUTER
        );
        liquidityManager = address(liqManager);
        console2.log("[3/3] LiquidityManager deployed:", liquidityManager);

        // ─── 4. Register modules in VaultMindCore ───
        core.registerModule(flashRescue, "FlashRescue");
        core.registerModule(liquidityManager, "LiquidityManager");
        console2.log("Modules registered in VaultMindCore [OK]");

        vm.stopBroadcast();

        // ─── Print deployment summary ───
        console2.log("\n=== Deployment Summary ===");
        console2.log("VaultMindCore:     ", vaultMindCore);
        console2.log("FlashRescue:       ", flashRescue);
        console2.log("LiquidityManager:  ", liquidityManager);
        console2.log("\nCopy these addresses into your .env files!");
        console2.log("VAULTMIND_CORE_ADDRESS=", vaultMindCore);
        console2.log("FLASH_RESCUE_ADDRESS=  ", flashRescue);
        console2.log("LIQUIDITY_MANAGER_ADDRESS=", liquidityManager);
    }
}

// ─── Testnet Deploy (X Layer Testnet, chain 195) ─────────────────────

contract DeployVaultMindTestnet is Script {
    /// @notice X Layer Testnet Aave V3 Pool (placeholder — update when available)
    address public constant AAVE_POOL_PROVIDER_TESTNET = address(0);

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        require(block.chainid == 195, "Deploy: Must deploy on X Layer Testnet (chain 195)");

        console2.log("=== VaultMind Testnet Deployment ===");
        console2.log("Chain ID: 195 (X Layer Testnet)");

        vm.startBroadcast(deployerKey);

        VaultMindCore core = new VaultMindCore();
        console2.log("VaultMindCore:", address(core));

        // FlashRescue and LiquidityManager deployment would go here
        // once testnet contract addresses are confirmed

        vm.stopBroadcast();
    }
}
