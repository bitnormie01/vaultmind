// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {FlashRescue} from "../src/modules/FlashRescue.sol";
import {VaultMindCore} from "../src/core/VaultMindCore.sol";
import {MockAavePool} from "./mocks/MockAavePool.sol";
import {MockOKXDexRouter} from "./mocks/MockOKXDexRouter.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {IPoolAddressesProvider} from "../src/interfaces/IAaveV3.sol";

// Simple mock for the PoolAddressesProvider to return our MockAavePool
contract MockAddressesProvider is IPoolAddressesProvider {
    address public pool;
    constructor(address _pool) { pool = _pool; }
    function getPool() external view returns (address) { return pool; }
    function setPoolImpl(address _pool) external {}
    function getPriceOracle() external view returns (address) { return address(this); }
    // Mock oracle: returns $1 for 1e18 tokens
    function getAssetPrice(address asset) external view returns (uint256) { return 1e8; }
}

contract FlashRescueTest is Test {
    VaultMindCore public core;
    MockAavePool public pool;
    MockOKXDexRouter public dex;
    MockAddressesProvider public addressesProvider;
    FlashRescue public rescue;

    MockERC20 public usdc;
    MockERC20 public weth;
    MockERC20 public aWeth;

    address public admin = address(this);
    address public walletOwner = address(0x111);
    
    // In our test, the "VM Core" triggers the rescue inside executeRescue, 
    // but the real implementation checks `if(msg.sender != VAULT_MIND_CORE)` 
    // Wait, FlashRescue requires `executeRescue` to be called by `VAULT_MIND_CORE`.
    // We will prank `core` when calling it!

    function setUp() public {
        core = new VaultMindCore();
        pool = new MockAavePool();
        dex = new MockOKXDexRouter();
        addressesProvider = new MockAddressesProvider(address(pool));
        
        usdc = new MockERC20("USDC", "USDC", 8);
        weth = new MockERC20("WETH", "WETH", 18);

        // Deploy FlashRescue
        rescue = new FlashRescue(address(addressesProvider), address(dex), address(core));

        // Register module in core
        core.registerModule(address(rescue), "FlashRescue");

        // Setup User Wallet
        vm.startPrank(walletOwner);
        core.setModulePermission(address(rescue), true);
        rescue.setRescueConfig(1.5e18, 500); // Target HF 1.5, 5% Slippage
        vm.stopPrank();

        // Setup aTokens and mock the deposit
        aWeth = new MockERC20("aWETH", "aWETH", 18);
        pool.setMockAToken(address(weth), address(aWeth));

        // Give aWETH to walletOwner to represent deposited collateral
        aWeth.mint(walletOwner, 10 ether);
        
        // Approve FlashRescue to pull aTokens from user
        vm.prank(walletOwner);
        aWeth.approve(address(rescue), type(uint256).max);
        
        // Put the actual WETH inside the Aave Pool so it can be "withdrawn"
        weth.mint(address(pool), 100 ether);
    }

    // ────────────────────────────────────────────────────────────────────────
    //   Mathematical Targeting
    // ────────────────────────────────────────────────────────────────────────

    function test_CalculateOptimalRepayment() public {
        // Setup a dangerous position: 
        // 10,000 WETH Collateral Base ($10,000)
        // 8,000 USDC Debt Base ($8,000)
        // Liquidation Threshold 82.5%
        // HF = (10,000 * 0.825) / 8,000 = 1.03125 (Dangerous)
        pool.setUserPosition(walletOwner, 10000e8, 8000e8, 8250, 7500);

        uint256 currentHF = pool.getHealthFactor(walletOwner);
        assertLt(currentHF, 1.1e18); // Below safety

        // Calculate repayment to reach 1.5 HF
        // Target = 1.5
        // maxDebtForTarget = (10000 * 0.825 * 1) / (1.5) = 5500
        // repayBase = 8000 - 5500 = 2500
        uint256 repayAmount = rescue.calculateOptimalRepayment(walletOwner, address(usdc));
        
        // Oracle returns 1e8 for 1 token. decimals = 8.
        assertEq(repayAmount, 2500e8);
    }

    // ────────────────────────────────────────────────────────────────────────
    //   Execution Validation
    // ────────────────────────────────────────────────────────────────────────

    function test_ExecuteRescueSuccess() public {
        // Setup dangerous position
        pool.setUserPosition(walletOwner, 10000e8, 8000e8, 8250, 7500);

        uint256 repayAmount = 2500e8; // $2500

        FlashRescue.RescueParams memory params = FlashRescue.RescueParams({
            userWallet: walletOwner,
            debtAsset: address(usdc),
            collateralAsset: address(weth),
            debtToRepay: repayAmount
        });

        // The Mock Pool needs USDC to "lend" to the flash loan receiver
        usdc.mint(address(pool), 100_000e8);

        // Prank the VaultMindCore contract calling the Execute logic
        vm.prank(address(core));
        rescue.executeRescue(params);

        uint256 postHF = pool.getHealthFactor(walletOwner);
        // Post-rescue HF reaches exactly the target (1.5e18) since collateral is unchanged
        assertEq(postHF, 1.5e18);
        
        (, , uint256 count, uint256 totalRepaid) = rescue.getUserConfig(walletOwner);
        assertEq(count, 1);
        assertEq(totalRepaid, repayAmount);
    }

    function test_RevertWhen_UnauthorizedCaller() public {
        FlashRescue.RescueParams memory params = FlashRescue.RescueParams({
            userWallet: walletOwner,
            debtAsset: address(usdc),
            collateralAsset: address(weth),
            debtToRepay: 2500e8
        });

        vm.expectRevert();
        // This will fail because msg.sender is `this`, not `VAULT_MIND_CORE`
        rescue.executeRescue(params);
    }

    function test_RevertWhen_RescueUnprofitable() public {
        // Setup an already healthy position
        pool.setUserPosition(walletOwner, 10000e8, 2000e8, 8250, 7500);

        uint256 repayAmount = 500e8; 

        FlashRescue.RescueParams memory params = FlashRescue.RescueParams({
            userWallet: walletOwner,
            debtAsset: address(usdc),
            collateralAsset: address(weth),
            debtToRepay: repayAmount
        });

        usdc.mint(address(pool), 100_000e8); // fuel the pool

        // We explicitly command the Mock DEX to revert to simulate toxic slippage
        // that violates the MinAmountOut safety parameter.
        dex.setShouldRevert(true, "MockOKXDex: insufficient output");

        vm.prank(address(core));
        vm.expectRevert();
        rescue.executeRescue(params);
    }

    function test_SetRescueConfig_RevertsOnHighSlippage() public {
        vm.prank(walletOwner);
        vm.expectRevert();
        // Should revert because max slipping is 500 (5%)
        rescue.setRescueConfig(1.5e18, 1000); 
    }

    function test_SetRescueConfig_RevertsOnLowHF() public {
        vm.prank(walletOwner);
        vm.expectRevert();
        rescue.setRescueConfig(0.5e18, 100); 
    }
}
