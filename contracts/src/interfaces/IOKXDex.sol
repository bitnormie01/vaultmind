// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IOKXDex
 * @notice Interface for the OKX DEX Aggregator used inside FlashRescue.
 *
 * @dev This replaces the Uniswap V3 ISwapRouter. The OKX DEX aggregator
 *      is used via OnchainOS skills (okx-dex-swap / onchainos-trade) in the
 *      agent layer, and via this direct interface in the smart contract layer
 *      for on-chain execution of collateral → debt asset swaps.
 *
 * OKX DEX Aggregator on X Layer (Chain ID 196):
 *   The aggregator routes through the best available liquidity sources.
 *   For on-chain calls, we use the standard swap() interface.
 */
interface IOKXDexRouter {
    /// @notice Execute a token swap via OKX DEX aggregator
    /// @param tokenIn The input token address
    /// @param tokenOut The output token address
    /// @param amountIn The amount of tokenIn to swap
    /// @param minAmountOut Minimum output amount (slippage protection)
    /// @param recipient Address to receive tokenOut
    /// @return amountOut The actual amount of tokenOut received
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external returns (uint256 amountOut);
}

/// @notice Swap descriptor used in OKX aggregated multi-path swaps
struct OKXSwapDescription {
    address srcToken;
    address dstToken;
    address srcReceiver;
    address dstReceiver;
    uint256 amount;
    uint256 minReturnAmount;
    uint256 flags;
}

/// @notice Interface for the OKX 1inch-compatible aggregation router
/// @dev Used as an alternative entry point for complex aggregated routes
interface IOKXAggregationRouter {
    function swap(
        address executor,
        OKXSwapDescription calldata desc,
        bytes calldata permit,
        bytes calldata data
    ) external payable returns (uint256 returnAmount, uint256 spentAmount);
}
