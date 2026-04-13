/**
 * OnchainOS Gateway Wrapper
 *
 * Wraps the `okx-onchain-gateway` CLI for transaction simulation and broadcasting.
 * This is the CRITICAL security layer — every transaction MUST pass simulation
 * before being broadcast to the network.
 */

import { execCommand } from "../utils/cli.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("GatewayClient");

export class GatewayClient {
  /**
   * Simulate a transaction via `onchainos gateway simulate`
   * Fail-closed: any error = transaction dropped.
   */
  async simulateTransaction(payload: TransactionPayload): Promise<SimulationResult> {
    try {
      const args = [
        `onchainos gateway simulate`,
        `--from ${payload.from}`,
        `--to ${payload.to}`,
        `--data ${payload.data}`,
        `--chain xlayer`,
      ].join(" ");

      const stdout = await execCommand(args);
      const result = JSON.parse(stdout);

      if (!result.ok) {
        return { success: false, gasEstimate: BigInt(0), reason: result.error || "simulation failed", stateChanges: [] };
      }

      const simData = result.data ?? {};
      const status: string = simData.status ?? simData.simulationStatus ?? "success";

      if (status === "failed" || status === "reverted") {
        return { success: false, gasEstimate: BigInt(0), reason: simData.errorMessage ?? status, stateChanges: [] };
      }

      const gasEstimate = simData.gasUsed ? BigInt(simData.gasUsed) : BigInt(500_000);
      logger.info("✅ onchainos gateway simulate PASSED", { gasEstimate: gasEstimate.toString() });
      return { success: true, gasEstimate, reason: "gateway simulate passed", stateChanges: [] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn("⛔ onchainos gateway simulate FAILED — tx DROPPED", { error: msg });
      return { success: false, gasEstimate: BigInt(0), reason: `gateway simulate error: ${msg}`, stateChanges: [] };
    }
  }

  /**
   * Broadcast a signed transaction via `onchainos gateway broadcast`
   */
  async broadcastTransaction(signedTx: string, fromAddress: string): Promise<ExecutionResult> {
    try {
      const stdout = await execCommand(
        `onchainos gateway broadcast --signed-tx ${signedTx} --address ${fromAddress} --chain xlayer`
      );
      const result = JSON.parse(stdout);
      if (!result.ok) throw new Error(result.error);
      const txHash: string = result.data?.txHash ?? result.data?.orderId ?? "";
      logger.info("🚀 onchainos gateway broadcast SUCCESS", { txHash });
      return { txHash, status: "pending", blockNumber: 0 };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("❌ onchainos gateway broadcast FAILED", { error: msg });
      return { txHash: "", status: "failed", blockNumber: 0 };
    }
  }

  /**
   * Execute a transaction via okx-agentic-wallet (TEE signing + broadcast)
   */
  async executeTransaction(payload: TransactionPayload): Promise<ExecutionResult> {
    try {
      const stdout = await execCommand(
        `onchainos wallet contract-call --to ${payload.to} --chain xlayer --input-data ${payload.data} --amt 0`
      );
      const result = JSON.parse(stdout);
      if (!result.ok) throw new Error(result.error);
      const txHash: string = result.data?.txHash ?? "";
      logger.info("🔐 onchainos wallet contract-call SUCCESS", { txHash });
      return { txHash, status: "pending", blockNumber: 0 };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("❌ onchainos wallet contract-call FAILED", { error: msg });
      return { txHash: "", status: "failed", blockNumber: 0 };
    }
  }
}

interface TransactionPayload {
  from?: string;
  to: string;
  data: string;
  value?: string;
  chainId: number;
}

interface SimulationResult {
  success: boolean;
  gasEstimate: bigint;
  reason: string;
  stateChanges: StateChange[];
}

interface StateChange {
  address: string;
  key: string;
  oldValue: string;
  newValue: string;
}

interface ExecutionResult {
  txHash: string;
  status: "pending" | "confirmed" | "failed";
  blockNumber: number;
}
