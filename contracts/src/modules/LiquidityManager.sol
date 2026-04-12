// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title LiquidityManager
 * @author VaultMind Team — OKX Build X Hackathon
 * @notice Autonomous Uniswap V3 concentrated liquidity rebalancing module.
 *
 * @dev Architecture:
 *   1. Agent detects LP position is out of range (current tick outside tickLower..tickUpper)
 *   2. Agent calls `rebalancePosition()` with the new optimal tick range
 *   3. This contract:
 *      a. Decreases liquidity (burns) from the old position
 *      b. Collects all tokens + accrued fees
 *      c. Recalculates optimal amounts for the new range using sqrtPriceX96 math
 *      d. Mints a new position with the recalculated tick bounds
 *
 * Tick Math (sqrtPriceX96):
 *   - sqrtPriceX96 = sqrt(price) × 2^96
 *   - price = (sqrtPriceX96 / 2^96)^2
 *   - tick = floor(log_1.0001(price))
 *
 *   For a given range [tickLower, tickUpper] and liquidity L:
 *     amount0 = L × (1/sqrt(priceLower) - 1/sqrt(priceUpper))
 *     amount1 = L × (sqrt(priceUpper) - sqrt(priceLower))
 *
 *   Where sqrt(price) values are derived from ticks:
 *     sqrt(price) = 1.0001^(tick/2)
 *
 */

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {INonfungiblePositionManager, IUniswapV3Pool, IUniswapV3Factory} from "../interfaces/IUniswapV3.sol";
import {IVaultMindCore} from "../interfaces/IVaultMindCore.sol";
import {IOKXDexRouter} from "../interfaces/IOKXDex.sol";
import {TickMath} from "../libraries/TickMath.sol";

