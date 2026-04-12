/**
 * Pre-Execution Security Simulator
 *
 * CRITICAL: Every transaction MUST pass through this simulator before
 * being broadcast to X Layer. If the simulation fails or returns a
 * negative outcome, the transaction is DROPPED.
 *
 * Uses okx-onchain-gateway for transaction simulation.
 */

import { sendPostRequest } from "../onchainos/api.js";
import { createLogger } from "../utils/logger.js";

export interface TxPayload {
  to: string;
  data: string;
  chainId: number;
}

export interface ActionContext {
  tokenIn: string;
  tokenOut: string;
  amount: string;
  userAddress: string;
}

interface SimulationResult {
  success: boolean;
  reason: string;
  gasEstimate?: bigint;
  warnings: string[];
}

export class SecuritySimulator {
  private logger = createLogger("SecuritySimulator");

  /**
   * Simulate a transaction via the OKX OnchainOS Gateway (okx-onchain-gateway).
   *
   * Pipeline:
   * 1. Token security scan via okx-security (OKX Web3 API)
   * 2. Pre-execution simulation via okx-onchain-gateway (eth_call dry-run)
   * 3. Fail-closed: any error or negative result drops the transaction
   */
  async simulate(txPayload: TxPayload, context: ActionContext): Promise<SimulationResult> {
    const warnings: string[] = [];

    // ── Step 1: Token security scan (okx-security skill) ──
    if (context.tokenIn !== "0x0000000000000000000000000000000000000000") {
      try {
        const tokenScan = await sendPostRequest('/api/v6/security/token-scan', {
          chainId: String(txPayload.chainId),
          tokenContractAddresses: [context.tokenIn, context.tokenOut].filter(
            t => t !== "0x0000000000000000000000000000000000000000"
          ),
        });

        const tokens: any[] = tokenScan?.data ?? [];
        for (const token of tokens) {
          const level: string = token.riskLevel ?? "LOW";
          if (level === "HIGH" || level === "CRITICAL") {
            this.logger.warn("⛔ Token security scan BLOCKED the transaction", { token: token.tokenContractAddress, level });
            return {
              success: false,
              reason: `Token risk too high: ${token.tokenContractAddress} rated ${level}`,
              warnings: [`[${level}] Token ${token.tokenContractAddress} flagged by okx-security`],
            };
          }
          if (level === "MEDIUM") {
            warnings.push(`[MEDIUM] Token ${token.tokenContractAddress} has medium risk flags`);
          }
        }
        this.logger.info("✅ Token security scan passed");
      } catch (err) {
        // Fail-closed: if the security API is unreachable, block the transaction
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn("⛔ Token security scan FAILED — tx DROPPED (fail-closed)", { error: msg });
        return {
          success: false,
          reason: `okx-security unavailable: ${msg}`,
          warnings: ["[INFRASTRUCTURE] Security scan API unreachable — transaction blocked for safety"],
        };
      }
    }

    // ── Step 2: Pre-execution simulation (okx-onchain-gateway skill) ──
    try {
      const simResult = await sendPostRequest('/api/v6/onchain/pre-transaction/transaction-simulation', {
        chainIndex: String(txPayload.chainId),
        fromAddress: context.userAddress,
        toAddress: txPayload.to,
        txAmount: "0",
        inputData: txPayload.data,
      });

      const simData = simResult?.data?.[0] ?? simResult;
      const simStatus: string = simData?.simulationStatus ?? simData?.status ?? "";

      if (simStatus === "failed" || simStatus === "reverted") {
        this.logger.warn("⛔ OnchainOS Gateway simulation FAILED — tx DROPPED", { status: simStatus });
        return {
          success: false,
          reason: `Gateway simulation reverted: ${simData?.errorMessage ?? simStatus}`,
          warnings,
        };
      }

      const gasEstimate = simData?.gasUsed ? BigInt(simData.gasUsed) : BigInt(500_000);
      this.logger.info("✅ OnchainOS Gateway simulation PASSED", { gasEstimate: gasEstimate.toString() });

      return { success: true, reason: "okx-onchain-gateway passed", gasEstimate, warnings };
    } catch (err) {
      // Fail-closed: simulation API failure = transaction dropped
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn("⛔ OnchainOS Gateway simulation FAILED — tx DROPPED (fail-closed)", { error: msg });
      return {
        success: false,
        reason: `okx-onchain-gateway unavailable: ${msg}`,
        warnings: [...warnings, "[INFRASTRUCTURE] Gateway simulation unreachable — transaction blocked for safety"],
      };
    }
  }

  /**
   * Validate that a flash rescue operation is profitable
   * by comparing rescue cost against liquidation penalty savings
   */
  async validateRescueProfitability(
    debtAmount: bigint,
    estimatedSlippageBps: number
  ): Promise<{ profitable: boolean; margin: bigint }> {
    const flashPremium = (debtAmount * BigInt(5)) / BigInt(10_000); // 0.05%
    const slippageCost = (debtAmount * BigInt(estimatedSlippageBps)) / BigInt(10_000);
    const totalCost = flashPremium + slippageCost;

    // Aave V3 liquidation penalty is typically 5% (500 bps)
    const liquidationPenalty = (debtAmount * BigInt(500)) / BigInt(10_000);

    const margin = liquidationPenalty - totalCost;
    return {
      profitable: margin > BigInt(0),
      margin,
    };
  }
}
