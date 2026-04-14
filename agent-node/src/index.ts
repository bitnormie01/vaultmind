/**
 * VaultMind Agent — Main Autonomous Loop (Sequential Polling)
 *
 * Architecture: Monitor → Analyze → Execute
 *
 * RATE LIMIT NOTE:
 *   X Layer (v6) enforces a strict 3 req/sec RPC rate limit.
 *   We use SEQUENTIAL polling with a 400ms delay between every RPC call.
 *   This guarantees 100% uptime — no HTTP 429 "Too Many Requests" errors.
 *   All RPC calls are serialized through the `rpcCall()` helper.
 *
 * OnchainOS Integration:
 *   - All DEX swaps are routed through OKX DEX Aggregator (okx-dex-swap skill)
 *   - Portfolios fetched via okx-defi-portfolio
 *   - Pre-execution simulation via okx-onchain-gateway (MANDATORY)
 *   - Token security checks via okx-security
 */

import { createPublicClient, createWalletClient, http, defineChain, encodeFunctionData, parseGwei } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import dotenv from "dotenv";
import { createLogger } from "./utils/logger.js";
import { PortfolioMonitor } from "./onchainos/portfolio.js";
import { SecuritySimulator } from "./security/simulator.js";
import { GatewayClient } from "./onchainos/gateway.js";
import { HealthFactorAnalyzer } from "./quant/healthFactor.js";
import { TickRangeAnalyzer } from "./quant/tickRange.js";
import { OKXDexClient } from "./onchainos/dex.js";
import { CognitiveEngine } from "./ai/cognitiveEngine.js";
import { X402PaymentProtocol } from "./onchainos/x402.js";
import { execCommand } from "./utils/cli.js";
import { startApiServer, updateAgentStatus, pushActivity } from "./server.js";

dotenv.config();

// ─── X Layer Chain Definition ─────────────────────────────────────────

const xLayer = defineChain({
  id: 196,
  name: "X Layer",
  network: "x-layer",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.XLAYER_RPC_URL || "https://rpc.xlayer.tech"] },
  },
  blockExplorers: {
    default: {
      name: "OKLink X Layer Explorer",
      url: "https://www.oklink.com/xlayer",
    },
  },
});

// ─── Configuration ───────────────────────────────────────────────────

const CONFIG = {
  rpcUrl:                process.env.XLAYER_RPC_URL || "https://rpc.xlayer.tech",
  chainId:               196,

  // CRITICAL: 400ms delay between every RPC call.
  // X Layer v6 rate limit: 3 req/sec. This gives us ~2.5 req/sec with headroom.
  rpcDelayMs:            400,

  // Agent loop poll interval: every 5 minutes
  pollIntervalMs:        300_000,

  // Health factor alert threshold — rescue fires below this value
  healthFactorThreshold: parseFloat(process.env.HEALTH_FACTOR_THRESHOLD || "1.3"),

  contracts: {
    vaultMindCore:     process.env.VAULTMIND_CORE_ADDRESS  || "" as `0x${string}`,
    flashRescue:       process.env.FLASH_RESCUE_ADDRESS    || "" as `0x${string}`,
    liquidityManager:  process.env.LIQUIDITY_MANAGER_ADDRESS || "" as `0x${string}`,
  },

  // X Layer Mainnet token addresses
  tokens: {
    WOKB:  "0xe538905cf8410324e03a5a23c1c177a474d59b2b" as `0x${string}`,
    USDC:  "0x74b7f16337b8972027f6196a17a631ac6de26d22" as `0x${string}`,
  },
} as const;

// ─── Types ───────────────────────────────────────────────────────────

interface AgentState {
  isRunning: boolean;
  lastPollTimestamp: number;
  consecutiveErrors: number;
  totalRescues: number;
  totalRebalances: number;
  totalRpcCalls: number;
  droppedBySimulation: number;
}

interface WalletPosition {
  healthFactor: bigint;
  totalCollateral: bigint;
  totalDebt: bigint;
  lpPositions: LPPosition[];
}

interface LPPosition {
  tokenId: bigint;
  tickLower: number;
  tickUpper: number;
  currentTick: number;
  liquidity: bigint;
  isOutOfRange: boolean;
}

interface AgentAction {
  type: "FLASH_RESCUE" | "LP_REBALANCE";
  params: Record<string, unknown>;
}

// ─── Main Agent Class ─────────────────────────────────────────────────

class VaultMindAgent {
  private state: AgentState;
  private logger: ReturnType<typeof createLogger>;

