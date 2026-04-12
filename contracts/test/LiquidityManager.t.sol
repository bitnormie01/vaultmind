// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {LiquidityManager} from "../src/modules/LiquidityManager.sol";
import {MockNonfungiblePositionManager} from "./mocks/MockNonfungiblePositionManager.sol";
import {MockUniswapV3Pool} from "./mocks/MockUniswapV3Pool.sol";
import {MockUniswapV3Factory} from "./mocks/MockUniswapV3Factory.sol";
import {MockOKXDexRouter} from "./mocks/MockOKXDexRouter.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {VaultMindCore} from "../src/core/VaultMindCore.sol";
import {TickMath} from "../src/libraries/TickMath.sol";

contract LiquidityManagerTest is Test {
    LiquidityManager public manager;
    MockNonfungiblePositionManager public nfpm;
    MockUniswapV3Pool public pool;
    MockUniswapV3Factory public factory;
    MockOKXDexRouter public dex;
    MockERC20 public token0;
    MockERC20 public token1;
    VaultMindCore public core;

    address public constant USER = address(0x1111);
    address public constant AGENT = address(0x2222);

    uint24 public constant FEE = 500;
    int24 public constant TICK_SPACING = 10;
    uint256 public constant Q96 = 2 ** 96;

    function setUp() public {
        token0 = new MockERC20("Token 0", "TK0", 18);
        token1 = new MockERC20("Token 1", "TK1", 18);

        if (address(token0) > address(token1)) {
            MockERC20 temp = token0;
            token0 = token1;
            token1 = temp;
        }

        nfpm = new MockNonfungiblePositionManager();
        factory = new MockUniswapV3Factory();
        dex = new MockOKXDexRouter();
        core = new VaultMindCore();

        // Register AGENT as a delegate for USER
        vm.prank(USER);
        core.setDelegate(AGENT);

        manager = new LiquidityManager(
            address(nfpm),
            address(factory),
            address(core),
            address(dex)
        );

        // Register module
        vm.prank(core.owner());
        core.registerModule(address(manager), "LiquidityManager");

        uint160 initialSqrtPriceX96 = 79228162514264337593543950336; // 1.0 (tick 0)
        
        pool = new MockUniswapV3Pool(
            address(token0),
            address(token1),
            FEE,
            TICK_SPACING,
            initialSqrtPriceX96,
            0
        );

        factory.registerPool(address(token0), address(token1), FEE, address(pool));

        // User setup
        vm.startPrank(USER);
        manager.setRebalanceConfig(100, 20, 1000e18); // slippage=1%, spread=20
        vm.stopPrank();

        token0.mint(USER, 1_000_000e18);
        token1.mint(USER, 1_000_000e18);
    }

    // ─────────────────────────────────────────────────────────────────
    //                        UNIT/FUZZ TESTS
    // ─────────────────────────────────────────────────────────────────

    function test_InitialState() public view {
        assertEq(address(manager.POSITION_MANAGER()), address(nfpm));
        assertEq(address(manager.FACTORY()), address(factory));
        assertEq(manager.VAULT_MIND_CORE(), address(core));
    }

    function testFuzz_CalculateOptimalRange(int24 currentTick, int24 tickSpread) public {
        tickSpread = int24(bound(int256(tickSpread), 1, 100)); // 1 to 100 spacings
        currentTick = int24(bound(int256(currentTick), -887200, 887200));

        uint160 sqrtP = TickMath.getSqrtRatioAtTick(currentTick);
        pool.setSlot0(sqrtP, currentTick);

        // create dummy position
        vm.prank(USER);
        nfpm.seedPosition(1, address(token0), address(token1), FEE, -100, 100, 1e18);
        
        (int24 lower, int24 upper) = manager.calculateOptimalRange(1, tickSpread);

        int24 alignedTick = (currentTick / TICK_SPACING) * TICK_SPACING;
        // Apply floor division correction for negative ticks (matches contract behavior)
        if (currentTick < 0 && currentTick % TICK_SPACING != 0) alignedTick -= TICK_SPACING;
        
        assertEq(lower, alignedTick - (tickSpread * TICK_SPACING));
        assertEq(upper, alignedTick + (tickSpread * TICK_SPACING));
    }

    function test_RevertIfPositionInRange() public {
        uint256 tokenId = 100;
        vm.prank(USER);
        nfpm.seedPosition(tokenId, address(token0), address(token1), FEE, -10, 10, 1e18);
        
        pool.setSlot0(79228162514264337593543950336, 0); // tick 0

        LiquidityManager.RebalanceParams memory params = LiquidityManager.RebalanceParams({
            userWallet: USER,
            tokenId: tokenId,
            newTickLower: -20,
            newTickUpper: 20
        });

        vm.prank(AGENT);
        vm.expectRevert(
            abi.encodeWithSelector(LiquidityManager.PositionStillInRange.selector, 0, -10, 10)
        );
        manager.rebalancePosition(params);
    }

    function test_RevertIfNotAuthorized() public {
        LiquidityManager.RebalanceParams memory params = LiquidityManager.RebalanceParams({
            userWallet: USER,
            tokenId: 1,
            newTickLower: -20,
            newTickUpper: 20
        });

        vm.prank(address(0xDEAD)); // NOT the agent, NOT the user
        vm.expectRevert(LiquidityManager.UnauthorizedCaller.selector);
        manager.rebalancePosition(params);
    }

    function test_SuccessfulRebalanceAboveRange() public {
        // Price moved ABOVE the upper tick (Token 1 mostly collected)
        uint256 tokenId = 101;
        vm.prank(USER);
        nfpm.seedPosition(tokenId, address(token0), address(token1), FEE, -50, -10, 1000e18);
        
        // Give NFPM tokens so collect works
        token0.mint(address(nfpm), 10e18);
        token1.mint(address(nfpm), 100e18); // Value mostly in token1 because price went up

        pool.setSlot0(TickMath.getSqrtRatioAtTick(100), 100); 

        LiquidityManager.RebalanceParams memory params = LiquidityManager.RebalanceParams({
            userWallet: USER,
            tokenId: tokenId,
            newTickLower: 80,
            newTickUpper: 120
        });

        vm.prank(AGENT);
        uint256 newTokenId = manager.rebalancePosition(params);
        assertTrue(newTokenId > 0);
        
        // Verify state changes
        (, , address t0, address t1, uint24 f, int24 l, int24 u, uint128 liq, , , , ) = nfpm.positions(newTokenId);
        assertEq(t0, address(token0));
        assertEq(t1, address(token1));
        assertEq(f, FEE);
        assertEq(l, 80);
        assertEq(u, 120);
        assertTrue(liq > 0);
    }

    function testFuzz_RebalanceSingleSidedSwap(
        int24 currentTick
    ) public {
        currentTick = int24(bound(int256(currentTick), -800000, 800000));
        // We ensure we are out of range of the old config
        
         uint256 tokenId = 102;
        vm.prank(USER);
        nfpm.seedPosition(tokenId, address(token0), address(token1), FEE, currentTick - 1000, currentTick - 500, 1000e18);
        
        // Mock NFPM balances
        token0.mint(address(nfpm), 0); // No token0
        token1.mint(address(nfpm), 1000e18); // Lots of token1

        uint160 currentSqrt = TickMath.getSqrtRatioAtTick(currentTick);
        pool.setSlot0(currentSqrt, currentTick);

        // New range centered around currentTick
        int24 newTickLower = currentTick - 100;
        int24 newTickUpper = currentTick + 100;

        LiquidityManager.RebalanceParams memory params = LiquidityManager.RebalanceParams({
            userWallet: USER,
            tokenId: tokenId,
            newTickLower: newTickLower,
            newTickUpper: newTickUpper
        });

        vm.prank(AGENT);
        uint256 newTokenId = manager.rebalancePosition(params);
        assertTrue(newTokenId > 0);
    }
}
