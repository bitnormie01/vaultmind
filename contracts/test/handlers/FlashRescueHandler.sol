// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {FlashRescue} from "../../src/modules/FlashRescue.sol";
import {MockAavePool} from "../mocks/MockAavePool.sol";
import {MockERC20} from "../mocks/MockERC20.sol";

contract FlashRescueHandler is Test {
    FlashRescue public rescue;
    MockAavePool public pool;
    address public debtAsset;
    address public colAsset;

    address public constant USER = address(0xAAAA);
    uint256 public constant LIQ_THRESHOLD = 8250; 
    uint256 public constant LTV = 7500;

    uint256 public ghostTotalRepaid;     // to track if replay actually happened
    uint256 public ghostReverts;         // to see how many were bypassed

    constructor(
        FlashRescue _rescue,
        MockAavePool _pool,
        address _debtAsset,
        address _colAsset
    ) {
        rescue = _rescue;
        pool = _pool;
        debtAsset = _debtAsset;
        colAsset = _colAsset;
    }

    /// @notice Simulate market volatility changing the user's position
    function simulateMarketVolatility(
        uint256 collateralBase,
        uint256 debtBase
    ) public {
        collateralBase = bound(collateralBase, 1e8, 1_000_000e8);
        debtBase = bound(debtBase, 0, collateralBase); // up to 100% debt

        pool.setUserPosition(USER, collateralBase, debtBase, LIQ_THRESHOLD, LTV);
    }

    /// @notice Set rescue config
    function setRescueConfig(uint256 targetHFRaw, uint256 slippageRaw) public {
        // limit bounds to avoid reverts counting as failures in fuzzer
        uint256 targetHF = bound(targetHFRaw, 1e18, 10e18); // 1.0 -> 10.0
        uint256 slippage = bound(slippageRaw, 1, 500); // 0.01% -> 5%

        vm.prank(USER);
        rescue.setRescueConfig(targetHF, slippage);
    }

    /// @notice Try to execute a rescue based on current state
    function attemptRescue() public {
        // If HF >= target, calculateOptimalRepayment is 0
        uint256 optimalRepay = rescue.calculateOptimalRepayment(USER, debtAsset);
        
        if (optimalRepay == 0) {
            ghostReverts++;
            return;
        }

        FlashRescue.RescueParams memory p = FlashRescue.RescueParams({
            userWallet: USER,
            debtAsset: debtAsset,
            collateralAsset: colAsset,
            debtToRepay: optimalRepay
        });

        // Seed collateral so swap works in mock
        MockERC20(colAsset).mint(address(rescue), 10_000e18); 
        
        uint256 hfBefore = pool.getHealthFactor(USER);

        rescue.executeRescue(p);

        uint256 hfAfter = pool.getHealthFactor(USER);

        // INVARIANT 1: HF MUST IMPROVE
        require(hfAfter > hfBefore, "Handler: HF did not improve");
        
        // INVARIANT 2: HF MUST REACH AT LEAST TARGET (modulo rounding)
        uint256 targetHF = rescue.targetHealthFactor(USER) > 0 ? rescue.targetHealthFactor(USER) : rescue.DEFAULT_TARGET_HF();
        if (pool.isLiquidatable(USER) == false) {
             // Target hit?
             require(hfAfter >= targetHF - 1, "Handler: Missed target HF");
        }

        ghostTotalRepaid += optimalRepay;
    }
}