contract LiquidityManager is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════════════
    //                          CONSTANTS
    // ═══════════════════════════════════════════════════════════════════

    /// @notice Q96 constant for fixed-point sqrtPriceX96 math
    uint256 public constant Q96 = 2 ** 96;

    /// @notice Maximum allowable slippage for liquidity operations (3%)
    uint256 public constant MAX_SLIPPAGE_BPS = 300;

    /// @notice Basis points denominator
    uint256 public constant BPS_DENOMINATOR = 10_000;

    // ═══════════════════════════════════════════════════════════════════
    //                          IMMUTABLES
    // ═══════════════════════════════════════════════════════════════════

    /// @notice Uniswap V3 NonfungiblePositionManager
    INonfungiblePositionManager public immutable POSITION_MANAGER;

    /// @notice Uniswap V3 Factory
    IUniswapV3Factory public immutable FACTORY;

    /// @notice VaultMindCore access control contract
    address public immutable VAULT_MIND_CORE;

    /// @notice OKX DEX Aggregator router
    IOKXDexRouter public immutable OKX_DEX;

    // ═══════════════════════════════════════════════════════════════════
    //                          STATE
    // ═══════════════════════════════════════════════════════════════════

    /// @notice Per-user rebalance configuration
    struct RebalanceConfig {
        uint256 slippageBps;        // Slippage tolerance
        int24 tickSpread;           // Number of tick spacings above/below current tick
        uint256 minRebalanceValue;  // Minimum position value to trigger rebalance (in token0 units)
    }

    mapping(address => RebalanceConfig) public userConfigs;

    /// @notice Tracks rebalance history
    mapping(address => uint256) public rebalanceCount;

    // ═══════════════════════════════════════════════════════════════════
    //                          STRUCTS
    // ═══════════════════════════════════════════════════════════════════

    /// @notice Parameters for a rebalance operation
    struct RebalanceParams {
        address userWallet;      // The user's wallet
        uint256 tokenId;         // The NFT token ID of the LP position
        int24 newTickLower;      // New lower tick bound
        int24 newTickUpper;      // New upper tick bound
    }

    // ═══════════════════════════════════════════════════════════════════
    //                          EVENTS
    // ═══════════════════════════════════════════════════════════════════

    event PositionRebalanced(
        address indexed userWallet,
        uint256 indexed oldTokenId,
        uint256 indexed newTokenId,
        int24 oldTickLower,
        int24 oldTickUpper,
        int24 newTickLower,
        int24 newTickUpper,
        uint128 newLiquidity
    );

    event RebalanceConfigUpdated(address indexed user, uint256 slippageBps, int24 tickSpread);

    // ═══════════════════════════════════════════════════════════════════
    //                          ERRORS
    // ═══════════════════════════════════════════════════════════════════

    error UnauthorizedCaller();
    error PositionStillInRange(int24 currentTick, int24 tickLower, int24 tickUpper);
    error InvalidTickRange(int24 tickLower, int24 tickUpper);
    error SlippageTooHigh(uint256 requested, uint256 maximum);
    error ZeroLiquidity();
    error ZeroAddress();
    error InvalidPositionOwner(address owner, address expected);
    error Paused();
    error InvalidTickSpread();

    // ═══════════════════════════════════════════════════════════════════
    //                       CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════

    constructor(address positionManager, address factory, address vaultMindCore, address okxDexRouter) {
        if (positionManager == address(0) || factory == address(0) || vaultMindCore == address(0) || okxDexRouter == address(0)) {
            revert ZeroAddress();
        }
        POSITION_MANAGER = INonfungiblePositionManager(positionManager);
        FACTORY = IUniswapV3Factory(factory);
        VAULT_MIND_CORE = vaultMindCore;
        OKX_DEX = IOKXDexRouter(okxDexRouter);
    }

    // ═══════════════════════════════════════════════════════════════════
    //                    CONFIGURATION
    // ═══════════════════════════════════════════════════════════════════

    /// @notice Set the user's rebalance configuration
    function setRebalanceConfig(uint256 slippageBps, int24 tickSpread, uint256 minRebalanceValue) external {
        if (slippageBps > MAX_SLIPPAGE_BPS) revert SlippageTooHigh(slippageBps, MAX_SLIPPAGE_BPS);
        if (tickSpread <= 0) revert InvalidTickSpread();

        userConfigs[msg.sender] = RebalanceConfig({
            slippageBps: slippageBps,
            tickSpread: tickSpread,
            minRebalanceValue: minRebalanceValue
        });

        emit RebalanceConfigUpdated(msg.sender, slippageBps, tickSpread);
    }

    // ═══════════════════════════════════════════════════════════════════
    //                    REBALANCE EXECUTION
    // ═══════════════════════════════════════════════════════════════════

    /// @notice Rebalance a Uniswap V3 LP position to a new tick range
    /// @param params The rebalance parameters
    /// @return newTokenId The token ID of the newly minted position
    function rebalancePosition(RebalanceParams calldata params) external nonReentrant returns (uint256 newTokenId) {
        if (!IVaultMindCore(VAULT_MIND_CORE).isAuthorized(params.userWallet, msg.sender)) {
            revert UnauthorizedCaller();
        }
        if (IVaultMindCore(VAULT_MIND_CORE).paused()) revert Paused();

        address positionOwner = POSITION_MANAGER.ownerOf(params.tokenId);
        if (positionOwner != params.userWallet) {
            revert InvalidPositionOwner(positionOwner, params.userWallet);
        }

        if (params.newTickLower >= params.newTickUpper) {
            revert InvalidTickRange(params.newTickLower, params.newTickUpper);
        }

        // ─── Step 1: Read the old position ───
        (
            ,
            ,
            address token0,
            address token1,
            uint24 fee,
            int24 oldTickLower,
            int24 oldTickUpper,
            uint128 liquidity,
            ,
            ,
            ,
        ) = POSITION_MANAGER.positions(params.tokenId);

        if (liquidity == 0) revert ZeroLiquidity();

        // ─── Step 2: Verify position is out of range ───
        address pool = FACTORY.getPool(token0, token1, fee);
        (uint160 currentSqrtPriceX96, int24 currentTick, , , , , ) = IUniswapV3Pool(pool).slot0();

        if (currentTick >= oldTickLower && currentTick < oldTickUpper) {
            revert PositionStillInRange(currentTick, oldTickLower, oldTickUpper);
        }

        uint256 slippage = _getUserSlippage(params.userWallet);

        // ─── Step 3: Remove all liquidity from old position ───
        uint160 sqrtRatioOldLowerX96 = TickMath.getSqrtRatioAtTick(oldTickLower);
        uint160 sqrtRatioOldUpperX96 = TickMath.getSqrtRatioAtTick(oldTickUpper);
        uint256 expectedAmt0 = 0;
        uint256 expectedAmt1 = 0;
        
        if (currentSqrtPriceX96 <= sqrtRatioOldLowerX96) {
           expectedAmt0 = (uint256(liquidity) * Q96 / sqrtRatioOldUpperX96) * (sqrtRatioOldUpperX96 - sqrtRatioOldLowerX96) / sqrtRatioOldLowerX96;
        } else if (currentSqrtPriceX96 < sqrtRatioOldUpperX96) {
           expectedAmt0 = (uint256(liquidity) * Q96 / sqrtRatioOldUpperX96) * (sqrtRatioOldUpperX96 - currentSqrtPriceX96) / currentSqrtPriceX96;
           expectedAmt1 = (uint256(liquidity) * (currentSqrtPriceX96 - sqrtRatioOldLowerX96)) / Q96;
        } else {
           expectedAmt1 = (uint256(liquidity) * (sqrtRatioOldUpperX96 - sqrtRatioOldLowerX96)) / Q96;
        }

        POSITION_MANAGER.decreaseLiquidity(
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: params.tokenId,
                liquidity: liquidity,
                amount0Min: (expectedAmt0 * (BPS_DENOMINATOR - slippage)) / BPS_DENOMINATOR,
                amount1Min: (expectedAmt1 * (BPS_DENOMINATOR - slippage)) / BPS_DENOMINATOR,
                deadline: block.timestamp + 120
            })
        );

        // ─── Step 4: Collect all tokens (including fees) ───
        (uint256 collected0, uint256 collected1) = POSITION_MANAGER.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: params.tokenId,
                recipient: address(this),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            })
        );

        // ─── Step 5: Burn the old NFT ───
        POSITION_MANAGER.burn(params.tokenId);

        // ─── Step 5.5: Single-Sided Swap using Precise Tick Math ───
        uint160 sqrtRatioLowerX96 = TickMath.getSqrtRatioAtTick(params.newTickLower);
        uint160 sqrtRatioUpperX96 = TickMath.getSqrtRatioAtTick(params.newTickUpper);

        if (currentTick > params.newTickLower && currentTick < params.newTickUpper) {
            // Guard: sqrtPrice can shift between slot0() read and here — clamp to range bounds
            uint160 clampedSqrtPrice = currentSqrtPriceX96;
            if (clampedSqrtPrice > sqrtRatioUpperX96) clampedSqrtPrice = sqrtRatioUpperX96;
            if (clampedSqrtPrice < sqrtRatioLowerX96) clampedSqrtPrice = sqrtRatioLowerX96;

            uint256 amount0Fixed = (uint256(Q96) * (sqrtRatioUpperX96 - clampedSqrtPrice)) / sqrtRatioUpperX96;
            uint256 delta0 = (amount0Fixed * Q96) / clampedSqrtPrice;
            uint256 delta1 = uint256(clampedSqrtPrice - sqrtRatioLowerX96);

            // To avoid overflow in (C * C), we distribute the division by Q96:
            // p_ratio = C * (C / Q96) + (C * (C % Q96)) / Q96
            uint256 c = uint256(clampedSqrtPrice);
            uint256 p_ratio = c * (c / Q96) + (c * (c % Q96)) / Q96;
            
            uint256 delta0_P = (delta0 * p_ratio) / Q96;

            if (collected0 > 0 && collected1 == 0) {
                uint256 swapAmount = (collected0 * delta1) / (delta1 + delta0_P);
                if (swapAmount > 0) {
                    uint256 expectedOut = (swapAmount * uint256(currentSqrtPriceX96) / Q96 * uint256(currentSqrtPriceX96)) / Q96;
                    uint256 minOut = (expectedOut * (BPS_DENOMINATOR - slippage)) / BPS_DENOMINATOR;

                    IERC20(token0).forceApprove(address(OKX_DEX), swapAmount);
                    collected1 = OKX_DEX.swap(token0, token1, swapAmount, minOut, address(this));
                    collected0 -= swapAmount;
                    IERC20(token0).forceApprove(address(OKX_DEX), 0);
                }
            } else if (collected1 > 0 && collected0 == 0) {
                uint256 swapAmount = (collected1 * delta0_P) / (delta1 + delta0_P);
                if (swapAmount > 0) {
                    uint256 expectedOut = (swapAmount * Q96 / uint256(currentSqrtPriceX96) * Q96) / uint256(currentSqrtPriceX96);
                    uint256 minOut = (expectedOut * (BPS_DENOMINATOR - slippage)) / BPS_DENOMINATOR;

                    IERC20(token1).forceApprove(address(OKX_DEX), swapAmount);
                    collected0 = OKX_DEX.swap(token1, token0, swapAmount, minOut, address(this));
                    collected1 -= swapAmount;
                    IERC20(token1).forceApprove(address(OKX_DEX), 0);
                }
            }
        }

        // ─── Step 6: Approve tokens for the new mint ───
        IERC20(token0).forceApprove(address(POSITION_MANAGER), collected0);
        IERC20(token1).forceApprove(address(POSITION_MANAGER), collected1);

        // ─── Step 7: Mint new position with new tick range ───
        uint256 amount0Min = (collected0 * (BPS_DENOMINATOR - slippage)) / BPS_DENOMINATOR;
        uint256 amount1Min = (collected1 * (BPS_DENOMINATOR - slippage)) / BPS_DENOMINATOR;

        uint128 newLiquidity;
        (newTokenId, newLiquidity, , ) = POSITION_MANAGER.mint(
            INonfungiblePositionManager.MintParams({
                token0: token0,
                token1: token1,
                fee: fee,
                tickLower: params.newTickLower,
                tickUpper: params.newTickUpper,
                amount0Desired: collected0,
                amount1Desired: collected1,
                amount0Min: amount0Min,
                amount1Min: amount1Min,
                recipient: params.userWallet,
                deadline: block.timestamp + 120
            })
        );
        
        IERC20(token0).forceApprove(address(POSITION_MANAGER), 0);
        IERC20(token1).forceApprove(address(POSITION_MANAGER), 0);

        // ─── Step 8: Return any remaining tokens to the user ───
        _returnResidualTokens(token0, token1, params.userWallet);

        unchecked { rebalanceCount[params.userWallet]++; }

        emit PositionRebalanced(
            params.userWallet,
            params.tokenId,
            newTokenId,
            oldTickLower,
            oldTickUpper,
            params.newTickLower,
            params.newTickUpper,
            newLiquidity
        );
    }

    // ═══════════════════════════════════════════════════════════════════
    //                      VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════

    /// @notice Check if a position is currently out of range
    /// @param tokenId The NFT token ID of the position
    /// @return outOfRange True if the position needs rebalancing
    /// @return currentTick The current pool tick
    /// @return tickLower The position's lower tick
    /// @return tickUpper The position's upper tick
    function isPositionOutOfRange(uint256 tokenId)
        external
        view
        returns (bool outOfRange, int24 currentTick, int24 tickLower, int24 tickUpper)
    {
        (, , address token0, address token1, uint24 fee, int24 _tickLower, int24 _tickUpper, , , , , ) =
            POSITION_MANAGER.positions(tokenId);

        address pool = FACTORY.getPool(token0, token1, fee);
        (, int24 _currentTick, , , , , ) = IUniswapV3Pool(pool).slot0();

        outOfRange = _currentTick < _tickLower || _currentTick >= _tickUpper;
        currentTick = _currentTick;
        tickLower = _tickLower;
        tickUpper = _tickUpper;
    }

    /// @notice Calculate the optimal new tick range centered around current price
    /// @param tokenId The current position's token ID
    /// @param tickSpread Number of tick spacings above/below current tick
    /// @return newTickLower Suggested new lower tick
    /// @return newTickUpper Suggested new upper tick
    function calculateOptimalRange(uint256 tokenId, int24 tickSpread)
        external
        view
        returns (int24 newTickLower, int24 newTickUpper)
    {
        (, , address token0, address token1, uint24 fee, , , , , , , ) = POSITION_MANAGER.positions(tokenId);

        address pool = FACTORY.getPool(token0, token1, fee);
        (, int24 currentTick, , , , , ) = IUniswapV3Pool(pool).slot0();
        int24 spacing = IUniswapV3Pool(pool).tickSpacing();

        // Align tick to spacing, rounding toward negative infinity (floor division).
        // Solidity truncates toward zero, so negative ticks need an adjustment:
        // e.g. tick=-7, spacing=10 → (-7/10)*10 = 0 (wrong), should be -10.
        int24 alignedTick = (currentTick / spacing) * spacing;
        if (currentTick < 0 && currentTick % spacing != 0) alignedTick -= spacing;

        newTickLower = alignedTick - (tickSpread * spacing);
        newTickUpper = alignedTick + (tickSpread * spacing);
    }

    // ═══════════════════════════════════════════════════════════════════
    //                     INTERNAL HELPERS
    // ═══════════════════════════════════════════════════════════════════

    /// @dev Return any tokens remaining after the mint to the user
    function _returnResidualTokens(address token0, address token1, address recipient) internal {
        uint256 residual0 = IERC20(token0).balanceOf(address(this));
        uint256 residual1 = IERC20(token1).balanceOf(address(this));

        if (residual0 > 0) IERC20(token0).safeTransfer(recipient, residual0);
        if (residual1 > 0) IERC20(token1).safeTransfer(recipient, residual1);
    }

    /// @dev Get user's slippage tolerance, defaulting to 100 bps (1%)
    function _getUserSlippage(address user) internal view returns (uint256) {
        uint256 s = userConfigs[user].slippageBps;
        return s > 0 ? s : 100;
    }
}
