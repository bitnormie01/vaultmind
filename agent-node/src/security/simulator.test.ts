import { describe, it, expect, vi, beforeEach } from "vitest";
import { SecuritySimulator } from "./simulator.js";
import * as api from "../onchainos/api.js";

const WOKB = "0xe538905cf8410324e03a5a23c1c177a474d59b2b";
const USDC = "0x74b7f16337b8972027f6196a17a631ac6de26d22";
const ZERO = "0x0000000000000000000000000000000000000000";

const baseTx = { to: "0xabc", data: "0x1234", chainId: 196 };
const baseCtx = { tokenIn: WOKB, tokenOut: USDC, amount: "1000000", userAddress: "0xuser" };

describe("SecuritySimulator", () => {
  let simulator: SecuritySimulator;

  beforeEach(() => {
    simulator = new SecuritySimulator();
    vi.restoreAllMocks();
  });

  // ── Fail-closed: API errors must block, not pass ──────────────────

  it("drops tx when token security API throws (fail-closed)", async () => {
    vi.spyOn(api, "sendPostRequest").mockRejectedValueOnce(new Error("network timeout"));

    const result = await simulator.simulate(baseTx, baseCtx);

    expect(result.success).toBe(false);
    expect(result.reason).toContain("okx-security unavailable");
  });

  it("drops tx when gateway simulation API throws (fail-closed)", async () => {
    // Token scan passes, gateway throws
    vi.spyOn(api, "sendPostRequest")
      .mockResolvedValueOnce({ data: [{ riskLevel: "LOW", tokenContractAddress: WOKB }] })
      .mockRejectedValueOnce(new Error("gateway timeout"));

    const result = await simulator.simulate(baseTx, baseCtx);

    expect(result.success).toBe(false);
    expect(result.reason).toContain("okx-onchain-gateway unavailable");
  });

  // ── Token risk blocking ───────────────────────────────────────────

  it("blocks HIGH risk token", async () => {
    vi.spyOn(api, "sendPostRequest").mockResolvedValueOnce({
      data: [{ riskLevel: "HIGH", tokenContractAddress: WOKB }],
    });

    const result = await simulator.simulate(baseTx, baseCtx);

    expect(result.success).toBe(false);
    expect(result.reason).toContain("HIGH");
  });

  it("blocks CRITICAL risk token", async () => {
    vi.spyOn(api, "sendPostRequest").mockResolvedValueOnce({
      data: [{ riskLevel: "CRITICAL", tokenContractAddress: USDC }],
    });

    const result = await simulator.simulate(baseTx, baseCtx);

    expect(result.success).toBe(false);
    expect(result.reason).toContain("CRITICAL");
  });

  it("passes MEDIUM risk token with warning (not blocked)", async () => {
    vi.spyOn(api, "sendPostRequest")
      .mockResolvedValueOnce({ data: [{ riskLevel: "MEDIUM", tokenContractAddress: WOKB }] })
      .mockResolvedValueOnce({ data: [{ simulationStatus: "success", gasUsed: "450000" }] });

    const result = await simulator.simulate(baseTx, baseCtx);

    expect(result.success).toBe(true);
    expect(result.warnings.some(w => w.includes("MEDIUM"))).toBe(true);
  });

  // ── Gateway simulation blocking ───────────────────────────────────

  it("blocks when gateway returns reverted status", async () => {
    vi.spyOn(api, "sendPostRequest")
      .mockResolvedValueOnce({ data: [{ riskLevel: "LOW", tokenContractAddress: WOKB }] })
      .mockResolvedValueOnce({ data: [{ simulationStatus: "reverted", errorMessage: "execution reverted" }] });

    const result = await simulator.simulate(baseTx, baseCtx);

    expect(result.success).toBe(false);
    expect(result.reason).toContain("reverted");
  });

  it("blocks when gateway returns failed status", async () => {
    vi.spyOn(api, "sendPostRequest")
      .mockResolvedValueOnce({ data: [{ riskLevel: "LOW", tokenContractAddress: WOKB }] })
      .mockResolvedValueOnce({ data: [{ simulationStatus: "failed" }] });

    const result = await simulator.simulate(baseTx, baseCtx);

    expect(result.success).toBe(false);
  });

  // ── Happy path ────────────────────────────────────────────────────

  it("approves tx when both token scan and gateway pass", async () => {
    vi.spyOn(api, "sendPostRequest")
      .mockResolvedValueOnce({ data: [{ riskLevel: "LOW", tokenContractAddress: WOKB }] })
      .mockResolvedValueOnce({ data: [{ simulationStatus: "success", gasUsed: "480000" }] });

    const result = await simulator.simulate(baseTx, baseCtx);

    expect(result.success).toBe(true);
    expect(result.gasEstimate).toBe(BigInt(480000));
  });

  it("skips token scan for LP_REBALANCE (zero-address tokens)", async () => {
    const gatewaySpy = vi.spyOn(api, "sendPostRequest")
      .mockResolvedValueOnce({ data: [{ simulationStatus: "success", gasUsed: "300000" }] });

    const lpCtx = { tokenIn: ZERO, tokenOut: ZERO, amount: "0", userAddress: "0xuser" };
    const result = await simulator.simulate(baseTx, lpCtx);

    // Only one call — gateway only, no token scan
    expect(gatewaySpy).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
  });

  // ── validateRescueProfitability ───────────────────────────────────

  it("rescue is profitable when slippage < liquidation penalty", async () => {
    const debt = BigInt(10_000e6); // $10k USDC
    const { profitable, margin } = await simulator.validateRescueProfitability(debt, 50); // 0.5% slippage
    expect(profitable).toBe(true);
    expect(margin).toBeGreaterThan(BigInt(0));
  });

  it("rescue is unprofitable when slippage exceeds liquidation penalty", async () => {
    const debt = BigInt(10_000e6);
    const { profitable } = await simulator.validateRescueProfitability(debt, 600); // 6% > 5% liq penalty
    expect(profitable).toBe(false);
  });
});
