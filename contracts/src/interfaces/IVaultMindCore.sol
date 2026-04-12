// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IVaultMindCore
 * @notice Interface for VaultMindCore access control.
 */
interface IVaultMindCore {
    function isAuthorized(address wallet, address actor) external view returns (bool);
    function isModuleAuthorized(address wallet, address module) external view returns (bool);
    function paused() external view returns (bool);
}