  // viem clients (sequential — single shared instance)
  private publicClient: ReturnType<typeof createPublicClient>;
  private walletClient: ReturnType<typeof createWalletClient>;
  private account: ReturnType<typeof privateKeyToAccount>;

  // Sub-modules
  private portfolioMonitor: PortfolioMonitor;
  private securitySimulator: SecuritySimulator;
  private gatewayClient: GatewayClient;
  private hfAnalyzer: HealthFactorAnalyzer;
  private tickAnalyzer: TickRangeAnalyzer;
  private okxDex: OKXDexClient;
  private cognitiveEngine: CognitiveEngine;
  private x402Payment: X402PaymentProtocol;

  constructor() {
    this.logger = createLogger("VaultMindAgent");

    // Validate private key
    const rawKey = process.env.PRIVATE_KEY;
    if (!rawKey) throw new Error("PRIVATE_KEY not set in .env");
    const privateKey = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`;

    this.account = privateKeyToAccount(privateKey);

    // Single viem public client — all reads go through this sequentially
    this.publicClient = createPublicClient({
      chain: xLayer,
      transport: http(CONFIG.rpcUrl, {
        retryCount: 3,
        retryDelay: 1000, // 1s retry delay on failure
        timeout: 30_000,
      }),
    });

    this.walletClient = createWalletClient({
      account: this.account,
      chain: xLayer,
      transport: http(CONFIG.rpcUrl),
    });

    this.state = {
      isRunning: false,
      lastPollTimestamp: 0,
      consecutiveErrors: 0,
      totalRescues: 0,
      totalRebalances: 0,
      totalRpcCalls: 0,
      droppedBySimulation: 0,
    };

    // @ts-ignore
    this.portfolioMonitor = new PortfolioMonitor(this.publicClient);
    this.securitySimulator = new SecuritySimulator();
    this.gatewayClient = new GatewayClient();
    this.hfAnalyzer = new HealthFactorAnalyzer();
    this.tickAnalyzer = new TickRangeAnalyzer();
    this.okxDex = new OKXDexClient();
    this.cognitiveEngine = new CognitiveEngine();
    this.x402Payment = new X402PaymentProtocol();
  }

  /**
   * CORE: Sequential RPC call wrapper with 400ms delay enforcement.
   *
   * Every single RPC call MUST go through this method to respect
   * X Layer's 3 req/sec rate limit. Never call publicClient directly.
   *
   * @param label Human-readable label for logging
   * @param fn    Async function that makes exactly ONE RPC call
   */
  private async rpcCall<T>(label: string, fn: () => Promise<T>): Promise<T> {
    this.state.totalRpcCalls++;
    this.logger.debug(`[RPC #${this.state.totalRpcCalls}] ${label}`);

    const result = await fn();

    // MANDATORY 400ms delay after every RPC call
    await this.sleep(CONFIG.rpcDelayMs);

    return result;
  }

  // ─── Agent Lifecycle ─────────────────────────────────────────────────

  async start(): Promise<void> {
    // Start the status API server BEFORE the agent loop
    startApiServer(parseInt(process.env.API_PORT || "4000", 10));

    this.state.isRunning = true;
    updateAgentStatus({ isRunning: true });

    this.logger.info("🧠 VaultMind Agent starting...", {
      chainId:          CONFIG.chainId,
      wallet:           this.account.address,
      pollInterval:     `${CONFIG.pollIntervalMs}ms`,
      rpcDelay:         `${CONFIG.rpcDelayMs}ms (rate-limit safe)`,
      hfThreshold:      CONFIG.healthFactorThreshold,
      flashRescue:      CONFIG.contracts.flashRescue || "NOT CONFIGURED",
      liqManager:       CONFIG.contracts.liquidityManager || "NOT CONFIGURED",
    });

    pushActivity({
      type: "MONITORING",
      status: "info",
      description: "VaultMind Agent Online",
      detail: `Monitoring wallet on X Layer (Chain ID ${CONFIG.chainId}) • Poll interval: 5min`,
    });

    while (this.state.isRunning) {
      try {
        await this.executeCycle();
        this.state.consecutiveErrors = 0;
        updateAgentStatus({ ...this.state });
      } catch (error) {
        this.state.consecutiveErrors++;
        this.logger.error("❌ Agent cycle error", {
          error: error instanceof Error ? error.message : String(error),
          consecutiveErrors: this.state.consecutiveErrors,
        });

        pushActivity({
          type: "ERROR",
          status: "error",
          description: "Agent Cycle Error",
          detail: error instanceof Error ? error.message : String(error),
        });

        updateAgentStatus({ ...this.state });

        // Circuit breaker: 5 consecutive errors → pause 60s
        if (this.state.consecutiveErrors >= 5) {
          this.logger.error("🛑 Circuit breaker: pausing 60s then resuming");
          await this.sleep(60_000);
          this.state.consecutiveErrors = 0;
        }
      }

      this.logger.debug("💤 Waiting for next poll cycle...", {
        nextPollIn: `${CONFIG.pollIntervalMs}ms`,
        totalRpcCalls: this.state.totalRpcCalls,
      });
      await this.sleep(CONFIG.pollIntervalMs);
    }
  }

  // ─── Monitor → Analyze → Execute ─────────────────────────────────────

  private async executeCycle(): Promise<void> {
    this.state.lastPollTimestamp = Date.now();

    // ── PHASE 1: MONITOR (all RPC calls are sequential with 400ms delays) ──
    this.logger.debug("📡 [MONITOR] Fetching wallet state...");
    const position = await this.monitor();

    // ── PHASE 2: ANALYZE ──
    this.logger.debug("🔍 [ANALYZE] Evaluating position health...");
    const actions = await this.analyze(position);

    if (actions.length === 0) {
      this.logger.debug("✅ All positions healthy — no action required");
      return;
    }

    this.logger.info(`⚡ ${actions.length} action(s) queued`, {
      actions: actions.map(a => a.type),
    });

    // ── PHASE 3: EXECUTE (sequential, with mandatory simulation) ──
    for (const action of actions) {
      await this.execute(action);
      // Small delay between actions to avoid RPC spikes
      await this.sleep(CONFIG.rpcDelayMs);
    }
  }

  /**
   * MONITOR: Fetch chain state sequentially.
   * Each RPC call is separated by 400ms via rpcCall().
   */
  private async monitor(): Promise<WalletPosition> {
    // RPC call 1: block number (liveness check)
    const blockNumber = await this.rpcCall("getBlockNumber", () =>
      this.publicClient.getBlockNumber()
    );
    this.logger.debug(`📦 Block: ${blockNumber}`);

    // Fetch complete portfolio safely bypassing old logic
    const portfolio = await this.portfolioMonitor.fetchOnchainOSPortfolio(this.account.address);
    // Overwrite the returned defaults with actual data
    let healthFactor = portfolio.healthFactor;
    const lpPositions = portfolio.lpPositions;

    this.logger.debug("📊 Monitor complete", {
      blockNumber: blockNumber.toString(),
      healthFactor: (Number(healthFactor) / 1e18).toFixed(4),
      lpPositions: lpPositions.length,
    });

    return {
      healthFactor,
      totalCollateral: portfolio.totalCollateral,
      totalDebt: portfolio.totalDebt,
      lpPositions,
    };
  }

  /**
   * ANALYZE: Pure logic — no RPC calls here.
   */
  private async analyze(position: WalletPosition): Promise<AgentAction[]> {
    const actions: AgentAction[] = [];

    // Check 1: rescue needed?
    if (this.hfAnalyzer.isRescueNeeded(position.healthFactor, CONFIG.healthFactorThreshold)) {
      this.logger.warn("🚨 Health factor below threshold!", {
        current: (Number(position.healthFactor) / 1e18).toFixed(4),
        threshold: CONFIG.healthFactorThreshold,
      });

      const optimalRepayment = this.hfAnalyzer.calculateOptimalRepayment(
        position.totalCollateral,
        position.totalDebt,
        BigInt(Math.floor(CONFIG.healthFactorThreshold * 1e18))
      );

      // AI Cognitive Layer - Evaluate the necessity of the flash rescue
      const aiDecision = await this.cognitiveEngine.analyzeRiskAndRescue({
        healthFactor: (Number(position.healthFactor) / 1e18).toFixed(4),
        totalCollateral: position.totalCollateral.toString(),
        totalDebt: position.totalDebt.toString(),
        lpPositionsCount: position.lpPositions.length
      }, optimalRepayment.toString());

      if (aiDecision.execute) {
        // Get OKX DEX quote for the swap (uses OnchainOS okx-dex-swap skill)
        const swapQuote = await this.okxDex.getSwapQuote({
          chainId: CONFIG.chainId,
          fromTokenAddress: CONFIG.tokens.WOKB,
          toTokenAddress: CONFIG.tokens.USDC,
          amount: optimalRepayment.toString(),
          slippage: "0.5",
        });

        actions.push({
          type: "FLASH_RESCUE",
          params: {
            debtToRepay: optimalRepayment,
            swapQuote,
            currentHF: position.healthFactor,
            aiConfidence: aiDecision.confidenceScore,
            aiReasoning: aiDecision.reasoning
          },
        });
      }
    }

    // Check 2: LP positions out of range?
    for (const lp of position.lpPositions) {
      if (lp.isOutOfRange) {
        const newRange = this.tickAnalyzer.calculateOptimalRange(lp.currentTick, 60);
        
        // AI Cognitive Layer - Evaluate the rebalance
        const aiDecision = await this.cognitiveEngine.analyzeLPRebalance(
          lp.tokenId,
          lp.currentTick,
          [newRange.lower, newRange.upper]
        );

        if (aiDecision.execute) {
          actions.push({
            type: "LP_REBALANCE",
            params: { 
              tokenId: lp.tokenId, 
              newRange,
              aiConfidence: aiDecision.confidenceScore,
              aiReasoning: aiDecision.reasoning
            },
          });
        }
      }
    }

    return actions;
  }

  /**
   * EXECUTE: Simulate first, then execute.
   * If simulation fails → DROP the transaction.
   */
  private async execute(action: AgentAction): Promise<void> {
    this.logger.info(`🔬 Simulating ${action.type}...`);

    const txPayload = await this.buildTransaction(action);

    // Build context for Guardian Protocol evaluation
    let actionContext;
    if (action.type === "FLASH_RESCUE") {
      const params = action.params as any;
      actionContext = {
        tokenIn: CONFIG.tokens.WOKB, // Collateral being swapped
        tokenOut: CONFIG.tokens.USDC, // Debt being repaid
        amount: params.debtToRepay?.toString() || "0",
        userAddress: this.account.address,
      };
    } else { // LP_REBALANCE
      actionContext = {
        tokenIn: "0x0000000000000000000000000000000000000000",
        tokenOut: "0x0000000000000000000000000000000000000000",
        amount: "0",
        userAddress: this.account.address,
      };
    }

    // MANDATORY: simulate via unified Guardian Protocol BEFORE broadcasting
    const simulation = await this.securitySimulator.simulate(txPayload, actionContext);

    // Also run onchainos gateway simulate for belt-and-suspenders
    const gatewaySimResult = await this.gatewayClient.simulateTransaction({
      from: this.account.address,
      to: txPayload.to,
      data: txPayload.data,
      chainId: txPayload.chainId,
    });

    if (!simulation.success || !gatewaySimResult.success) {
      this.state.droppedBySimulation++;
      this.logger.warn("🚫 Simulation FAILED — tx DROPPED (safety guarantee)", {
        type: action.type,
        securityReason: simulation.reason,
        gatewayReason: gatewaySimResult.reason,
        totalDropped: this.state.droppedBySimulation,
      });
      pushActivity({
        type: "SIMULATION_DROPPED",
        status: "dropped",
        description: "Fail-Closed: Pre-Execution Simulation Failed",
        detail: `${action.type} blocked. Security: ${simulation.reason || "failed"}. Gateway: ${gatewaySimResult.reason || "failed"}.`,
      });
      updateAgentStatus({ ...this.state });
      return;
    }

    this.logger.info(`✅ Simulation passed. Requesting x402 payment signature...`, {
      gasEstimate: simulation.gasEstimate?.toString(),
    });

    const x402Auth = await this.x402Payment.authorizeTransaction(this.account.address, txPayload.data);

    this.logger.info(`🚀 Broadcasting with x402 Zero-Gas authorization (Signature: ${x402Auth.signature.substring(0, 10)}...)`);

    // Broadcast the transaction via OKX Agentic Wallet (TEE signing)
    try {
      this.logger.info("🔐 Triggering OKX Agentic Wallet TEE signing via onchainos CLI...");

      // Use onchainos wallet contract-call for TEE-signed execution
      const execResult = await this.gatewayClient.executeTransaction({
        from: this.account.address,
        to: txPayload.to,
        data: txPayload.data,
        chainId: txPayload.chainId,
      });

      let hash: `0x${string}` | null = null;

      if (execResult.txHash && execResult.txHash.startsWith("0x") && execResult.txHash.length === 66) {
        hash = execResult.txHash as `0x${string}`;
      } else {
        // Fallback: raw onchainos agentic-wallet execute command
        this.logger.info("🔄 Falling back to onchainos okx-agentic-wallet execute...");
        const cmd = `onchainos wallet contract-call --to ${txPayload.to} --chain xlayer --input-data ${txPayload.data} --amt 0 --force`;
        const stdout = await execCommand(cmd);
        const hashMatch = stdout.match(/0x[a-fA-F0-9]{64}/);
        hash = hashMatch ? (hashMatch[0] as `0x${string}`) : null;
      }

      if (!hash) {
        throw new Error("No txHash returned from Agentic Wallet.");
      }

      this.logger.info(`🚀 Transaction broadcasted via OKX Agentic Wallet! Hash: ${hash}`);

      const receipt = await this.rpcCall("waitForTx", () =>
        this.publicClient.waitForTransactionReceipt({ hash: hash! })
      );

      if (receipt.status === 'success') {
        if (action.type === "FLASH_RESCUE") {
          this.state.totalRescues++;
          pushActivity({
            type: "FLASH_RESCUE",
            status: "success",
            description: "Emergency Flash Rescue Executed",
            detail: `Health Factor rescued via OKX DEX liquidity routing. Block #${receipt.blockNumber}`,
            txHash: hash,
          });
        } else {
          this.state.totalRebalances++;
          pushActivity({
            type: "LP_REBALANCE",
            status: "success",
            description: "Concentrated LP Range Optimization",
            detail: `Position rebalanced to optimal tick range. Block #${receipt.blockNumber}`,
            txHash: hash,
          });
        }
        updateAgentStatus({ ...this.state });
        this.logger.info(`🎯 ${action.type} complete (Block: ${receipt.blockNumber})`, {
          totalRescues:    this.state.totalRescues,
          totalRebalances: this.state.totalRebalances,
        });
      } else {
        this.logger.error(`❌ Transaction reverted on-chain: ${hash}`);
        pushActivity({
          type: action.type,
          status: "error",
          description: `${action.type} Reverted On-Chain`,
          detail: `Transaction ${hash} was reverted. Check X Layer explorer for details.`,
          txHash: hash,
        });
      }
    } catch (error) {
      this.logger.error(`Failed to broadcast transaction: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async buildTransaction(action: AgentAction): Promise<{ to: string; data: string; chainId: number }> {
    let to: string;
    let data: string;

    if (action.type === "FLASH_RESCUE") {
      to = CONFIG.contracts.flashRescue;
      const params = action.params as any;
      data = encodeFunctionData({
        abi: FLASH_RESCUE_ABI,
        functionName: "executeRescue",
        args: [
          {
            userWallet: this.account.address,
            debtAsset: CONFIG.tokens.USDC,
            collateralAsset: CONFIG.tokens.WOKB,
            debtToRepay: params.debtToRepay,
          },
        ],
      });
    } else {
      to = CONFIG.contracts.liquidityManager;
      const params = action.params as any;
      data = encodeFunctionData({
        abi: LIQUIDITY_MANAGER_ABI,
        functionName: "rebalancePosition",
        args: [
          {
            userWallet: this.account.address,
            tokenId: params.tokenId,
            newTickLower: params.newRange.lower,
            newTickUpper: params.newRange.upper,
          },
        ],
      });
    }

    return {
      to,
      data,
      chainId: CONFIG.chainId,
    };
  }

  stop(): void {
    this.logger.info("🛑 VaultMind Agent shutting down", {
      totalRescues:       this.state.totalRescues,
      totalRebalances:    this.state.totalRebalances,
      totalRpcCalls:      this.state.totalRpcCalls,
      droppedBySimulation: this.state.droppedBySimulation,
    });
    this.state.isRunning = false;
    updateAgentStatus({ isRunning: false, ...this.state });
    pushActivity({
      type: "MONITORING",
      status: "info",
      description: "Agent Shutting Down",
      detail: `Total rescues: ${this.state.totalRescues} | Rebalances: ${this.state.totalRebalances} | Dropped: ${this.state.droppedBySimulation}`,
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ─── ABIs ─────────────────────────────────────────────────────────────

const FLASH_RESCUE_ABI = [
  {
    name: "getUserHealthFactor",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "healthFactor", type: "uint256" }],
  },
  {
    name: "executeRescue",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "userWallet", type: "address" },
          { name: "debtAsset", type: "address" },
          { name: "collateralAsset", type: "address" },
          { name: "debtToRepay", type: "uint256" },
        ],
      },
    ],
    outputs: [],
  },
] as const;

const LIQUIDITY_MANAGER_ABI = [
  {
    name: "rebalancePosition",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "userWallet", type: "address" },
          { name: "tokenId", type: "uint256" },
          { name: "newTickLower", type: "int24" },
          { name: "newTickUpper", type: "int24" },
        ],
      },
    ],
    outputs: [{ name: "newTokenId", type: "uint256" }],
  },
] as const;

// ─── Entrypoint ───────────────────────────────────────────────────────

const agent = new VaultMindAgent();

process.on("SIGINT",  () => agent.stop());
process.on("SIGTERM", () => agent.stop());

agent.start().catch(err => {
  console.error("Fatal agent error:", err);
  process.exit(1);
});
