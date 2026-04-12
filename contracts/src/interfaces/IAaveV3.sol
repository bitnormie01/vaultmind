// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IFlashLoanSimpleReceiver
/// @notice Aave V3 Flash Loan Simple Receiver interface
/// @dev Implementing contracts must handle the flash loan callback
interface IFlashLoanSimpleReceiver {
    /// @notice Executes the flash loan callback logic
    /// @param asset The address of the flash-borrowed asset
    /// @param amount The amount of the flash-borrowed asset
    /// @param premium The fee to pay back on top of the borrowed amount
    /// @param initiator The address that initiated the flash loan
    /// @param params Encoded parameters passed by the initiator
    /// @return True if the execution was successful
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external returns (bool);
}

/// @title IPoolAddressesProvider
/// @notice Interface for the Aave V3 Pool Addresses Provider
interface IPoolAddressesProvider {
    function getPool() external view returns (address);
    function getPriceOracle() external view returns (address);
}

/// @title IPool
/// @notice Simplified interface for the Aave V3 Pool
interface IPool {
    struct ReserveData {
        uint256 configuration;
        uint256 liquidityIndex;
        uint256 currentLiquidityRate;
        uint256 variableBorrowIndex;
        uint256 currentVariableBorrowRate;
        uint256 currentStableBorrowRate;
        uint256 lastUpdateTimestamp;
        uint256 id;
        address aTokenAddress;
        address stableDebtTokenAddress;
        address variableDebtTokenAddress;
        address interestRateStrategyAddress;
        uint256 accruedToTreasury;
        uint256 unbacked;
        uint256 isolationModeTotalDebt;
    }

    /// @notice Returns the user account data across all reserves
    function getUserAccountData(address user)
        external
        view
        returns (
            uint256 totalCollateralBase,
            uint256 totalDebtBase,
            uint256 availableBorrowsBase,
            uint256 currentLiquidationThreshold,
            uint256 ltv,
            uint256 healthFactor
        );

    /// @notice Executes a simple flash loan
    function flashLoanSimple(
        address receiverAddress,
        address asset,
        uint256 amount,
        bytes calldata params,
        uint16 referralCode
    ) external;

    /// @notice Repays a borrowed amount on a specific reserve
    function repay(
        address asset,
        uint256 amount,
        uint256 interestRateMode,
        address onBehalfOf
    ) external returns (uint256);

    /// @notice Returns reserve data for a given asset
    function getReserveData(address asset) external view returns (ReserveData memory);

    /// @notice Withdraws an 'amount' of underlying asset from the reserve
    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256);
}

/// @title IPriceOracle
/// @notice Simplified interface for the Aave V3 Price Oracle
interface IPriceOracle {
    function getAssetPrice(address asset) external view returns (uint256);
}
