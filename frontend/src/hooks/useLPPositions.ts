

/**
 * useLPPositions — wagmi v2 hook for Uniswap V3 LP position monitoring
 *
 * Uses wagmi's useReadContracts to batch-read each tokenId from LiquidityManager.
 * Tick-to-price conversion is done client-side (no extra RPC calls).
 * Data refreshes every 15s.
 *
 * No ethers.js. Pure wagmi v2 / viem v2.
 */

import { useReadContracts } from "wagmi";
import { LIQUIDITY_MANAGER_ABI, CONTRACTS } from "@/lib/wagmi";

export interface LPPosition {
  tokenId: string;
  token0Symbol: string;
  token1Symbol: string;
  currentTick: number;
  tickLower: number;
  tickUpper: number;
  currentPrice: number;
  lowerPrice: number;
  upperPrice: number;
  liquidity: string;
  feeTier: number;
  isOutOfRange: boolean;
  isLoading: boolean;
}

export interface LPPositionsResult {
  positions: LPPosition[];
  isLoading: boolean;
  isError: boolean;
  outOfRangeCount: number;
  refetch: () => void;
}

/** Convert a Uniswap V3 tick to price (token0 per token1) */
function tickToPrice(tick: number): number {
  return Math.pow(1.0001, tick);
}

/**
 * Builds wagmi contract read configs for a list of token IDs.
 * Each tokenId → one `isPositionOutOfRange` call.
 */
function buildContracts(tokenIds: bigint[]) {
  return tokenIds.map(id => ({
    address: CONTRACTS.liquidityManager,
    abi: LIQUIDITY_MANAGER_ABI,
    functionName: "isPositionOutOfRange" as const,
    args: [id] as const,
  }));
}

export function useLPPositions(
  userAddress: `0x${string}` | undefined,
  tokenIds: bigint[] = [],
  // Optional metadata per tokenId (symbols, fee tier)
  metadata: Array<{ token0: string; token1: string; feeTier: number }> = []
): LPPositionsResult {
  const enabled = Boolean(
    userAddress &&
    CONTRACTS.liquidityManager !== "0x" &&
    tokenIds.length > 0
  );

  const contracts = buildContracts(tokenIds);

  const { data, isLoading, isError, refetch } = useReadContracts({
    contracts,
    query: {
      enabled,
      refetchInterval: 15_000,
      staleTime: 12_000,
    },
  });

  const positions: LPPosition[] = tokenIds.map((id, i) => {
    const result = data?.[i]?.result as
      | [boolean, number, number, number]
      | undefined;

    const outOfRange    = result?.[0] ?? false;
    const currentTick   = Number(result?.[1] ?? 0);
    const tickLower     = Number(result?.[2] ?? 0);
    const tickUpper     = Number(result?.[3] ?? 1);

    const meta = metadata[i] ?? { token0: "TKN0", token1: "TKN1", feeTier: 3000 };

    return {
      tokenId:      id.toString(),
      token0Symbol: meta.token0,
      token1Symbol: meta.token1,
      currentTick,
      tickLower,
      tickUpper,
      currentPrice: tickToPrice(currentTick),
      lowerPrice:   tickToPrice(tickLower),
      upperPrice:   tickToPrice(tickUpper),
      liquidity:    "0", // fetched separately from position manager if needed
      feeTier:      meta.feeTier,
      isOutOfRange: outOfRange,
      isLoading:    enabled && isLoading,
    };
  });

  return {
    positions,
    isLoading: enabled ? isLoading : false,
    isError,
    outOfRangeCount: positions.filter(p => p.isOutOfRange).length,
    refetch,
  };
}
