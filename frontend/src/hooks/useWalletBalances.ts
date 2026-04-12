/**
 * useWalletBalances — reads live token balances from X Layer for the connected wallet.
 *
 * Reads WOKB and USDC balances via multicall from the deployed ERC-20 contracts.
 * Refreshes every 15s.
 */

import { useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { ERC20_ABI, CONTRACTS } from "@/lib/wagmi";

export interface TokenBalance {
  symbol: string;
  name: string;
  balance: string;       // formatted (e.g. "12.485")
  balanceRaw: bigint;
  color: string;
}

export interface WalletBalancesResult {
  balances: TokenBalance[];
  isLoading: boolean;
  isError: boolean;
}

const TOKENS = [
  { address: CONTRACTS.WOKB, symbol: "WOKB", name: "Wrapped OKB",  decimals: 18, color: "#0e91e9" },
  { address: CONTRACTS.USDC, symbol: "USDC", name: "USD Coin",     decimals: 6,  color: "#2775CA" },
] as const;

export function useWalletBalances(
  userAddress: `0x${string}` | undefined
): WalletBalancesResult {
  const enabled = Boolean(userAddress);

  const { data, isLoading, isError } = useReadContracts({
    contracts: TOKENS.map(t => ({
      address: t.address,
      abi: ERC20_ABI,
      functionName: "balanceOf" as const,
      args: userAddress ? [userAddress] : undefined,
    })),
    query: {
      enabled,
      refetchInterval: 15_000,
      staleTime: 12_000,
    },
  });

  const balances: TokenBalance[] = TOKENS.map((token, i) => {
    const raw = (data?.[i]?.result as bigint | undefined) ?? BigInt(0);
    return {
      symbol:     token.symbol,
      name:       token.name,
      balance:    parseFloat(formatUnits(raw, token.decimals)).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 4,
                  }),
      balanceRaw: raw,
      color:      token.color,
    };
  });

  return {
    balances,
    isLoading: enabled ? isLoading : false,
    isError,
  };
}
