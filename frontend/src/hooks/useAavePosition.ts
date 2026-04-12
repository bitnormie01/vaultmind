/**
 * useAavePosition — reads live Aave V3 position data from deployed contracts on X Layer.
 *
 * Batches 4 reads into a single multicall:
 *   1. Aave Pool.getUserAccountData  → collateral, debt, HF (authoritative source)
 *   2. FlashRescue.rescueCount       → how many rescues this wallet has had
 *   3. FlashRescue.calculateOptimalRepayment → how much debt to repay to reach target HF
 *   4. LiquidityManager.rebalanceCount → how many LP rebalances performed
 *
 * Refreshes every 12s (1 X Layer block).
 */

import { useReadContracts } from "wagmi";
import { FLASH_RESCUE_ABI, LIQUIDITY_MANAGER_ABI, AAVE_POOL_ABI, CONTRACTS } from "@/lib/wagmi";

export interface AavePosition {
  healthFactor: number;         // Normalised float (e.g. 1.87)
  healthFactorRaw: bigint;
  totalCollateralUsd: number;   // USD value (Aave base currency = 1e8)
  totalDebtUsd: number;
  rescueCount: number;
  rebalanceCount: number;
  optimalRepayment: bigint;
  isAtRisk: boolean;            // HF < 1.3
  isDanger: boolean;            // HF < 1.1
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

const HF_PRECISION = BigInt("1000000000000000000"); // 1e18
const BASE_CURRENCY_PRECISION = 1e8;                // Aave base currency decimals

export function useAavePosition(userAddress: `0x${string}` | undefined): AavePosition {
  const enabled = Boolean(userAddress);

  const { data, isLoading, isError, refetch } = useReadContracts({
    contracts: [
      // 1. Live Aave position from the Pool directly
      {
        address: CONTRACTS.aavePool,
        abi: AAVE_POOL_ABI,
        functionName: "getUserAccountData",
        args: userAddress ? [userAddress] : undefined,
      },
      // 2. Rescue count from FlashRescue
      {
        address: CONTRACTS.flashRescue,
        abi: FLASH_RESCUE_ABI,
        functionName: "rescueCount",
        args: userAddress ? [userAddress] : undefined,
      },
      // 3. Optimal repayment amount
      {
        address: CONTRACTS.flashRescue,
        abi: FLASH_RESCUE_ABI,
        functionName: "calculateOptimalRepayment",
        args: userAddress ? [userAddress, CONTRACTS.USDC] : undefined,
      },
      // 4. Rebalance count from LiquidityManager
      {
        address: CONTRACTS.liquidityManager,
        abi: LIQUIDITY_MANAGER_ABI,
        functionName: "rebalanceCount",
        args: userAddress ? [userAddress] : undefined,
      },
    ],
    query: {
      enabled,
      refetchInterval: 12_000,
      staleTime: 10_000,
    },
  });

  // Aave getUserAccountData returns a tuple — viem returns it as an array
  const aaveData = data?.[0]?.result as
    | [bigint, bigint, bigint, bigint, bigint, bigint]
    | undefined;

  const totalCollateralBase = aaveData?.[0] ?? BigInt(0);
  const totalDebtBase       = aaveData?.[1] ?? BigInt(0);
  const hfRaw               = aaveData?.[5] ?? BigInt(0);

  const rescueCount    = Number((data?.[1]?.result as bigint | undefined) ?? BigInt(0));
  const optimalRepayment = (data?.[2]?.result as bigint | undefined) ?? BigInt(0);
  const rebalanceCount = Number((data?.[3]?.result as bigint | undefined) ?? BigInt(0));

  // Convert 1e18 bigint → float
  const healthFactor =
    hfRaw === BigInt(0) ? 0 : Number((hfRaw * BigInt(1000)) / HF_PRECISION) / 1000;

  // Aave base currency is USD with 8 decimals
  const totalCollateralUsd = Number(totalCollateralBase) / BASE_CURRENCY_PRECISION;
  const totalDebtUsd       = Number(totalDebtBase)       / BASE_CURRENCY_PRECISION;

  return {
    healthFactor,
    healthFactorRaw: hfRaw,
    totalCollateralUsd,
    totalDebtUsd,
    rescueCount,
    rebalanceCount,
    optimalRepayment,
    isAtRisk: healthFactor > 0 && healthFactor < 1.3,
    isDanger: healthFactor > 0 && healthFactor < 1.1,
    isLoading: enabled ? isLoading : false,
    isError,
    refetch,
  };
}
