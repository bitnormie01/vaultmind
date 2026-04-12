// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MockAavePool
 * @author VaultMind Team — OKX Build X Hackathon
 * @notice A comprehensive mock of the Aave V3 Pool for local Foundry fuzz testing.
 *         Does NOT require a mainnet fork — all state is managed in-memory.
 *
 * @dev This mock implements the full IPool interface used by FlashRescue.sol.
 *      Key behaviors:
 *        - getUserAccountData: returns configurable user positions with realistic HF calc
 *        - flashLoanSimple: calls executeOperation callback then pulls back funds + premium
 *        - repay: reduces user debt and recalculates health factor
 *        - Configurable flash loan premium (default: Aave V3 = 0.05%)
 *        - Configurable per-user positions for precise fuzz boundary testing
 */

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IFlashLoanSimpleReceiver, IPool} from "../../src/interfaces/IAaveV3.sol";

contract MockAavePool {
    // ═══════════════════════════════════════════════════════════════════
    //                          CONSTANTS
    // ═══════════════════════════════════════════════════════════════════

    /// @notice Aave V3 flash loan premium: 0.05% = 5 bps
    uint256 public constant DEFAULT_FLASH_PREMIUM_BPS = 5;
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant HF_PRECISION = 1e18;

    // ═══════════════════════════════════════════════════════════════════
    //                          STATE
    // ═══════════════════════════════════════════════════════════════════

    /// @notice Configurable flash loan premium (can be overridden in tests)
    uint256 public flashLoanPremiumBps = DEFAULT_FLASH_PREMIUM_BPS;

    /// @notice Per-user position data (mirrors Aave V3 getUserAccountData output)
    struct UserPosition {
        uint256 totalCollateralBase;           // Collateral in base currency (USD, 8 decimals)
        uint256 totalDebtBase;                 // Debt in base currency (USD, 8 decimals)
        uint256 availableBorrowsBase;          // Available to borrow
        uint256 currentLiquidationThreshold;  // In BPS (e.g., 8250 = 82.5%)
        uint256 ltv;                           // Loan-to-value in BPS
        uint256 healthFactor;                  // 1e18 precision
    }

    mapping(address => UserPosition) public positions;

    /// @notice Reserve data storage (simplified)
    mapping(address => IPool.ReserveData) internal _reserveData;

    /// @notice mock aToken mapping
    mapping(address => address) public mockATokens;

    /// @notice Track total flash loan volume per asset for testing analytics
    mapping(address => uint256) public totalFlashLoanVolume;

    /// @notice Track repayments per user per asset
    mapping(address => mapping(address => uint256)) public totalRepaid;

    // ═══════════════════════════════════════════════════════════════════
    //                          EVENTS
    // ═══════════════════════════════════════════════════════════════════

    event FlashLoan(address indexed receiver, address indexed asset, uint256 amount, uint256 premium);
    event Repay(address indexed reserve, uint256 amount, address indexed user);
    event PositionSet(address indexed user, uint256 totalCollateral, uint256 totalDebt, uint256 healthFactor);

    // ═══════════════════════════════════════════════════════════════════
    //                     TEST SETUP HELPERS
    // ═══════════════════════════════════════════════════════════════════

    /// @notice Set a user's position directly — called by test setup
    /// @param user The user's wallet address
    /// @param totalCollateralBase Total collateral in base currency units (8 dec)
    /// @param totalDebtBase Total debt in base currency units (8 dec)
    /// @param liqThresholdBps Liquidation threshold in BPS (e.g., 8250 = 82.5%)
    /// @param ltvBps Loan-to-value in BPS
    function setUserPosition(
        address user,
        uint256 totalCollateralBase,
        uint256 totalDebtBase,
        uint256 liqThresholdBps,
        uint256 ltvBps
    ) external {
        uint256 hf = _calculateHF(totalCollateralBase, totalDebtBase, liqThresholdBps);

        positions[user] = UserPosition({
            totalCollateralBase: totalCollateralBase,
            totalDebtBase: totalDebtBase,
            availableBorrowsBase: (totalCollateralBase * ltvBps / BPS_DENOMINATOR) > totalDebtBase
                ? (totalCollateralBase * ltvBps / BPS_DENOMINATOR) - totalDebtBase
                : 0,
            currentLiquidationThreshold: liqThresholdBps,
            ltv: ltvBps,
            healthFactor: hf
        });

        emit PositionSet(user, totalCollateralBase, totalDebtBase, hf);
    }

    /// @notice Set a dangerous position (HF just above 1.0) for liquidation risk tests
    function setDangerousPosition(address user, uint256 debtBase) external {
        // Collateral sized so HF ≈ 1.05 with 82.5% liqThreshold
        // HF = col * 8250 / (debt * 10000) = 1.05
        // col = debt * 10000 * 1.05 / 8250 ≈ debt * 1.273
        uint256 collateral = (debtBase * 10_000 * 105) / (8250 * 100);
        this.setUserPosition(user, collateral, debtBase, 8250, 7500);
    }

    /// @notice Override the flash loan premium for testing high-premium scenarios
    function setFlashLoanPremium(uint256 premiumBps) external {
        require(premiumBps <= 100, "Premium too high"); // Max 1%
        flashLoanPremiumBps = premiumBps;
    }

    // ═══════════════════════════════════════════════════════════════════
    //                    IPool IMPLEMENTATION
    // ═══════════════════════════════════════════════════════════════════

    /// @notice Returns the user's account data across all reserves
    function getUserAccountData(address user)
        external
        view
        returns (
            uint256 totalCollateralBase,
            uint256 totalDebtBase,
            uint256 availableBorrowsBase,
            uint256 currentLiquidationThreshold,
            uint256 ltv,
            uint256 healthFactor
        )
    {
        UserPosition memory pos = positions[user];
        return (
            pos.totalCollateralBase,
            pos.totalDebtBase,
            pos.availableBorrowsBase,
            pos.currentLiquidationThreshold,
            pos.ltv,
            pos.healthFactor
        );
    }

    /// @notice Executes a simple flash loan
    /// @dev Transfers asset to receiver → calls executeOperation → pulls back amount + premium
    function flashLoanSimple(
        address receiverAddress,
        address asset,
        uint256 amount,
        bytes calldata params,
        uint16 /* referralCode */
    ) external {
        uint256 premium = (amount * flashLoanPremiumBps) / BPS_DENOMINATOR;
        uint256 totalOwed = amount + premium;

        // Record volume for test analytics
        totalFlashLoanVolume[asset] += amount;

        // Transfer borrowed asset to receiver
        require(IERC20(asset).transfer(receiverAddress, amount), "Flash loan transfer failed");

        // Call executeOperation on the receiver (the IFlashLoanSimpleReceiver callback)
        bool success = IFlashLoanSimpleReceiver(receiverAddress).executeOperation(
            asset,
            amount,
            premium,
            receiverAddress, // initiator = receiver in mock (matches FlashRescue check)
            params
        );
        require(success, "Flash loan: executeOperation returned false");

        // Pull repayment (amount + premium) from receiver
        require(
            IERC20(asset).transferFrom(receiverAddress, address(this), totalOwed),
            "Flash loan repayment failed"
        );

        emit FlashLoan(receiverAddress, asset, amount, premium);
    }

    /// @notice Repays a borrowed amount for a user — reduces debt and recalculates HF
    function repay(
        address asset,
        uint256 amount,
        uint256, /* interestRateMode */
        address onBehalfOf
    ) external returns (uint256 repaidAmount) {
        UserPosition storage pos = positions[onBehalfOf];

        // Cap repayment at total debt
        repaidAmount = amount > pos.totalDebtBase ? pos.totalDebtBase : amount;

        // Reduce debt
        pos.totalDebtBase -= repaidAmount;

        // Update available borrows
        uint256 maxBorrow = (pos.totalCollateralBase * pos.ltv) / BPS_DENOMINATOR;
        pos.availableBorrowsBase = maxBorrow > pos.totalDebtBase ? maxBorrow - pos.totalDebtBase : 0;

        // Recalculate health factor
        pos.healthFactor = _calculateHF(pos.totalCollateralBase, pos.totalDebtBase, pos.currentLiquidationThreshold);

        // Track repayments per asset
        totalRepaid[onBehalfOf][asset] += repaidAmount;

        emit Repay(asset, repaidAmount, onBehalfOf);
        return repaidAmount;
    }

    /// @notice Set mock aToken for an asset
    function setMockAToken(address asset, address aToken) external {
        mockATokens[asset] = aToken;
    }

    /// @notice Returns reserve data (minimal implementation for test compatibility)
    function getReserveData(address asset) external view returns (IPool.ReserveData memory) {
        return IPool.ReserveData({
            configuration: 0,
            liquidityIndex: 1e27,        // Ray precision
            currentLiquidityRate: 0,
            variableBorrowIndex: 1e27,
            currentVariableBorrowRate: 0,
            currentStableBorrowRate: 0,
            lastUpdateTimestamp: 0,
            id: 0,
            aTokenAddress: mockATokens[asset] != address(0) ? mockATokens[asset] : address(this), // Fallback
            stableDebtTokenAddress: address(0),
            variableDebtTokenAddress: address(0),
            interestRateStrategyAddress: address(0),
            accruedToTreasury: 0,
            unbacked: 0,
            isolationModeTotalDebt: 0
        });
    }

    /// @notice Mock withdraw method
    function withdraw(address asset, uint256 amount, address to) external returns (uint256) {
        uint256 bal = IERC20(asset).balanceOf(address(this));
        uint256 amountToTransfer = amount == type(uint256).max ? bal : amount;
        if (amountToTransfer > 0) {
            IERC20(asset).transfer(to, amountToTransfer);
        }
        return amountToTransfer;
    }

    // ═══════════════════════════════════════════════════════════════════
    //                    TEST QUERY HELPERS
    // ═══════════════════════════════════════════════════════════════════

    /// @notice Get the current health factor for a user (for test assertions)
    function getHealthFactor(address user) external view returns (uint256) {
        return positions[user].healthFactor;
    }

    /// @notice Check if a position is liquidatable (HF < 1.0)
    function isLiquidatable(address user) external view returns (bool) {
        return positions[user].healthFactor < HF_PRECISION && positions[user].totalDebtBase > 0;
    }

    /// @notice Simulate the HF after a hypothetical debt repayment (for test predictions)
    function simulateRepaymentHF(address user, uint256 repayAmount) external view returns (uint256) {
        UserPosition memory pos = positions[user];
        uint256 newDebt = repayAmount >= pos.totalDebtBase ? 0 : pos.totalDebtBase - repayAmount;
        return _calculateHF(pos.totalCollateralBase, newDebt, pos.currentLiquidationThreshold);
    }

    // ═══════════════════════════════════════════════════════════════════
    //                    INTERNAL HELPERS
    // ═══════════════════════════════════════════════════════════════════

    /// @dev HF = (collateral × liqThreshold × HF_PRECISION) / (debt × BPS_DENOMINATOR)
    function _calculateHF(
        uint256 collateral,
        uint256 debt,
        uint256 liqThresholdBps
    ) internal pure returns (uint256) {
        if (debt == 0) return type(uint256).max;
        return (collateral * liqThresholdBps * HF_PRECISION) / (debt * BPS_DENOMINATOR);
    }
}
