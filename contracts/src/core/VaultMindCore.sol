// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title VaultMindCore
 * @author VaultMind Team — OKX Build X Hackathon
 * @notice Central access control and Agentic Wallet delegate mapping for the VaultMind protocol.
 * @dev This contract serves as the permission layer for all VaultMind modules.
 *      It manages the relationship between wallet owners and their authorized AI agents
 *      (delegates) that can autonomously execute flash-rescues and LP rebalances.
 *
 * Key Design Decisions:
 *   - Each owner can authorize exactly ONE delegate at a time (simplicity + security)
 *   - Emergency pause halts all autonomous operations across all modules
 *   - Module registration prevents unauthorized contracts from executing on behalf of users
 */

import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract VaultMindCore is Ownable2Step {
    //                          STATE
    // ═══════════════════════════════════════════════════════════════════

    /// @notice Emergency pause flag
    bool public paused;

    /// @notice wallet owner => authorized delegate (AI agent)
    mapping(address => address) public delegates;

    /// @notice delegate => wallet owner (reverse lookup)
    mapping(address => address) public delegateToOwner;

    /// @notice Registered VaultMind modules that can be called by delegates
    mapping(address => bool) public registeredModules;

    /// @notice Owner-specific module permissions (owner => module => allowed)
    mapping(address => mapping(address => bool)) public modulePermissions;

    // ═══════════════════════════════════════════════════════════════════
    //                          EVENTS
    // ═══════════════════════════════════════════════════════════════════

    event DelegateSet(address indexed owner, address indexed delegate);
    event DelegateRevoked(address indexed owner, address indexed previousDelegate);
    event ModuleRegistered(address indexed module, string name);
    event ModuleDeregistered(address indexed module);
    event ModulePermissionSet(address indexed owner, address indexed module, bool allowed);
    event EmergencyPauseToggled(bool paused);

    // ═══════════════════════════════════════════════════════════════════
    //                          ERRORS
    // ═══════════════════════════════════════════════════════════════════

    error Paused();
    error AlreadyPaused();
    error NotPaused();
    error NotOwnerOrDelegate();
    error ZeroAddress();
    error ModuleNotRegistered(address module);
    error DelegateAlreadyAssigned(address currentDelegate);

    // ═══════════════════════════════════════════════════════════════════
    //                          MODIFIERS
    // ═══════════════════════════════════════════════════════════════════

    modifier whenNotPaused() {
        if (paused) revert Paused();
        _;
    }

    modifier onlyOwnerOrDelegate(address wallet) {
        if (msg.sender != wallet && msg.sender != delegates[wallet]) {
            revert NotOwnerOrDelegate();
        }
        _;
    }

    // ═══════════════════════════════════════════════════════════════════
    //                       CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════

    constructor() Ownable(msg.sender) {}

    // ═══════════════════════════════════════════════════════════════════
    //                    DELEGATE MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════

    /// @notice Authorize an AI agent delegate for the caller's wallet
    /// @param delegate The address of the delegate to authorize
    function setDelegate(address delegate) external whenNotPaused {
        if (delegate == address(0)) revert ZeroAddress();

        address existingOwner = delegateToOwner[delegate];
        if (existingOwner != address(0) && existingOwner != msg.sender) {
            revert DelegateAlreadyAssigned(existingOwner);
        }

        // Revoke existing delegate if present
        address currentDelegate = delegates[msg.sender];
        if (currentDelegate != address(0)) {
            delete delegateToOwner[currentDelegate];
            emit DelegateRevoked(msg.sender, currentDelegate);
        }

        delegates[msg.sender] = delegate;
        delegateToOwner[delegate] = msg.sender;

        emit DelegateSet(msg.sender, delegate);
    }

    /// @notice Revoke the current delegate
    /// @dev Intentionally callable during pause — users must always be able to revoke access
    function revokeDelegate() external {
        address currentDelegate = delegates[msg.sender];
        if (currentDelegate == address(0)) revert ZeroAddress();

        delete delegates[msg.sender];
        delete delegateToOwner[currentDelegate];

        emit DelegateRevoked(msg.sender, currentDelegate);
    }

    /// @notice Check if an address is authorized to act on behalf of a wallet
    function isAuthorized(address wallet, address actor) external view returns (bool) {
        return actor == wallet || actor == delegates[wallet];
    }

    // ═══════════════════════════════════════════════════════════════════
    //                    MODULE MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════

    /// @notice Register a VaultMind module (FlashRescue, LiquidityManager, etc.)
    function registerModule(address module, string calldata name) external onlyOwner {
        if (module == address(0)) revert ZeroAddress();
        registeredModules[module] = true;
        emit ModuleRegistered(module, name);
    }

    /// @notice Deregister a module
    function deregisterModule(address module) external onlyOwner {
        registeredModules[module] = false;
        emit ModuleDeregistered(module);
    }

    /// @notice Set per-owner module permissions
    function setModulePermission(address module, bool allowed) external whenNotPaused {
        if (!registeredModules[module]) revert ModuleNotRegistered(module);
        modulePermissions[msg.sender][module] = allowed;
        emit ModulePermissionSet(msg.sender, module, allowed);
    }

    /// @notice Check if a module is authorized for a specific wallet
    function isModuleAuthorized(address wallet, address module) external view returns (bool) {
        return registeredModules[module] && modulePermissions[wallet][module];
    }

    // ═══════════════════════════════════════════════════════════════════
    //                     EMERGENCY CONTROLS
    // ═══════════════════════════════════════════════════════════════════

    /// @notice Enable emergency pause — halts all autonomous operations
    function pause() external onlyOwner {
        if (paused) revert AlreadyPaused();
        paused = true;
        emit EmergencyPauseToggled(true);
    }

    /// @notice Disable emergency pause
    function unpause() external onlyOwner {
        if (!paused) revert NotPaused();
        paused = false;
        emit EmergencyPauseToggled(false);
    }
}
