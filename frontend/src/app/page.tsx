"use client";

import React, { useEffect, useRef, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { HealthFactorDial } from "@/components/HealthFactorDial";
import { LPRangeVisualizer } from "@/components/LPRangeVisualizer";
import { StatCard, WalletBalances } from "@/components/StatCard";
import { ActivityFeed } from "@/components/ActivityFeed";
import { useWallet } from "@/hooks/useWallet";
import { useAavePosition } from "@/hooks/useAavePosition";
import { useLPPositions } from "@/hooks/useLPPositions";
import { useWalletBalances } from "@/hooks/useWalletBalances";

// ─── Demo / fallback data (shown when wallet not connected) ───────────

const DEMO_ACTIVITIES: any[] = [
  {
    id: "1",
    type: "FLASH_RESCUE",
    status: "success",
    description: "Emergency Flash Rescue Executed",
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
    txHash: "0x4aee4cbc6f76152f86f1b96e75a3de7103af18c95d3cf86987c671377303f278",
    detail: "Health Factor restored from 1.08 → 1.54 via OKX DEX liquidity routing.",
  },
  {
    id: "2",
    type: "LP_REBALANCE",
    status: "success",
    description: "Concentrated LP Range Optimization",
    timestamp: new Date(Date.now() - 23 * 60 * 1000),
    txHash: "0x9dd370afe26da3ae53c2947534cb173efc634809cd16928884d7201161966ba3",
    detail: "Shifted WOKB/USDC 0.3% ticks to stay within high-volume volatility bands.",
  },
  {
    id: "3",
    type: "SIMULATION_DROPPED",
    status: "dropped",
    description: "Fail-Closed: Slippage Limit Exceeded",
    timestamp: new Date(Date.now() - 42 * 60 * 1000),
    detail: "Pre-execution simulation detected 1.2% slippage (Limit: 0.5%). Transaction aborted for safety.",
  },
  {
    id: "4",
    type: "MONITORING",
    status: "info",
    description: "Continuous Safety Scans Active",
    timestamp: new Date(Date.now() - 60 * 60 * 1000),
    detail: "X Layer Block #12,842,102 verified. All safety oracles reporting sync.",
  },
];

const DEMO_LP_POSITIONS = [
  {
    tokenId: "42391",
    token0Symbol: "WOKB",
    token1Symbol: "USDC",
    currentTick: -72344,
    tickLower: -73200,
    tickUpper: -71400,
    currentPrice: 2918.44,
    lowerPrice: 2750.00,
    upperPrice: 3100.00,
    liquidity: "182450000",
    feeTier: 3000,
    isOutOfRange: false,
    isLoading: false,
  },
  {
    tokenId: "42187",
    token0Symbol: "WETH",
    token1Symbol: "USDC",
    currentTick: -41220,
    tickLower: -44000,
    tickUpper: -42000,
    currentPrice: 3412.10,
    lowerPrice: 3100.00,
    upperPrice: 3350.00,
    liquidity: "94200000",
    feeTier: 3000,
    isOutOfRange: true,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────

function formatUsd(value: number): string {
  if (value === 0) return "$0.00";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ─── Agent Status Panel (replaces grey X Layer Arena box) ─────────────

function AgentStatusPanel({ isConnected }: { isConnected: boolean }) {
  const [countdown, setCountdown] = useState(287); // seconds until next check
  const [lastAction] = useState(new Date(Date.now() - 14 * 60 * 1000));

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(prev => (prev <= 0 ? 300 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const mm = String(Math.floor(countdown / 60)).padStart(2, "0");
  const ss = String(countdown % 60).padStart(2, "0");

  return (
    <div className="panel p-5 space-y-4">
      <div className="flex items-center justify-between">
        <span className="data-label">Agent Status</span>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-safe status-dot"></span>
          <span className="text-[12px] font-semibold text-safe">ACTIVE</span>
        </div>
      </div>

      <div className="space-y-3">
        {/* Last action */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-base-muted">Last Action</span>
          <span className="text-[11px] data-value text-white">
            {lastAction.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>

        {/* Next check countdown */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-base-muted">Next Check</span>
          <span className="text-[13px] data-value text-cyan-400 font-semibold">
            {mm}:{ss}
          </span>
        </div>

        {/* Chain */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-base-muted">Chain</span>
          <span className="text-[11px] data-value text-white">X Layer Mainnet • 196</span>
        </div>

        {/* Contract */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-base-muted">Contract</span>
          <a
            href="https://www.oklink.com/xlayer/address/0xDDc90434a8DD095ac6B5046fFbC4BD5d5f477306"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] data-value text-cyan-400 hover:text-white transition-colors"
          >
            0xDDc9...7306
            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>

        {/* Agentic Wallet */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-base-muted">Agentic Wallet</span>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-safe"></span>
            <span className="text-[11px] text-safe font-medium">Connected</span>
          </div>
        </div>
      </div>

      {/* OnchainOS modules */}
      <div className="pt-3 border-t border-base-border">
        <span className="data-label text-[9px]">OnchainOS Modules</span>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {[
            { name: "okx-security", ok: true },
            { name: "okx-gateway", ok: true },
            { name: "okx-dex", ok: true },
          ].map((mod) => (
            <span
              key={mod.name}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-safe/15 bg-safe/5 text-[9px] text-safe font-medium"
            >
              ✓ {mod.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Threat Toast Notification ────────────────────────────────────────

function ThreatToast() {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  return (
    <div className="fixed bottom-6 left-6 z-50 animate-slide-up">
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-md border border-amber/20 bg-amber/10 backdrop-blur-sm">
        <span className="text-[13px]">🛡</span>
        <div>
          <span className="text-[12px] font-medium text-amber">
            1 Threat Neutralized
          </span>
          <span className="text-[11px] text-amber/60 ml-2">14m ago</span>
        </div>
        <button
          onClick={() => setVisible(false)}
          className="ml-3 text-amber/40 hover:text-amber transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { address, isConnected, isCorrectChain, connect } = useWallet();

  const aavePosition = useAavePosition(isConnected && isCorrectChain ? address : undefined);
  const { balances: liveBalances, isLoading: balancesLoading } = useWalletBalances(
    isConnected && isCorrectChain ? address : undefined
  );
  const { positions: liveLPPositions, isLoading: lpLoading } = useLPPositions(
    isConnected && isCorrectChain ? address : undefined,
    [],
  );

  // Use live data when connected to X Layer, demo otherwise
  const useDemo = !isConnected || !isCorrectChain;

  const displayHF          = useDemo ? 1.87 : aavePosition.healthFactor;
  const displayCollateral  = useDemo ? "$12,482.00" : formatUsd(aavePosition.totalCollateralUsd);
  const displayDebt        = useDemo ? "$6,104.50"  : formatUsd(aavePosition.totalDebtUsd);
  const displayRescues     = useDemo ? "12"          : String(aavePosition.rescueCount);
  const displayRebalances  = useDemo ? "142"         : String(aavePosition.rebalanceCount);
  const displayTVL         = useDemo
    ? "$42,861"
    : formatUsd(aavePosition.totalCollateralUsd + aavePosition.totalDebtUsd);

  const displayLPPositions = (useDemo || liveLPPositions.length === 0)
    ? DEMO_LP_POSITIONS
    : liveLPPositions;
  const displayLpLoading   = !useDemo && lpLoading;

  // Wallet balances: live when connected, demo otherwise
  const displayBalances = useDemo || liveBalances.every(b => b.balanceRaw === BigInt(0))
    ? [
        { symbol: "WOKB", name: "Wrapped OKB",  balance: "12.485",   usdValue: "3,745.50", color: "#0e91e9" },
        { symbol: "USDC", name: "USD Coin",      balance: "3,240.00", usdValue: "3,240.00", color: "#2775CA" },
      ]
    : liveBalances.map(b => ({
        symbol:   b.symbol,
        name:     b.name,
        balance:  b.balance,
        usdValue: b.symbol === "USDC" ? b.balance : "—",
        color:    b.color,
      }));

  return (
    <div className="min-h-screen bg-base-bg text-white relative">

      <Navbar />

      <main className="max-w-[1440px] mx-auto px-6 py-6 space-y-6">

        {/* ── Top Stats Bar — 4 metric cards in a row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-in">
          <StatCard
            label="Total Protected Value"
            value={displayTVL}
            sub="Collateral + Debt"
            change={useDemo ? { value: "+4.2% (24h)", positive: true } : undefined}
            accent="cyan"
            isLoading={!useDemo && aavePosition.isLoading}
            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>}
          />
          <StatCard
            label="Flash Loan Rescues"
            value={displayRescues}
            sub="Liquidations Prevented"
            accent="cyan"
            isLoading={!useDemo && aavePosition.isLoading}
            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
          />
          <StatCard
            label="LP Rebalances"
            value={displayRebalances}
            sub="Range Adjustments"
            accent="cyan"
            isLoading={!useDemo && aavePosition.isLoading}
            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}
          />
          <StatCard
            label="Threats Neutralized"
            value={useDemo ? "3" : "—"}
            sub="Risky Txns Blocked"
            accent="amber"
            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
          />
        </div>

        {/* ── Main Grid: Content + Agent Status ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* ── LEFT COLUMN (8/12): Engine + Positions ── */}
          <div className="lg:col-span-8 space-y-6 animate-slide-up" style={{ animationDelay: "100ms" }}>

            {/* Aave V3 Health Factor */}
            <div className="panel p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-[15px] font-semibold text-white">Aave V3 Safety Engine</h2>
                  <p className="text-[11px] text-base-muted mt-0.5">Health Factor Monitoring</p>
                </div>
                {isConnected && !isCorrectChain && (
                  <span className="text-[10px] font-medium text-amber px-2 py-0.5 rounded border border-amber/20 bg-amber/5">
                    Wrong Network
                  </span>
                )}
              </div>

              <div className="flex flex-col md:flex-row items-center gap-6">
                <HealthFactorDial
                  value={displayHF}
                  isLoading={!useDemo && aavePosition.isLoading}
                />

                <div className="flex-1 grid grid-cols-2 gap-3 w-full">
                  <div className="p-3 rounded-md bg-base-elevated border border-base-border">
                    <span className="data-label text-[9px]">Collateral</span>
                    {!useDemo && aavePosition.isLoading ? (
                      <div className="h-5 w-20 bg-base-subtle rounded animate-pulse mt-1"></div>
                    ) : (
                      <p className="text-[15px] font-medium data-value text-white mt-1">{displayCollateral}</p>
                    )}
                  </div>
                  <div className="p-3 rounded-md bg-base-elevated border border-base-border">
                    <span className="data-label text-[9px]">Active Debt</span>
                    {!useDemo && aavePosition.isLoading ? (
                      <div className="h-5 w-20 bg-base-subtle rounded animate-pulse mt-1"></div>
                    ) : (
                      <p className="text-[15px] font-medium data-value text-amber mt-1">{displayDebt}</p>
                    )}
                  </div>
                  <div className="p-3 rounded-md bg-base-elevated border border-base-border">
                    <span className="data-label text-[9px]">Health Factor</span>
                    <p className="text-[15px] font-semibold data-value text-cyan-400 mt-1">{displayHF.toFixed(2)}</p>
                  </div>
                  <div className="p-3 rounded-md bg-base-elevated border border-base-border">
                    <span className="data-label text-[9px]">Liquidation At</span>
                    <p className="text-[15px] font-medium data-value text-danger/70 mt-1">1.00</p>
                  </div>
                </div>
              </div>

              {/* Optimal repayment hint — only shown when at risk */}
              {!useDemo && aavePosition.isAtRisk && aavePosition.optimalRepayment > BigInt(0) && (
                <div className="mt-4 p-3 rounded-md bg-danger/5 border border-danger/20 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-danger">
                    Rescue Queued — Repay {(Number(aavePosition.optimalRepayment) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC
                  </span>
                  <svg className="w-4 h-4 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
              )}
            </div>

            {/* Uniswap V3 Positions */}
            <div className="panel p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-[15px] font-semibold text-white">Uniswap V3 Positions</h2>
                  <p className="text-[11px] text-base-muted mt-0.5">Automated Tick Rebalancing</p>
                </div>
                {!useDemo && (
                  <span className="text-[11px] data-value text-base-muted">
                    {displayLPPositions.filter((p: any) => !p.isOutOfRange).length}/{displayLPPositions.length} In Range
                  </span>
                )}
              </div>

              {useDemo && !isConnected ? (
                <div className="py-10 text-center">
                  <div className="w-10 h-10 rounded-md bg-base-elevated border border-base-border flex items-center justify-center mx-auto mb-3">
                    <svg className="w-4 h-4 text-base-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </div>
                  <p className="text-[13px] font-medium text-base-muted">Connect OKX Wallet to monitor positions</p>
                  <button
                    onClick={connect}
                    className="mt-3 px-4 py-1.5 rounded-md bg-cyan-400/10 border border-cyan-400/20 text-cyan-400 text-[12px] font-semibold hover:bg-cyan-400/20 transition-all"
                  >
                    Connect Wallet
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {displayLPPositions.map((pos: any) => (
                    <LPRangeVisualizer key={pos.tokenId} {...pos} />
                  ))}

                  {displayLPPositions.length === 0 && !displayLpLoading && (
                    <div className="py-10 text-center">
                      <p className="text-[13px] font-medium text-base-muted">No Active Positions</p>
                      <p className="text-[11px] text-base-muted/60 mt-1">No Uniswap V3 LP positions detected on X Layer.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Activity Feed */}
            <div className="panel p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-[15px] font-semibold text-white">Execution Log</h2>
                  <p className="text-[11px] text-base-muted mt-0.5">Sequential Polling • 5min Intervals</p>
                </div>
                <a
                  href="https://www.oklink.com/xlayer/address/0x1e6955512b94a8CECbD28781c00B4930900f5147"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] font-medium text-cyan-400 hover:text-white transition-colors"
                >
                  OKLink
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
              <ActivityFeed activities={DEMO_ACTIVITIES} />
            </div>
          </div>

          {/* ── RIGHT COLUMN (4/12): Agent Status + Portfolio ── */}
          <div className="lg:col-span-4 space-y-6 animate-slide-up" style={{ animationDelay: "200ms" }}>

            {/* Agent Status Panel */}
            <AgentStatusPanel isConnected={isConnected} />

            {/* Portfolio */}
            <div className="panel p-5">
              <h2 className="text-[13px] font-semibold text-white mb-3">Portfolio</h2>
              <WalletBalances
                assets={displayBalances}
                isLoading={!useDemo && balancesLoading}
              />
              <div className="mt-3 pt-3 border-t border-base-border text-center">
                <span className="text-[10px] text-base-muted">
                  {useDemo ? "Connect wallet for live data" : "Live • X Layer Mainnet"}
                </span>
              </div>
            </div>

            {/* Network info */}
            {isConnected && !isCorrectChain && (
              <div className="panel p-4 border-l-2 border-l-amber">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber status-dot"></span>
                  <span className="text-[12px] font-medium text-amber">Wrong Network</span>
                </div>
                <p className="text-[11px] text-base-muted mt-1">Switch to X Layer (Chain ID 196) to see live data.</p>
              </div>
            )}
          </div>

        </div>

        {/* ── Footer ── */}
        <footer className="pt-6 pb-4 animate-fade-in" style={{ animationDelay: "300ms" }}>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-4 border-t border-base-border">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <span className="text-[12px] font-medium text-white">VaultMind Protocol</span>
                <span className="text-[10px] text-base-muted ml-2">Built for OKX Build X Hackathon</span>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div>
                <span className="text-[9px] text-base-muted block">FlashRescue</span>
                <a
                  href="https://www.oklink.com/xlayer/address/0x1e6955512b94a8CECbD28781c00B4930900f5147"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] data-value text-cyan-400 hover:text-white transition-colors"
                >
                  0x1e69…5147
                </a>
              </div>
              <div>
                <span className="text-[9px] text-base-muted block">LiquidityMgr</span>
                <a
                  href="https://www.oklink.com/xlayer/address/0x2AF9F9314ADbd03811EE8Fd71087f92cba6341b7"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] data-value text-cyan-400 hover:text-white transition-colors"
                >
                  0x2AF9…41b7
                </a>
              </div>
              <div>
                <span className="text-[9px] text-base-muted block">Network</span>
                <span className="text-[11px] data-value text-safe">X Layer • 196</span>
              </div>
            </div>
          </div>
        </footer>

      </main>

      {/* Threat Notification Toast */}
      <ThreatToast />
    </div>
  );
}
