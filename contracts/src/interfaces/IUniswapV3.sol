// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IUniswapV3
/// @notice Interfaces for Uniswap V3 integration in VaultMind
/// @dev Used by LiquidityManager.sol for position management

/// @notice Interface for the Uniswap V3 NonfungiblePositionManager
interface INonfungiblePositionManager {
    struct MintParams {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        address recipient;
        uint256 deadline;
    }

    struct IncreaseLiquidityParams {
        uint256 tokenId;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        uint256 deadline;
    }

    struct DecreaseLiquidityParams {
        uint256 tokenId;
        uint128 liquidity;
        uint256 amount0Min;
        uint256 amount1Min;
        uint256 deadline;
    }

    struct CollectParams {
        uint256 tokenId;
        address recipient;
        uint128 amount0Max;
        uint128 amount1Max;
    }

    /// @notice Returns the owner of the given token ID
    function ownerOf(uint256 tokenId) external view returns (address owner);

    /// @notice Creates a new position wrapped in an NFT
    function mint(MintParams calldata params)
        external
        payable
        returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1);

    /// @notice Increases liquidity in an existing position
    function increaseLiquidity(IncreaseLiquidityParams calldata params)
        external
        payable
        returns (uint128 liquidity, uint256 amount0, uint256 amount1);

    /// @notice Decreases liquidity in an existing position
    function decreaseLiquidity(DecreaseLiquidityParams calldata params)
        external
        payable
        returns (uint256 amount0, uint256 amount1);

    /// @notice Collects tokens owed to a position
    function collect(CollectParams calldata params) external payable returns (uint256 amount0, uint256 amount1);

    /// @notice Burns a token ID which deletes it from the NFT contract
    function burn(uint256 tokenId) external payable;

    /// @notice Returns the position info for a given token ID
    function positions(uint256 tokenId)
        external
        view
        returns (
            uint96 nonce,
            address operator,
            address token0,
            address token1,
            uint24 fee,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            uint256 feeGrowthInside0LastX128,
            uint256 feeGrowthInside1LastX128,
            uint128 tokensOwed0,
            uint128 tokensOwed1
        );
}

/// @notice Interface for Uniswap V3 Pool
interface IUniswapV3Pool {
    /// @notice Returns the current price and tick
    function slot0()
        external
        view
        returns (
            uint160 sqrtPriceX96,
            int24 tick,
            uint16 observationIndex,
            uint16 observationCardinality,
            uint16 observationCardinalityNext,
            uint8 feeProtocol,
            bool unlocked
        );

    /// @notice Returns the pool's fee
    function fee() external view returns (uint24);

    /// @notice Returns token0
    function token0() external view returns (address);

    /// @notice Returns token1
    function token1() external view returns (address);

    /// @notice Returns the tick spacing
    function tickSpacing() external view returns (int24);

    /// @notice Returns the pool's liquidity
    function liquidity() external view returns (uint128);
}

/// @notice Interface for Uniswap V3 Factory
interface IUniswapV3Factory {
    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool);
}
