// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MockOKXDexRouter
 * @notice Mock of the OKX DEX Aggregator for Foundry tests.
 *         Simulates swaps with configurable slippage and price impact.
 */
import {MockERC20} from "./MockERC20.sol";

contract MockOKXDexRouter {
    uint256 public slippageBps = 30; // Default 0.3% swap slippage
    bool public shouldRevert = false;
    string public revertReason = "Slippage too high";

    event SwapExecuted(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut);

    function setSlippage(uint256 _bps) external {
        slippageBps = _bps;
    }

    function setShouldRevert(bool _revert, string calldata _reason) external {
        shouldRevert = _revert;
        revertReason = _reason;
    }

    /// @notice Simulates an OKX DEX swap with configurable slippage
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external returns (uint256 amountOut) {
        if (shouldRevert) revert(revertReason);

        // Pull tokenIn from caller
        require(
            MockERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn),
            "MockOKXDex: transferFrom failed"
        );

        // Calculate output with slippage
        amountOut = minAmountOut > 0 ? (minAmountOut * 10001) / 10000 : (amountIn * (10_000 - slippageBps)) / 10_000;

        require(amountOut >= minAmountOut, "MockOKXDex: insufficient output");

        // Mint tokenOut to recipient (simulating a real swap)
        MockERC20(tokenOut).mint(recipient, amountOut);

        emit SwapExecuted(tokenIn, tokenOut, amountIn, amountOut);
        return amountOut;
    }
}
