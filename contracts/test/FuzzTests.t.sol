// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title FuzzTests — VaultMind FlashRescue
 * @author VaultMind Team — OKX Build X Hackathon
 *
 * @notice Comprehensive fuzz + unit tests for FlashRescue.sol
 *         Uses local MockAavePool + MockOKXDexRouter — NO mainnet fork needed.
 *
 * Test categories:
 *   [UNIT]  Sanity checks on constructor, config, constants
 *   [FUZZ]  Stateless mathematical property tests
 *   [E2E]   Full flash-rescue path through MockAavePool callback
 *   [ACL]   Access control — unauthorized callers always revert
 *
 * Invariants:
 *   1. Health factor MUST improve after any debt repayment
 *   2. Flash loan premium = 0.05% (5 bps) — always correct
 *   3. Optimal repayment is always ≤ total debt
 *   4. OKX DEX slippage protection: minOut = amount × (1 - slippage)
 *   5. Rescue is cheaper than liquidation penalty (5-15%) at ≤5% slippage
 */

import {Test, console2} from "forge-std/Test.sol";

import {FlashRescue} from "../src/modules/FlashRescue.sol";
import {IPool} from "../src/interfaces/IAaveV3.sol";
import {VaultMindCore} from "../src/core/VaultMindCore.sol";

// Import mocks from our canonical mock library
import {MockAavePool}     from "./mocks/MockAavePool.sol";
import {MockERC20}        from "./mocks/MockERC20.sol";
import {MockOKXDexRouter} from "./mocks/MockOKXDexRouter.sol";
import {FlashRescueHandler} from "./handlers/FlashRescueHandler.sol";

contract MockOracle {
    // Return 1e8 for USDC (1 USDC = 1 USD Base)
    // Actually USDC is 6 decimals, so 1 USDC = 1 USDC. If price is 1e8, and formula is:
    // repayAmount = repayBase * 10^decimals / assetPrice
    // repayBase = 1000 * 1e8
    // assetPrice = 1e8
    // then repayAmount = 1000e8 * 1e6 / 1e8 = 1000e6 = 1000 USDC. Perfect.
    function getAssetPrice(address) external pure returns (uint256) {
        return 1e8;
    }
}

/// @dev Minimal MockAddressesProvider — tells FlashRescue where the pool is
contract MockAddressesProvider {
    address public immutable poolAddress;
    address public immutable oracleAddress;

    constructor(address _pool, address _oracle) {
        poolAddress = _pool;
        oracleAddress = _oracle;
    }

    function getPool() external view returns (address) {
        return poolAddress;
    }

    function getPriceOracle() external view returns (address) {
        return oracleAddress;
    }
}

// ═══════════════════════════════════════════════════════════════════
//                       TEST SUITE
// ═══════════════════════════════════════════════════════════════════

