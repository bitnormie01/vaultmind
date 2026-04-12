// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MockNonfungiblePositionManager
 * @notice Mock of Uniswap V3 NonfungiblePositionManager for Foundry fuzz testing.
 * @dev Simulates position lifecycle: mint → decreaseLiquidity → collect → burn.
 *      Tracks positions with a simple counter-based tokenId scheme.
 */

import {INonfungiblePositionManager} from "../../src/interfaces/IUniswapV3.sol";
import {MockERC20} from "./MockERC20.sol";

contract MockNonfungiblePositionManager {
    // ═══════════════════════════════════════════════════════════════════
    //                          STATE
    // ═══════════════════════════════════════════════════════════════════

    uint256 public nextTokenId = 1;

    struct PositionData {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
        address owner;
        bool exists;
    }

    mapping(uint256 => PositionData) public positionData;

    /// @notice Configure the slippage simulation (% of desired amounts actually used)
    uint256 public mintEfficiencyBps = 10_000; // 100% by default

    bool public shouldRevertOnMint;
    bool public shouldRevertOnBurn;

    // ═══════════════════════════════════════════════════════════════════
    //                     TEST HELPERS
    // ═══════════════════════════════════════════════════════════════════

    function setMintEfficiency(uint256 bps) external {
        mintEfficiencyBps = bps;
    }

    function setShouldRevertOnMint(bool val) external {
        shouldRevertOnMint = val;
    }

    function setShouldRevertOnBurn(bool val) external {
        shouldRevertOnBurn = val;
    }

    /// @notice Manually seed a position for testing (simulates a user's existing LP)
    function seedPosition(
        uint256 tokenId,
        address token0,
        address token1,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity
    ) external {
        positionData[tokenId] = PositionData({
            token0: token0,
            token1: token1,
            fee: fee,
            tickLower: tickLower,
            tickUpper: tickUpper,
            liquidity: liquidity,
            owner: msg.sender, // For testing, assume msg.sender is owner or anyone
            exists: true
        });
        if (tokenId >= nextTokenId) {
            nextTokenId = tokenId + 1;
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    //               INonfungiblePositionManager (subset)
    // ═══════════════════════════════════════════════════════════════════

    function ownerOf(uint256 tokenId) external view returns (address) {
        require(positionData[tokenId].exists, "MockNFPM: nonexistent token");
        return positionData[tokenId].owner;
    }

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
        )
    {
        PositionData memory p = positionData[tokenId];
        return (
            0,               // nonce
            address(0),      // operator
            p.token0,
            p.token1,
            p.fee,
            p.tickLower,
            p.tickUpper,
            p.liquidity,
            0, 0, 0, 0       // fee growth and owed tokens
        );
    }

    function mint(INonfungiblePositionManager.MintParams calldata params)
        external
        payable
        returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)
    {
        require(!shouldRevertOnMint, "MockNFPM: mint reverted");

        tokenId = nextTokenId++;

        // Simulate partial fill based on mint efficiency
        amount0 = (params.amount0Desired * mintEfficiencyBps) / 10_000;
        amount1 = (params.amount1Desired * mintEfficiencyBps) / 10_000;

        // Enforce slippage check
        require(amount0 >= params.amount0Min, "MockNFPM: amount0 slippage");
        require(amount1 >= params.amount1Min, "MockNFPM: amount1 slippage");

        // Calculate liquidity as geometric mean (simplified)
        if (amount0 > 0 && amount1 > 0) {
            liquidity = uint128(_sqrt(amount0 * amount1));
        } else if (amount0 > 0) {
            liquidity = uint128(amount0);
        } else {
            liquidity = uint128(amount1);
        }

        // Pull tokens from sender
        if (amount0 > 0) {
            MockERC20(params.token0).transferFrom(msg.sender, address(this), amount0);
        }
        if (amount1 > 0) {
            MockERC20(params.token1).transferFrom(msg.sender, address(this), amount1);
        }

        positionData[tokenId] = PositionData({
            token0: params.token0,
            token1: params.token1,
            fee: params.fee,
            tickLower: params.tickLower,
            tickUpper: params.tickUpper,
            liquidity: liquidity,
            owner: params.recipient,
            exists: true
        });
    }

    function decreaseLiquidity(INonfungiblePositionManager.DecreaseLiquidityParams calldata params)
        external
        payable
        returns (uint256 amount0, uint256 amount1)
    {
        PositionData storage p = positionData[params.tokenId];
        require(p.exists, "MockNFPM: position does not exist");
        require(p.liquidity >= params.liquidity, "MockNFPM: insufficient liquidity");

        // Proportional removal — give back tokens proportional to liquidity removed
        uint256 fraction = (uint256(params.liquidity) * 1e18) / uint256(p.liquidity);
        p.liquidity -= params.liquidity;

        // The actual amounts will be distributed on collect()
        // For simplicity, just return nominal amounts
        amount0 = fraction; // placeholder, collect does actual distribution
        amount1 = fraction;
    }

    function collect(INonfungiblePositionManager.CollectParams calldata params)
        external
        payable
        returns (uint256 amount0, uint256 amount1)
    {
        PositionData memory p = positionData[params.tokenId];
        require(p.exists, "MockNFPM: position does not exist");

        // Transfer collected tokens from this contract to recipient
        uint256 bal0 = MockERC20(p.token0).balanceOf(address(this));
        uint256 bal1 = MockERC20(p.token1).balanceOf(address(this));

        amount0 = bal0 > uint256(params.amount0Max) ? uint256(params.amount0Max) : bal0;
        amount1 = bal1 > uint256(params.amount1Max) ? uint256(params.amount1Max) : bal1;

        if (amount0 > 0) MockERC20(p.token0).transfer(params.recipient, amount0);
        if (amount1 > 0) MockERC20(p.token1).transfer(params.recipient, amount1);
    }

    function burn(uint256 tokenId) external payable {
        require(!shouldRevertOnBurn, "MockNFPM: burn reverted");
        PositionData storage p = positionData[tokenId];
        require(p.exists, "MockNFPM: position does not exist");
        require(p.liquidity == 0, "MockNFPM: position has liquidity");
        p.exists = false;
    }

    // ═══════════════════════════════════════════════════════════════════
    //                    INTERNAL HELPERS
    // ═══════════════════════════════════════════════════════════════════

    function _sqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) return 0;
        y = x;
        uint256 z = (x + 1) / 2;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }
}
