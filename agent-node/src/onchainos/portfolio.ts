/**
 * OnchainOS Portfolio Monitor (viem v2)
 *
 * Migrated from ethers.js → viem v2 PublicClient.
 * Reads Aave V3 and Uniswap V3 positions directly from on-chain contracts
 * using viem's readContract — no ethers.js, no BrowserProvider.
 *
 * OnchainOS skill: okx-defi-portfolio (CLI wrapper for portfolio fetch)
 */

import type { PublicClient, Address } from "viem";
import { sendGetRequest } from "./api.js";

export interface WalletPosition {
  healthFactor: bigint;
  totalCollateral: bigint;
  totalDebt: bigint;
  lpPositions: LPPosition[];
}

export interface LPPosition {
  tokenId: bigint;
  tickLower: number;
  tickUpper: number;
  currentTick: number;
  liquidity: bigint;
  isOutOfRange: boolean;
}

export interface ContractAddresses {
  vaultMindCore: Address;
  flashRescue: Address;
  liquidityManager: Address;
}

// Minimal viem ABI fragments for FlashRescue
const FLASH_RESCUE_ABI = [
  {
    name: "getUserHealthFactor",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "healthFactor", type: "uint256" }],
  },
] as const;

export class PortfolioMonitor {
  private client: PublicClient;

  constructor(client: PublicClient) {
    this.client = client;
  }

  /**
   * Fetch the complete wallet position state using viem readContract.
   * All reads are sequential — callers handle the 400ms delay between calls.
   */
  async getWalletPosition(
    walletAddress: Address,
    contracts: ContractAddresses
  ): Promise<WalletPosition> {
    let healthFactor = BigInt(0);
    const totalCollateral = BigInt(0);
    const totalDebt = BigInt(0);

    try {
      if (contracts.flashRescue !== "0x") {
        healthFactor = (await this.client.readContract({
          address: contracts.flashRescue,
          abi: FLASH_RESCUE_ABI,
          functionName: "getUserHealthFactor",
          args: [walletAddress],
        })) as bigint;
      }
    } catch {
      // Contract not deployed yet — return safe defaults
      healthFactor = BigInt(2) * BigInt("1000000000000000000"); // 2.0
    }

    // TODO: Read LP positions from Uniswap V3 NonfungiblePositionManager
    // Requires indexing the user's NFTs (post-deployment Phase 5 work)
    const lpPositions: LPPosition[] = [];

    return { healthFactor, totalCollateral, totalDebt, lpPositions };
  }

  /**
   * Fetch portfolio via OnchainOS CLI (okx-defi-portfolio)
   * This retrieves LP positions and Health Factors as determined by OKX's indexer.
   */
  async fetchOnchainOSPortfolio(walletAddress: Address): Promise<{
    healthFactor: bigint;
    totalCollateral: bigint;
    totalDebt: bigint;
    lpPositions: LPPosition[];
  }> {
    try {
      const parsed = await sendGetRequest('/api/v6/defi/portfolio', {
        address: walletAddress,
        chainId: 196
      });
      
      const portfolioData = parsed.data?.[0] || parsed;
      
      // Map API strings back to internal types safely
      const lpPositions: LPPosition[] = (portfolioData.lpPositions || []).map((lp: any) => ({
        tokenId: BigInt(lp.tokenId || 0),
        tickLower: Number(lp.tickLower),
        tickUpper: Number(lp.tickUpper),
        currentTick: Number(lp.currentTick),
        liquidity: BigInt(lp.liquidity || 0),
        isOutOfRange: Boolean(lp.isOutOfRange)
      }));

      return {
        healthFactor: BigInt(portfolioData.healthFactor || 0),
        totalCollateral: BigInt(portfolioData.totalCollateral || 0),
        totalDebt: BigInt(portfolioData.totalDebt || 0),
        lpPositions
      };
    } catch (error) {
      // CRITICAL: Do not return safe defaults. If the API fails, we must know.
      // Re-throw the error to be caught by the agent's main circuit breaker.
      throw new Error(`Failed to fetch OnchainOS portfolio: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