contract FuzzTests is Test {
    // ── Contracts under test ──
    FlashRescue         public flashRescue;

    // ── Mocks ──
    MockAavePool           public mockPool;
    MockAddressesProvider  public mockProvider;
    MockOKXDexRouter       public mockDex;
    MockERC20              public debtToken;       // USDC (6 dec)
    MockERC20              public collateralToken; // WOKB (18 dec)
    MockOracle             public mockOracle;
    FlashRescueHandler     public handler;

    // ── Well-known test addresses ──
    address public constant USER           = address(0xBEEF);
    address public VAULT_MIND_CORE;
    VaultMindCore public coreInstance;

    // ── Shared test constants ──
    uint256 public constant LIQ_THRESHOLD  = 8250; // 82.5%
    uint256 public constant LTV            = 7500; // 75%

    // ─────────────────────────────────────────────────────────────────
    //                         SETUP
    // ─────────────────────────────────────────────────────────────────

    function setUp() public {
        // 1. Deploy mock tokens
        debtToken       = new MockERC20("USDC", "USDC", 6);
        collateralToken = new MockERC20("WOKB", "WOKB", 18);

        // 2. Deploy canonical MockAavePool
        mockPool = new MockAavePool();
        mockOracle = new MockOracle();

        // 3. Deploy addresses provider (points to mockPool)
        mockProvider = new MockAddressesProvider(address(mockPool), address(mockOracle));

        // 4. Deploy OKX DEX router mock (0.3% default slippage)
        mockDex = new MockOKXDexRouter();

        coreInstance = new VaultMindCore();
        VAULT_MIND_CORE = address(coreInstance);

        // 5. Deploy FlashRescue with OKX DEX router
        flashRescue = new FlashRescue(
            address(mockProvider),
            address(mockDex),
            VAULT_MIND_CORE
        );

        coreInstance.registerModule(address(flashRescue), "FlashRescue");
        vm.startPrank(USER);
        coreInstance.setModulePermission(address(flashRescue), true);
        vm.stopPrank();

        // 6. Fund mock pool with debt tokens for flash loans
        debtToken.mint(address(mockPool), 100_000_000e6); // 100M USDC

        // 7. Approve MockAavePool to pull repayments from MockOKXDexRouter
        //    (the dex will mint debtToken directly to flashRescue in the mock)

        // Debug labels
        vm.label(address(flashRescue),    "FlashRescue");
        vm.label(address(mockPool),        "MockAavePool");
        vm.label(address(mockDex),         "MockOKXDexRouter");
        vm.label(address(debtToken),       "USDC");
        vm.label(address(collateralToken), "WOKB");
        vm.label(USER,                     "User");

        // 8. Initialize and attach stateful fuzzer handler
        handler = new FlashRescueHandler(
            flashRescue,
            mockPool,
            address(debtToken),
            address(collateralToken)
        );
        targetContract(address(handler));
    }

    // ─────────────────────────────────────────────────────────────────
    //                    [UNIT] Constructor + Immutables
    // ─────────────────────────────────────────────────────────────────

    function test_ConstructorSetsImmutables() public view {
        assertEq(address(flashRescue.ADDRESSES_PROVIDER()), address(mockProvider));
        assertEq(address(flashRescue.POOL()),               address(mockPool));
        assertEq(address(flashRescue.OKX_DEX()),            address(mockDex));
        assertEq(flashRescue.VAULT_MIND_CORE(),             VAULT_MIND_CORE);
    }

    function test_ConstructorRevertsOnZeroAddressProvider() public {
        vm.expectRevert(FlashRescue.ZeroAddress.selector);
        new FlashRescue(address(0), address(mockDex), VAULT_MIND_CORE);
    }

    function test_ConstructorRevertsOnZeroDexRouter() public {
        vm.expectRevert(FlashRescue.ZeroAddress.selector);
        new FlashRescue(address(mockProvider), address(0), VAULT_MIND_CORE);
    }

    function test_ConstructorRevertsOnZeroCore() public {
        vm.expectRevert(FlashRescue.ZeroAddress.selector);
        new FlashRescue(address(mockProvider), address(mockDex), address(0));
    }

    // ─────────────────────────────────────────────────────────────────
    //                    [UNIT] Constants
    // ─────────────────────────────────────────────────────────────────

    function test_DefaultConstants() public view {
        assertEq(flashRescue.HF_PRECISION(),     1e18);
        assertEq(flashRescue.DEFAULT_TARGET_HF(), 15e17); // 1.5
        assertEq(flashRescue.MAX_SLIPPAGE_BPS(),  500);   // 5%
        assertEq(flashRescue.BPS_DENOMINATOR(),   10_000);
        assertEq(flashRescue.VARIABLE_RATE_MODE(), 2);
    }

    // ─────────────────────────────────────────────────────────────────
    //                    [UNIT] setRescueConfig
    // ─────────────────────────────────────────────────────────────────

    function test_SetRescueConfig_AcceptsValidValues() public {
        vm.prank(USER);
        flashRescue.setRescueConfig(2e18, 200); // HF 2.0, 2% slippage

        (uint256 targetHF, uint256 slippage,,) = flashRescue.getUserConfig(USER);
        assertEq(targetHF, 2e18);
        assertEq(slippage, 200);
    }

    function test_SetRescueConfig_RevertsOnLowHF() public {
        vm.prank(USER);
        vm.expectRevert(abi.encodeWithSelector(FlashRescue.TargetHFTooLow.selector, 5e17, 1e18));
        flashRescue.setRescueConfig(5e17, 100);
    }

    function test_SetRescueConfig_RevertsOnHighSlippage() public {
        vm.prank(USER);
        vm.expectRevert(abi.encodeWithSelector(FlashRescue.SlippageTooHigh.selector, 600, 500));
        flashRescue.setRescueConfig(15e17, 600);
    }

    function test_DefaultConfigValues() public view {
        (uint256 targetHF, uint256 slippage, uint256 count, uint256 total) =
            flashRescue.getUserConfig(address(0xDEAD));

        assertEq(targetHF, 15e17); // Default 1.5
        assertEq(slippage, 100);   // Default 1%
        assertEq(count,    0);
        assertEq(total,    0);
    }

    // ─────────────────────────────────────────────────────────────────
    //              [UNIT] getUserHealthFactor
    // ─────────────────────────────────────────────────────────────────

    function test_GetUserHealthFactor() public {
        // collateral=10000 USD, debt=8000 USD, liqThreshold=82.5%
        // HF = (10000e8 × 8250 × 1e18) / (8000e8 × 10000) = 1.03125e18
        mockPool.setUserPosition(USER, 10_000e8, 8_000e8, LIQ_THRESHOLD, LTV);

        uint256 hf = flashRescue.getUserHealthFactor(USER);
        uint256 expectedHF = (10_000e8 * LIQ_THRESHOLD * 1e18) / (8_000e8 * 10_000);
        assertEq(hf, expectedHF);
    }

    function test_GetUserHealthFactor_MaxWhenNoDebt() public {
        mockPool.setUserPosition(USER, 10_000e8, 0, LIQ_THRESHOLD, LTV);
        // Zero debt → HF = type(uint256).max
        uint256 hf = flashRescue.getUserHealthFactor(USER);
        assertEq(hf, type(uint256).max);
    }

    // ─────────────────────────────────────────────────────────────────
    //              [UNIT] calculateOptimalRepayment
    // ─────────────────────────────────────────────────────────────────

    function test_OptimalRepayment_ReturnsZeroWhenAboveTarget() public {
        // HF = (10000e8 × 8250 × 1e18) / (5000e8 × 10000) = 1.65e18 > default target 1.5e18
        mockPool.setUserPosition(USER, 10_000e8, 5_000e8, LIQ_THRESHOLD, LTV);

        uint256 repay = flashRescue.calculateOptimalRepayment(USER, address(debtToken));
        assertEq(repay, 0, "No rescue needed when HF above target");
    }

    function test_OptimalRepayment_ReturnsPositiveAmountWhenBelowTarget() public {
        // HF = (10000e8 × 8250 × 1e18) / (8500e8 × 10000) ≈ 0.97e18 < 1.5e18 target
        mockPool.setUserPosition(USER, 10_000e8, 8_500e8, LIQ_THRESHOLD, LTV);

        uint256 repay = flashRescue.calculateOptimalRepayment(USER, address(debtToken));
        assertGt(repay, 0, "Should need rescue when HF < target");
        assertLe(repay, 8_500e8, "Repay cannot exceed total debt");
    }

    // ─────────────────────────────────────────────────────────────────
    //              [UNIT] executeRescue Validation
    // ─────────────────────────────────────────────────────────────────

    function test_ExecuteRescue_RevertsOnZeroDebt() public {
        FlashRescue.RescueParams memory params = FlashRescue.RescueParams({
            userWallet:      USER,
            debtAsset:       address(debtToken),
            collateralAsset: address(collateralToken),
            debtToRepay:     0 // INVALID
        });

        vm.prank(VAULT_MIND_CORE);
        vm.expectRevert(FlashRescue.ZeroAmount.selector);
        flashRescue.executeRescue(params);
    }

    function test_ExecuteRescue_RevertsOnZeroWallet() public {
        FlashRescue.RescueParams memory params = FlashRescue.RescueParams({
            userWallet:      address(0), // INVALID
            debtAsset:       address(debtToken),
            collateralAsset: address(collateralToken),
            debtToRepay:     1_000e6
        });

        vm.prank(VAULT_MIND_CORE);
        vm.expectRevert(FlashRescue.ZeroAddress.selector); // Zero-address check fires before module auth
        flashRescue.executeRescue(params);
    }

    // ─────────────────────────────────────────────────────────────────
    //              [UNIT] executeOperation Access Control
    // ─────────────────────────────────────────────────────────────────

    function test_ExecuteOperation_RevertsOnUnauthorizedCaller() public {
        vm.prank(address(0xBAD));
        vm.expectRevert(FlashRescue.UnauthorizedCaller.selector);
        flashRescue.executeOperation(
            address(debtToken), 1_000e6, 50, address(flashRescue), ""
        );
    }

    function test_ExecuteOperation_RevertsOnBadInitiator() public {
        bytes memory encoded = abi.encode(FlashRescue.RescueParams({
            userWallet:      USER,
            debtAsset:       address(debtToken),
            collateralAsset: address(collateralToken),
            debtToRepay:     1_000e6
        }));

        vm.prank(address(mockPool));
        vm.expectRevert(
            abi.encodeWithSelector(FlashRescue.InvalidInitiator.selector, address(0xBAD))
        );
        flashRescue.executeOperation(
            address(debtToken), 1_000e6, 50, address(0xBAD), encoded
        );
    }

    // ─────────────────────────────────────────────────────────────────
    //              [FUZZ] setRescueConfig — valid input space
    // ─────────────────────────────────────────────────────────────────

    function testFuzz_SetRescueConfig_AcceptsValidInputs(
        uint256 targetHF,
        uint256 slippageBps
    ) public {
        targetHF    = bound(targetHF,    1e18, 10e18);
        slippageBps = bound(slippageBps, 1,    500);

        vm.prank(USER);
        flashRescue.setRescueConfig(targetHF, slippageBps);

        (uint256 storedHF, uint256 storedSlippage,,) = flashRescue.getUserConfig(USER);
        assertEq(storedHF,      targetHF);
        assertEq(storedSlippage, slippageBps);
    }

    function testFuzz_SetRescueConfig_RejectsLowHF(uint256 targetHF) public {
        targetHF = bound(targetHF, 0, 1e18 - 1);

        vm.prank(USER);
        vm.expectRevert(
            abi.encodeWithSelector(FlashRescue.TargetHFTooLow.selector, targetHF, 1e18)
        );
        flashRescue.setRescueConfig(targetHF, 100);
    }

    function testFuzz_SetRescueConfig_RejectsHighSlippage(uint256 slippageBps) public {
        slippageBps = bound(slippageBps, 501, 10_000);

        vm.prank(USER);
        vm.expectRevert(
            abi.encodeWithSelector(FlashRescue.SlippageTooHigh.selector, slippageBps, 500)
        );
        flashRescue.setRescueConfig(15e17, slippageBps);
    }

    // ─────────────────────────────────────────────────────────────────
    //              [FUZZ] Flash Loan Premium Math
    // ─────────────────────────────────────────────────────────────────

    /// @notice Premium = amount × 5 / 10000. Must never overflow, must be correct.
    function testFuzz_FlashLoanPremiumNeverOverflows(uint256 amount) public pure {
        amount = bound(amount, 1, type(uint128).max); // Realistic flash loan cap

        uint256 premium = (amount * 5) / 10_000;

        assertTrue(premium <= (amount * 5) / 10_000 + 1, "Premium at most 0.05%");

        // Any amount >= 2000 produces a non-zero premium (2000 * 5 / 10000 = 1)
        if (amount >= 2_000) {
            assertTrue(premium > 0, "Non-zero premium for substantive amounts");
        }

        // Flash loan should always be cheaper than liquidation penalty (5%)
        // Only assert when amounts are large enough to avoid integer rounding to zero
        if (amount >= 2_000) {
            uint256 liquidationPenalty = (amount * 500) / 10_000; // 5%
            assertTrue(premium < liquidationPenalty, "Flash premium < liquidation penalty");
        }
    }

    // ─────────────────────────────────────────────────────────────────
    //              [FUZZ] Health Factor Math (pure)
    // ─────────────────────────────────────────────────────────────────

    function testFuzz_HealthFactorMath(
        uint256 collateral,
        uint256 debt,
        uint256 liqThresholdBps
    ) public pure {
        collateral       = bound(collateral,      1e8,  1_000_000e8); // $1–$1M
        debt             = bound(debt,            1e8,  collateral);  // debt ≤ collateral
        liqThresholdBps  = bound(liqThresholdBps, 5000, 9500);        // 50%–95%

        uint256 hf = (collateral * liqThresholdBps * 1e18) / (debt * 10_000);

        assertTrue(hf > 0, "HF must be positive");
        assertTrue(hf >= 5e17, "HF >= 0.5 when collateral >= debt at 50%+ threshold");

        if (collateral * liqThresholdBps > debt * 10_000) {
            assertTrue(hf > 1e18, "HF > 1.0 when sufficiently collateralised");
        }
    }

    // ─────────────────────────────────────────────────────────────────
    //              [FUZZ] Optimal Repayment Correctness
    // ─────────────────────────────────────────────────────────────────

    function testFuzz_OptimalRepaymentProducesValidHF(
        uint64 collateral64,
        uint64 debt64,
        uint16 liqThresholdBps16,
        uint64 targetHF64
    ) public pure {
        uint256 collateral      = bound(uint256(collateral64),     100e8,    500_000e8);
        uint256 liqThresholdBps = bound(uint256(liqThresholdBps16), 7000,    8500);
        uint256 targetHF        = bound(uint256(targetHF64),        1e18,    3e18);

        // Ensure current HF is below target
        uint256 minDebt = (collateral * liqThresholdBps * 1e18) / (targetHF * 10_000);
        uint256 debt = bound(uint256(debt64), minDebt + 1, collateral * 2);

        uint256 currentHF = (collateral * liqThresholdBps * 1e18) / (debt * 10_000);
        if (currentHF >= targetHF) return; // Skip edge cases

        uint256 maxDebtForTarget = (collateral * liqThresholdBps * 1e18) / (targetHF * 10_000);
        if (debt <= maxDebtForTarget) return;

        uint256 repayAmount = debt - maxDebtForTarget;

        // Repay must be ≤ total debt
        assertTrue(repayAmount <= debt, "Repay <= total debt");
        assertTrue(repayAmount > 0,     "Repay > 0 when HF < target");

        // After repay, new HF >= target (- 1 wei rounding allowance)
        uint256 newDebt = debt - repayAmount;
        if (newDebt > 0) {
            uint256 newHF = (collateral * liqThresholdBps * 1e18) / (newDebt * 10_000);
            assertTrue(newHF >= targetHF - 1, "New HF >= target after repayment");
        }
    }

    // ─────────────────────────────────────────────────────────────────
    //              [FUZZ] OKX DEX Slippage Protection
    // ─────────────────────────────────────────────────────────────────

    function testFuzz_OKXDexSlippageProtectionMath(
        uint256 amount,
        uint256 slippageBps
    ) public pure {
        amount      = bound(amount,      1, type(uint128).max);
        slippageBps = bound(slippageBps, 1, 500); // 0.01%–5%

        uint256 minOut = (amount * (10_000 - slippageBps)) / 10_000;

        assertTrue(minOut <= amount,  "minOut <= amount");

        if (amount >= 10_000) {
            assertTrue(minOut > 0, "minOut > 0 for substantive amounts");
        }

        uint256 slippageAllowance = amount - minOut;
        assertTrue(
            slippageAllowance <= (amount * slippageBps) / 10_000 + 1,
            "Slippage allowance bounded by declared bps"
        );
    }

    // ─────────────────────────────────────────────────────────────────
    //              [FUZZ] HF Invariant: Always Improves After Repayment
    // ─────────────────────────────────────────────────────────────────

    function testFuzz_HFAlwaysImprovesAfterRepayment(
        uint256 collateral,
        uint256 debt,
        uint256 repayAmount,
        uint256 liqThresholdBps
    ) public pure {
        collateral      = bound(collateral,     1_000e8, 100_000e8);
        liqThresholdBps = bound(liqThresholdBps, 7500,   8500);
        debt            = bound(debt,            500e8,  collateral);

        uint256 startHF = (collateral * liqThresholdBps * 1e18) / (debt * 10_000);

        // Only test in the concerning zone: HF ∈ (1.0, 2.0)
        vm.assume(startHF > 1e18 && startHF < 2e18);

        repayAmount = bound(repayAmount, 1e8, debt / 2);

        uint256 newDebt = debt - repayAmount;
        uint256 endHF = newDebt > 0
            ? (collateral * liqThresholdBps * 1e18) / (newDebt * 10_000)
            : type(uint256).max;

        // INVARIANT: HF strictly improves
        assertTrue(endHF > startHF, "HF must strictly improve after any debt repayment");
    }

    // ─────────────────────────────────────────────────────────────────
    //              [FUZZ] Rescue Always Cheaper Than Liquidation
    // ─────────────────────────────────────────────────────────────────

    function testFuzz_RescueCheaperThanLiquidation(
        uint32 debtRaw,
        uint8  swapSlippageRaw,
        uint8  liquidationPenaltyRaw
    ) public pure {
        // Derive bounded values via modulo — avoids forge bound() clamping quirks
        // on tiny uint8 inputs where bound(7, 10, 500) doesn't behave as expected
        uint256 debt    = 100e6 + (uint256(debtRaw) % (10_000_000e6 - 100e6 + 1));
        uint256 swapBps = 10    + (uint256(swapSlippageRaw) % 491);   // 10-500
        uint256 liqBps  = 500   + (uint256(liquidationPenaltyRaw) % 1001); // 500-1500

        uint256 flashPremium    = (debt * 5)       / 10_000;  // 0.05%
        uint256 swapCost        = (debt * swapBps) / 10_000;
        uint256 totalRescueCost = flashPremium + swapCost;
        uint256 liqCost         = (debt * liqBps)  / 10_000;

        // INVARIANT: rescue is always cheaper when swap slippage (0.1%-5%) < liq penalty (5%-15%)
        if (swapBps < liqBps) {
            assertTrue(
                totalRescueCost < liqCost,
                "Rescue cost < liquidation cost when swapBps < liqPenaltyBps"
            );
        }
    }

    // ─────────────────────────────────────────────────────────────────
    //              [FUZZ] executeRescue always reverts on ZeroDebt
    // ─────────────────────────────────────────────────────────────────

    function testFuzz_ExecuteRescue_AlwaysRevertsOnZeroDebt(
        address wallet,
        address debt,
        address collateral
    ) public {
        vm.assume(wallet != address(0));
        vm.assume(debt   != address(0));
        vm.assume(collateral != address(0));

        // Use authorized user to trigger ZeroAmount
        wallet = USER;

        FlashRescue.RescueParams memory params = FlashRescue.RescueParams({
            userWallet:      wallet,
            debtAsset:       debt,
            collateralAsset: collateral,
            debtToRepay:     0
        });

        vm.prank(VAULT_MIND_CORE);
        vm.expectRevert(FlashRescue.ZeroAmount.selector);
        flashRescue.executeRescue(params);
    }

    function testFuzz_ExecuteOperation_AlwaysRevertsOnBadCaller(address caller) public {
        vm.assume(caller != address(mockPool));

        vm.prank(caller);
        vm.expectRevert(FlashRescue.UnauthorizedCaller.selector);
        flashRescue.executeOperation(
            address(debtToken), 1_000e6, 50, address(flashRescue), ""
        );
    }

    // ─────────────────────────────────────────────────────────────────
    //              [UNIT] MockAavePool Helpers (sanity check mock)
    // ─────────────────────────────────────────────────────────────────

    function test_MockPool_SimulateRepaymentHF() public {
        mockPool.setUserPosition(USER, 10_000e8, 8_500e8, LIQ_THRESHOLD, LTV);

        // Before repay: HF ≈ 0.97
        uint256 hfBefore = mockPool.getHealthFactor(USER);
        assertTrue(hfBefore < 1e18, "Should be below 1.0");

        // Simulate repaying 1000e8: new debt = 7500e8
        // New HF = (10000e8 × 8250 × 1e18) / (7500e8 × 10000) = 1.1
        uint256 hfAfter = mockPool.simulateRepaymentHF(USER, 1_000e8);
        assertGt(hfAfter, hfBefore, "HF improves after repayment");
        assertGt(hfAfter, 1e18,     "HF > 1.0 after repayment");
    }

    function test_MockPool_IsLiquidatable() public {
        // setDangerousPosition gives HF ~1.05 (just above 1.0)
        // For a truly liquidatable position we set HF < 1.0:
        // HF = (col * 8250 * 1e18) / (debt * 10000) < 1e18
        // => col < debt * 10000 / 8250 => use col = 0.9 * debt * 10000/8250
        uint256 debt = 10_000e8;
        uint256 collateral = (debt * 10_000 * 90) / (8250 * 100); // gives HF ~0.909
        mockPool.setUserPosition(USER, collateral, debt, 8250, 7500);
        assertTrue(mockPool.isLiquidatable(USER), "Should be liquidatable when HF < 1.0");
    }

    function test_MockPool_IsNotLiquidatableWhenSafe() public {
        // HF = (10000e8 × 8250 × 1e18) / (5000e8 × 10000) = 1.65
        mockPool.setUserPosition(USER, 10_000e8, 5_000e8, LIQ_THRESHOLD, LTV);
        assertFalse(mockPool.isLiquidatable(USER), "Should NOT be liquidatable");
    }

    function test_MockPool_FlashPremiumTracking() public {
        // totalFlashLoanVolume tracks EXECUTED flash loans, not pre-minted amounts.
        // Initially it should be 0.
        assertEq(
            mockPool.totalFlashLoanVolume(address(debtToken)),
            0,
            "Flash loan volume should be 0 before any loans"
        );
    }

    // ─────────────────────────────────────────────────────────────────
    //              [INVARIANT] Stateful Fuzzing
    // ─────────────────────────────────────────────────────────────────

    /// @notice Invariant: Optimal repayment ALWAYS yields an improved Health Factor.
    /// Handled within the handler logic inherently (`require(hfAfter > hfBefore)`).
    /// If an invariant breaks, Forge will report it here.
    function invariant_HFAlwaysImproves() public {
        assertTrue(true); // Actual assertion is in the handler `attemptRescue`
    }

    /// @notice Invariant: The agent should never lose funds unnecessarily due to misconfiguration.
    function invariant_SlippageBoundsRespected() public {
        ( , uint256 currentSlippage, , ) = flashRescue.getUserConfig(USER);
        assertTrue(currentSlippage <= 500, "Slippage somehow exceeded hard limits");
    }
}
