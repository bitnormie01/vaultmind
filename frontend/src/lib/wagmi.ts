/**
 * Wagmi v2 + viem v2 configuration for VaultMind frontend
 *
 * X Layer (Chain ID 196) is defined as a custom chain using viem's defineChain.
 * All frontend wallet interactions use wagmi hooks backed by viem transport.
 */

import { createConfig, http } from "wagmi";
import { defineChain } from "viem";
import { injected, metaMask } from "wagmi/connectors";

// Define X Layer as a custom chain
export const xLayer = defineChain({
  id: 196,
  name: "X Layer",
  nativeCurrency: {
    name: "OKB",
    symbol: "OKB",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [
        process.env.NEXT_PUBLIC_XLAYER_RPC_URL || "https://rpc.xlayer.tech",
      ],
    },
  },
  blockExplorers: {
    default: {
      name: "OKLink X Layer",
      url: "https://www.oklink.com/xlayer",
    },
  },
  contracts: {},
});

// ─── Deployed contract addresses (X Layer Mainnet, Chain ID 196) ────
export const CONTRACTS = {
  vaultMindCore:    (process.env.NEXT_PUBLIC_VAULTMIND_CORE_ADDRESS     || "0xDDc90434a8DD095ac6B5046fFbC4BD5d5f477306") as `0x${string}`,
  flashRescue:      (process.env.NEXT_PUBLIC_FLASH_RESCUE_ADDRESS        || "0x1e6955512b94a8CECbD28781c00B4930900f5147") as `0x${string}`,
  liquidityManager: (process.env.NEXT_PUBLIC_LIQUIDITY_MANAGER_ADDRESS   || "0x2AF9F9314ADbd03811EE8Fd71087f92cba6341b7") as `0x${string}`,
  // Aave V3 on X Layer
  aavePool:         "0x061D8E131F26512348ee5FA42e2DF1ba9D6505e9" as `0x${string}`,
  // X Layer token addresses
  WOKB: "0xe538905cf8410324e03a5a23c1c177a474d59b2b" as `0x${string}`,
  USDC: "0x74b7f16337b8972027f6196a17a631ac6de26d22" as `0x${string}`,
} as const;

// ─── ABIs ────────────────────────────────────────────────────────────

export const FLASH_RESCUE_ABI = [
  {
    name: "getUserHealthFactor",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "healthFactor", type: "uint256" }],
  },
  {
    name: "calculateOptimalRepayment",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "user",      type: "address" },
      { name: "debtAsset", type: "address" },
    ],
    outputs: [{ name: "repayAmount", type: "uint256" }],
  },
  {
    name: "getUserConfig",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "_targetHF",     type: "uint256" },
      { name: "_slippageBps",  type: "uint256" },
      { name: "_rescueCount",  type: "uint256" },
      { name: "_totalRepaid",  type: "uint256" },
    ],
  },
  {
    name: "rescueCount",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const LIQUIDITY_MANAGER_ABI = [
  {
    name: "isPositionOutOfRange",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      { name: "outOfRange",  type: "bool"  },
      { name: "currentTick", type: "int24" },
      { name: "tickLower",   type: "int24" },
      { name: "tickUpper",   type: "int24" },
    ],
  },
  {
    name: "rebalanceCount",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

// Aave V3 Pool — getUserAccountData returns live collateral, debt, HF
export const AAVE_POOL_ABI = [
  {
    name: "getUserAccountData",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "totalCollateralBase",          type: "uint256" },
      { name: "totalDebtBase",                type: "uint256" },
      { name: "availableBorrowsBase",          type: "uint256" },
      { name: "currentLiquidationThreshold",  type: "uint256" },
      { name: "ltv",                          type: "uint256" },
      { name: "healthFactor",                 type: "uint256" },
    ],
  },
] as const;

// ERC-20 balanceOf — used for live wallet token balances
export const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
] as const;

// Wagmi v2 config
export const wagmiConfig = createConfig({
  chains: [xLayer],
  connectors: [
    injected(),    // MetaMask and other injected wallets
    metaMask(),    // MetaMask SDK connector
  ],
  transports: {
    [xLayer.id]: http(
      process.env.NEXT_PUBLIC_XLAYER_RPC_URL || "https://rpc.xlayer.tech"
    ),
  },
});

// Type helper
export type WagmiConfig = typeof wagmiConfig;
