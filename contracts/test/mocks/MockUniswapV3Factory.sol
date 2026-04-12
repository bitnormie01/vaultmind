// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MockUniswapV3Factory
 * @notice Mock Uniswap V3 Factory for LiquidityManager tests.
 * @dev Maps (token0, token1, fee) → pool address using a preregistered mapping.
 */

contract MockUniswapV3Factory {
    mapping(bytes32 => address) internal _pools;

    function registerPool(address tokenA, address tokenB, uint24 fee, address pool) external {
        // Sort tokens like Uniswap does
        (address t0, address t1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        bytes32 key = keccak256(abi.encodePacked(t0, t1, fee));
        _pools[key] = pool;
    }

    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool) {
        (address t0, address t1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        bytes32 key = keccak256(abi.encodePacked(t0, t1, fee));
        return _pools[key];
    }
}
