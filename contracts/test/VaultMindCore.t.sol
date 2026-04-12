// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {VaultMindCore} from "../src/core/VaultMindCore.sol";

contract VaultMindCoreTest is Test {
    VaultMindCore public core;

    address public admin = address(this);
    address public walletOwner = address(0x111);
    address public aiAgent = address(0x222);
    address public someModule = address(0x333);

    function setUp() public {
        core = new VaultMindCore();
    }

    // ────────────────────────────────────────────────────────────────────────
    //   Delegate Management
    // ────────────────────────────────────────────────────────────────────────

    function test_SetDelegate() public {
        vm.prank(walletOwner);
        core.setDelegate(aiAgent);

        assertEq(core.delegates(walletOwner), aiAgent);
        assertEq(core.delegateToOwner(aiAgent), walletOwner);
        assertTrue(core.isAuthorized(walletOwner, aiAgent));
    }

    function test_RevokeDelegate() public {
        vm.startPrank(walletOwner);
        core.setDelegate(aiAgent);
        core.revokeDelegate();
        vm.stopPrank();

        assertEq(core.delegates(walletOwner), address(0));
        assertEq(core.delegateToOwner(aiAgent), address(0));
        assertFalse(core.isAuthorized(walletOwner, aiAgent));
    }

    function test_RevertWhen_SetDelegateZeroAddress() public {
        vm.prank(walletOwner);
        vm.expectRevert(VaultMindCore.ZeroAddress.selector);
        // Should revert with ZeroAddress()
        core.setDelegate(address(0));
    }

    function test_OverrideDelegate() public {
        address newAgent = address(0x999);
        vm.startPrank(walletOwner);
        core.setDelegate(aiAgent);
        core.setDelegate(newAgent);
        vm.stopPrank();

        assertEq(core.delegates(walletOwner), newAgent);
        assertEq(core.delegateToOwner(newAgent), walletOwner);
        // The old agent should be completely unrecognized
        assertEq(core.delegateToOwner(aiAgent), address(0));
        assertFalse(core.isAuthorized(walletOwner, aiAgent));
    }

    function test_RevertWhen_DelegateAlreadyAssigned() public {
        vm.prank(walletOwner);
        core.setDelegate(aiAgent);

        address anotherOwner = address(0x444);
        vm.prank(anotherOwner);
        vm.expectRevert(abi.encodeWithSelector(VaultMindCore.DelegateAlreadyAssigned.selector, walletOwner));
        core.setDelegate(aiAgent);
    }

    // ────────────────────────────────────────────────────────────────────────
    //   Module Management
    // ────────────────────────────────────────────────────────────────────────

    function test_RegisterModule() public {
        core.registerModule(someModule, "FlashRescue");
        assertTrue(core.registeredModules(someModule));
    }

    function test_RevertWhen_RegisterModuleNotOwner() public {
        vm.prank(walletOwner);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", walletOwner));
        // Should revert with OZ Ownable error
        core.registerModule(someModule, "FlashRescue");
    }

    function test_DeregisterModule() public {
        core.registerModule(someModule, "FlashRescue");
        core.deregisterModule(someModule);
        assertFalse(core.registeredModules(someModule));
    }

    function test_SetModulePermission() public {
        // Admin registers the module
        core.registerModule(someModule, "FlashRescue");

        // Wallet owner approves the module
        vm.prank(walletOwner);
        core.setModulePermission(someModule, true);

        assertTrue(core.isModuleAuthorized(walletOwner, someModule));
    }

    function test_RevertWhen_SetModulePermissionNotRegistered() public {
        vm.prank(walletOwner);
        vm.expectRevert();
        // Should revert with ModuleNotRegistered
        core.setModulePermission(someModule, true);
    }

    // ────────────────────────────────────────────────────────────────────────
    //   Emergency Pause
    // ────────────────────────────────────────────────────────────────────────

    function test_EmergencyPause() public {
        core.pause();
        assertTrue(core.paused());
        
        vm.expectRevert(VaultMindCore.AlreadyPaused.selector);
        core.pause();

        core.unpause();
        assertFalse(core.paused());

        vm.expectRevert(VaultMindCore.NotPaused.selector);
        core.unpause();
    }

    function test_RevertWhen_SetDelegateWhenPaused() public {
        core.pause();

        vm.prank(walletOwner);
        vm.expectRevert(VaultMindCore.Paused.selector);
        // Should revert with Paused()
        core.setDelegate(aiAgent);
    }

    function test_RevertWhen_EmergencyPauseNotOwner() public {
        vm.prank(walletOwner);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", walletOwner));
        // Should revert with OZ Ownable error
        core.pause();
    }
}
