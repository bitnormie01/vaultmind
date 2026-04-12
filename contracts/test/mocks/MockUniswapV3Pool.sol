// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MockUniswapV3Pool
 * @notice Mock Uniswap V3 Pool for testing LiquidityManager tick-math logic.
 * @dev Supports configurable slot0 (sqrtPriceX96, tick) and tick spacing.
 */

contract MockUniswapV3Pool {
    uint160 public sqrtPriceX96;
    int24 public tick;
    int24 public _tickSpacing;
    address public _token0;
    address public _token1;
    uint24 public _fee;
    uint128 public _liquidity;

    constructor(
        address token0_,
        address token1_,
        uint24 fee_,
        int24 tickSpacing_,
        uint160 sqrtPriceX96_,
        int24 initialTick_
    ) {
        _token0 = token0_;
        _token1 = token1_;
        _fee = fee_;
        _tickSpacing = tickSpacing_;
        sqrtPriceX96 = sqrtPriceX96_;
        tick = initialTick_;
        _liquidity = 1e18; // default liquidity
    }

    // ── Configurable setters for fuzz testing ──

    function setSlot0(uint160 _sqrtPriceX96, int24 _tick) external {
        sqrtPriceX96 = _sqrtPriceX96;
        tick = _tick;
    }

    function setLiquidity(uint128 liq) external {
        _liquidity = liq;
    }

    // ── IUniswapV3Pool interface ──

    function slot0()
        external
        view
        returns (
            uint160, int24, uint16, uint16, uint16, uint8, bool
        )
    {
        return (sqrtPriceX96, tick, 0, 0, 0, 0, true);
    }

    function fee() external view returns (uint24) { return _fee; }
    function token0() external view returns (address) { return _token0; }
    function token1() external view returns (address) { return _token1; }
    function tickSpacing() external view returns (int24) { return _tickSpacing; }
    function liquidity() external view returns (uint128) { return _liquidity; }
}
