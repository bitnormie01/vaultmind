// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title FlashRescue
 * @author VaultMind Team — OKX Build X Hackathon
 * @notice Autonomous Aave V3 flash loan rescue module to prevent liquidations.
 */

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IFlashLoanSimpleReceiver, IPool, IPoolAddressesProvider, IPriceOracle} from "../interfaces/IAaveV3.sol";
import {IOKXDexRouter} from "../interfaces/IOKXDex.sol";
import {IVaultMindCore} from "../interfaces/IVaultMindCore.sol";

contract FlashRescue is IFlashLoanSimpleReceiver, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════════════
    //                          CONSTANTS
    // ═══════════════════════════════════════════════════════════════════

    /// @notice Aave V3 uses 1e18 for health factor, 1.0 = 1e18
    uint256 public constant HF_PRECISION = 1e18;

    /// @notice Default minimum target health factor after rescue (1.5)
    uint256 public constant DEFAULT_TARGET_HF = 15e17;

    /// @notice Maximum slippage tolerance in basis points (5% = 500)
    uint256 public constant MAX_SLIPPAGE_BPS = 500;

    /// @notice Basis points denominator
    uint256 public constant BPS_DENOMINATOR = 10_000;

    /// @notice Variable interest rate mode for Aave V3 repayment
    uint256 public constant VARIABLE_RATE_MODE = 2;

    // ═══════════════════════════════════════════════════════════════════
    //                          IMMUTABLES
    // ═══════════════════════════════════════════════════════════════════

    /// @notice The Aave V3 Pool Addresses Provider
    IPoolAddressesProvider public immutable ADDRESSES_PROVIDER;

    /// @notice The Aave V3 Lending Pool
    IPool public immutable POOL;

    /// @notice The OKX DEX Aggregator router for collateral-to-debt swaps
    IOKXDexRouter public immutable OKX_DEX;

    /// @notice The VaultMindCore contract for access control
    address public immutable VAULT_MIND_CORE;

    // ═══════════════════════════════════════════════════════════════════
    //                          STATE
    // ═══════════════════════════════════════════════════════════════════

    /// @notice Per-user target health factor after rescue
    mapping(address => uint256) public targetHealthFactor;

    /// @notice Per-user slippage tolerance in basis points
    mapping(address => uint256) public slippageTolerance;

    /// @notice Tracks total rescues performed per user
    mapping(address => uint256) public rescueCount;

    /// @notice Tracks total debt repaid per user (in base currency units)
    mapping(address => uint256) public totalDebtRepaid;

    // ═══════════════════════════════════════════════════════════════════
    //                          STRUCTS
    // ═══════════════════════════════════════════════════════════════════

    struct RescueParams {
        address userWallet;      // The wallet being rescued
        address debtAsset;       // The asset the user owes (e.g., USDC)
        address collateralAsset; // The user's collateral to partially liquidate
        uint256 debtToRepay;     // Amount of debt to repay
    }

    // ═══════════════════════════════════════════════════════════════════
    //                          EVENTS
    // ═══════════════════════════════════════════════════════════════════

    event RescueExecuted(
        address indexed userWallet,
        address indexed debtAsset,
        uint256 debtRepaid,
        uint256 flashLoanPremium,
        uint256 preRescueHF,
        uint256 postRescueHF
    );

    event RescueConfigUpdated(address indexed user, uint256 targetHF, uint256 slippageBps);

    // ═══════════════════════════════════════════════════════════════════
    //                          ERRORS
    // ═══════════════════════════════════════════════════════════════════

    error UnauthorizedCaller();
    error InvalidInitiator(address initiator);
    error SlippageTooHigh(uint256 requested, uint256 maximum);
    error TargetHFTooLow(uint256 requested, uint256 minimum);
    error RescueNotProfitable(uint256 preHF, uint256 postHF);
    error InsufficientRepayment(uint256 expected, uint256 actual);
    error ZeroAmount();
    error ZeroAddress();

    // ═══════════════════════════════════════════════════════════════════
    //                       CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════

    constructor(address addressesProvider, address okxDexRouter, address vaultMindCore) {
        if (addressesProvider == address(0) || okxDexRouter == address(0) || vaultMindCore == address(0)) {
            revert ZeroAddress();
        }

        ADDRESSES_PROVIDER = IPoolAddressesProvider(addressesProvider);
        POOL = IPool(ADDRESSES_PROVIDER.getPool());
        OKX_DEX = IOKXDexRouter(okxDexRouter);
        VAULT_MIND_CORE = vaultMindCore;
    }

    // ═══════════════════════════════════════════════════════════════════
    //                    CONFIGURATION
    // ═══════════════════════════════════════════════════════════════════

    function setRescueConfig(uint256 _targetHF, uint256 _slippageBps) external {
        if (!IVaultMindCore(VAULT_MIND_CORE).isModuleAuthorized(msg.sender, address(this))) revert UnauthorizedCaller();
        if (_targetHF < HF_PRECISION) revert TargetHFTooLow(_targetHF, HF_PRECISION);
        if (_slippageBps > MAX_SLIPPAGE_BPS) revert SlippageTooHigh(_slippageBps, MAX_SLIPPAGE_BPS);

        targetHealthFactor[msg.sender] = _targetHF;
        slippageTolerance[msg.sender] = _slippageBps;

        emit RescueConfigUpdated(msg.sender, _targetHF, _slippageBps);
    }

    // ═══════════════════════════════════════════════════════════════════
    //                    RESCUE EXECUTION
    // ═══════════════════════════════════════════════════════════════════

    function executeRescue(RescueParams calldata params) external nonReentrant {
        if (msg.sender != VAULT_MIND_CORE) revert UnauthorizedCaller();
        if (params.userWallet == address(0) || params.debtAsset == address(0) || params.collateralAsset == address(0)) revert ZeroAddress();
        if (params.debtToRepay == 0) revert ZeroAmount();
        if (!IVaultMindCore(VAULT_MIND_CORE).isModuleAuthorized(params.userWallet, address(this))) revert UnauthorizedCaller();

        // Record pre-rescue health factor for profitability check
        (, , , , , uint256 preRescueHF) = POOL.getUserAccountData(params.userWallet);

        // Encode rescue params for the flash loan callback
        bytes memory callbackData = abi.encode(params, preRescueHF);

        POOL.flashLoanSimple(
            address(this),
            params.debtAsset,
            params.debtToRepay,
            callbackData,
            0
        );

        // Verify post-rescue health factor improved
        (, , , , , uint256 postRescueHF) = POOL.getUserAccountData(params.userWallet);
        if (postRescueHF <= preRescueHF) {
            revert RescueNotProfitable(preRescueHF, postRescueHF);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    //                 FLASH LOAN CALLBACK
    // ═══════════════════════════════════════════════════════════════════

    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        if (msg.sender != address(POOL)) revert UnauthorizedCaller();
        if (initiator != address(this)) revert InvalidInitiator(initiator);

        (RescueParams memory rescueParams, uint256 preRescueHF) = abi.decode(params, (RescueParams, uint256));
        uint256 userSlippage = _getUserSlippage(rescueParams.userWallet);

        // ─── Step 1: Repay user's Aave debt ───
        IERC20(asset).forceApprove(address(POOL), amount);
        POOL.repay(asset, amount, VARIABLE_RATE_MODE, rescueParams.userWallet);
        // Reset repay allowance — Aave may not consume the full `amount` if actual debt < amount
        IERC20(asset).forceApprove(address(POOL), 0);

        // ─── Step 2: The user's collateral is now freed ───
        IPool.ReserveData memory reserve = POOL.getReserveData(rescueParams.collateralAsset);
        address aTokenAddress = reserve.aTokenAddress;

        uint256 totalOwed = amount + premium;

        // Calculate needed collateral
        // @dev Assumes ADDRESSES_PROVIDER.getPriceOracle() returns prices in the same base currency
        //      with the same precision for all assets (standard for Aave V3 deployments).
        address oracleAddress = ADDRESSES_PROVIDER.getPriceOracle();
        uint256 debtAssetPrice = IPriceOracle(oracleAddress).getAssetPrice(asset);
        uint256 collateralPrice = IPriceOracle(oracleAddress).getAssetPrice(rescueParams.collateralAsset);
        if (collateralPrice == 0 || debtAssetPrice == 0) revert ZeroAmount();

        uint8 debtDecimals = 18;
        try IERC20Metadata(asset).decimals() returns (uint8 d) { debtDecimals = d; } catch {}
        
        uint8 collatDecimals = 18;
        try IERC20Metadata(rescueParams.collateralAsset).decimals() returns (uint8 d) { collatDecimals = d; } catch {}

        uint256 collateralNeededAmount = (totalOwed * debtAssetPrice * (10 ** collatDecimals)) /
            (collateralPrice * (10 ** debtDecimals));
            
        uint256 collateralNeededWithBuffer = (collateralNeededAmount * BPS_DENOMINATOR) / (BPS_DENOMINATOR - userSlippage);

        uint256 aTokenBalance = IERC20(aTokenAddress).balanceOf(rescueParams.userWallet);
        uint256 withdrawAmount = collateralNeededWithBuffer > aTokenBalance ? aTokenBalance : collateralNeededWithBuffer;

        if (withdrawAmount > 0) {
            IERC20(aTokenAddress).safeTransferFrom(rescueParams.userWallet, address(this), withdrawAmount);
            POOL.withdraw(rescueParams.collateralAsset, withdrawAmount, address(this));
        }

        uint256 minAmountOut = (totalOwed * (BPS_DENOMINATOR - userSlippage)) / BPS_DENOMINATOR;

        // ─── Step 3: Swap collateral → debt asset via OKX DEX Aggregator ───
        uint256 collateralBalance = IERC20(rescueParams.collateralAsset).balanceOf(address(this));

        if (collateralBalance > 0) {
            IERC20(rescueParams.collateralAsset).forceApprove(address(OKX_DEX), collateralBalance);
            OKX_DEX.swap(
                rescueParams.collateralAsset, // tokenIn (collateral)
                asset,                        // tokenOut (debt asset)
                collateralBalance,
                minAmountOut,                 // slippage guard
                address(this)                 // receive output here
            );
            IERC20(rescueParams.collateralAsset).forceApprove(address(OKX_DEX), 0);
        }

        // ─── Step 4: Approve flash loan repayment and sweeping ───
        uint256 currentBalance = IERC20(asset).balanceOf(address(this));
        if (currentBalance < totalOwed) revert InsufficientRepayment(totalOwed, currentBalance);

        // Approve repayment
        IERC20(asset).forceApprove(address(POOL), totalOwed);

        // Sweep leftover debt asset
        uint256 leftoverDebtAsset = currentBalance - totalOwed;
        if (leftoverDebtAsset > 0) {
            IERC20(asset).safeTransfer(rescueParams.userWallet, leftoverDebtAsset);
        }

        // Sweep unswapped collateral
        uint256 leftoverCollateral = IERC20(rescueParams.collateralAsset).balanceOf(address(this));
        if (leftoverCollateral > 0) {
            IERC20(rescueParams.collateralAsset).safeTransfer(rescueParams.userWallet, leftoverCollateral);
        }

        // Update tracking
        unchecked { rescueCount[rescueParams.userWallet]++; }
        totalDebtRepaid[rescueParams.userWallet] += amount;

        // Fetch post-rescue HF inside operation to emit event accurately
        (, , , , , uint256 postRescueHF) = POOL.getUserAccountData(rescueParams.userWallet);
        emit RescueExecuted(
            rescueParams.userWallet,
            asset,
            amount,
            premium,
            preRescueHF,
            postRescueHF
        );

        return true;
    }

    // ═══════════════════════════════════════════════════════════════════
    //                      VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════

    function getUserHealthFactor(address user) external view returns (uint256 healthFactor) {
        (, , , , , healthFactor) = POOL.getUserAccountData(user);
    }

    function calculateOptimalRepayment(address user, address debtAsset) external view returns (uint256 repayAmount) {
        (
            uint256 totalCollateralBase,
            uint256 totalDebtBase,
            ,
            uint256 currentLiquidationThreshold,
            ,
            uint256 currentHF
        ) = POOL.getUserAccountData(user);

        uint256 target = _getUserTargetHF(user);

        if (currentHF >= target) return 0;

        uint256 maxDebtForTarget = (totalCollateralBase * currentLiquidationThreshold * HF_PRECISION) /
            (target * BPS_DENOMINATOR);

        if (totalDebtBase <= maxDebtForTarget) return 0;

        uint256 repayBase = totalDebtBase - maxDebtForTarget;

        address oracleAddress = ADDRESSES_PROVIDER.getPriceOracle();
        uint256 assetPrice = IPriceOracle(oracleAddress).getAssetPrice(debtAsset);
        uint256 decimals = 18; // default
        try IERC20Metadata(debtAsset).decimals() returns (uint8 d) {
            decimals = d;
        } catch {}

        if (assetPrice > 0) {
            repayAmount = (repayBase * (10 ** decimals)) / assetPrice;
        } else {
            repayAmount = 0;
        }
    }

    function getUserConfig(address user)
        external
        view
        returns (uint256 _targetHF, uint256 _slippageBps, uint256 _rescueCount, uint256 _totalRepaid)
    {
        return (
            _getUserTargetHF(user),
            _getUserSlippage(user),
            rescueCount[user],
            totalDebtRepaid[user]
        );
    }

    // ═══════════════════════════════════════════════════════════════════
    //                     INTERNAL HELPERS
    // ═══════════════════════════════════════════════════════════════════

    function _getUserTargetHF(address user) internal view returns (uint256) {
        uint256 userTarget = targetHealthFactor[user];
        return userTarget > 0 ? userTarget : DEFAULT_TARGET_HF;
    }

    function _getUserSlippage(address user) internal view returns (uint256) {
        uint256 userSlippage = slippageTolerance[user];
        return userSlippage > 0 ? userSlippage : 100; // Default 1%
    }
}
