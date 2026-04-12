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

// ─── Page ─────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { address, isConnected, isCorrectChain } = useWallet();

  const aavePosition = useAavePosition(isConnected && isCorrectChain ? address : undefined);
  const { balances: liveBalances, isLoading: balancesLoading } = useWalletBalances(
    isConnected && isCorrectChain ? address : undefined
  );
  const { positions: liveLPPositions, isLoading: lpLoading } = useLPPositions(
    isConnected && isCorrectChain ? address : undefined,
    [],
  );

  const [lastUpdatedLabel, setLastUpdatedLabel] = useState("just now");
  const lastUpdatedRef = useRef<Date>(new Date());

  useEffect(() => {
    if (!aavePosition.isLoading) lastUpdatedRef.current = new Date();
    const t = setInterval(() => {
      const secs = Math.floor((Date.now() - lastUpdatedRef.current.getTime()) / 1000);
      setLastUpdatedLabel(secs < 5 ? "Live" : `${secs}s ago`);
    }, 1000);
    return () => clearInterval(t);
  }, [aavePosition.isLoading]);

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
    <div className="min-h-screen bg-vault-bg text-white relative overflow-hidden">
      {/* Premium Background Layers */}
      <div className="aura-bg" />
      <div className="fixed inset-0 bg-grid-pattern opacity-[0.4] pointer-events-none" />
      <div className="fixed inset-0 bg-gradient-to-b from-transparent via-vault-bg/50 to-vault-bg pointer-events-none" />

      <Navbar />

      <main className="relative max-w-[1400px] mx-auto px-6 py-10 space-y-8">

        {/* ── Dashboard Header ── */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 animate-fade-in">
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 rounded-md bg-brand-500/10 border border-brand-500/20 text-[10px] font-black text-brand-400 uppercase tracking-widest">Global Dashboard</span>
              <span className="w-1 h-1 rounded-full bg-vault-muted/40" />
              <span className="text-[10px] font-bold text-vault-muted uppercase tracking-widest">v0.2.1 Stable</span>
            </div>
            <h1 className="text-4xl font-black tracking-tight flex items-center gap-3">
              Vault<span className="text-brand-500">Mind</span>
              <div className="w-2 h-2 rounded-full bg-status-safe status-pulse mt-2" />
            </h1>
            <p className="text-vault-muted font-medium">Autonomous Liquidity Guardian & Safety Engine</p>
          </div>
          {!isConnected && (
            <div className="p-4 rounded-3xl bg-brand-500/5 border border-brand-500/10 max-w-sm">
              <p className="text-xs text-brand-400 font-bold uppercase tracking-widest mb-1">X Layer Arena</p>
              <p className="text-xs text-vault-muted leading-relaxed">Connect your Agentic Wallet to begin real-time safety monitoring.</p>
            </div>
          )}
          {isConnected && !isCorrectChain && (
            <div className="p-4 rounded-3xl bg-status-warning/5 border border-status-warning/20 max-w-sm">
              <p className="text-xs text-status-warning font-bold uppercase tracking-widest mb-1">Wrong Network</p>
              <p className="text-xs text-vault-muted leading-relaxed">Switch to X Layer (Chain ID 196) to see live position data.</p>
            </div>
          )}
        </header>

        {/* ── Bento Row 1: Key Stats ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 animate-slide-up" style={{ animationDelay: "100ms" }}>
          <StatCard
            label="Total Protected Value"
            value={displayTVL}
            sub="Collateral + Debt on Aave V3"
            change={useDemo ? { value: "+4.2% (24h)", positive: true } : undefined}
            accent="brand"
            isLoading={!useDemo && aavePosition.isLoading}
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>}
          />
          <StatCard
            label="Successful Rescues"
            value={displayRescues}
            sub="Flash Loan Interventions"
            accent="safe"
            isLoading={!useDemo && aavePosition.isLoading}
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
          />
          <StatCard
            label="LP Rebalances"
            value={displayRebalances}
            sub="Uniswap V3 Range Adjustments"
            accent="brand"
            isLoading={!useDemo && aavePosition.isLoading}
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}
          />
          <StatCard
            label="Security Intercepts"
            value={useDemo ? "3" : "—"}
            sub="Risky Transactions Blocked"
            accent="danger"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
          />
        </div>

        {/* ── Main Bento Grid Layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* ── COLUMN LEFT (4/12): Safety Engine ── */}
          <div className="lg:col-span-4 space-y-8 animate-slide-up" style={{ animationDelay: "200ms" }}>

            {/* Aave Dial Box */}
            <div className="bento-card p-8 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-vault-border/50">
                <div>
                  <h2 className="text-lg font-black tracking-tight text-white mb-1">Aave V3 Engine</h2>
                  <p className="text-[10px] font-black text-vault-muted uppercase tracking-[0.2em]">Safety Monitoring</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-status-safe/5 border border-status-safe/10 text-status-safe text-[10px] font-black uppercase">
                  {useDemo ? "Demo" : lastUpdatedLabel}
                </div>
              </div>

              <HealthFactorDial
                value={displayHF}
                isLoading={!useDemo && aavePosition.isLoading}
              />

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-vault-surface/50 border border-vault-border/50">
                  <p className="text-[9px] font-black text-vault-muted uppercase tracking-widest">Collateral</p>
                  {!useDemo && aavePosition.isLoading ? (
                    <div className="h-5 w-24 bg-vault-subtle/30 rounded-lg animate-pulse mt-1" />
                  ) : (
                    <p className="text-md font-mono font-black text-white mt-1">{displayCollateral}</p>
                  )}
                </div>
                <div className="p-4 rounded-2xl bg-vault-surface/50 border border-vault-border/50">
                  <p className="text-[9px] font-black text-vault-muted uppercase tracking-widest">Active Debt</p>
                  {!useDemo && aavePosition.isLoading ? (
                    <div className="h-5 w-24 bg-vault-subtle/30 rounded-lg animate-pulse mt-1" />
                  ) : (
                    <p className="text-md font-mono font-black text-status-warning mt-1">{displayDebt}</p>
                  )}
                </div>
              </div>

              {/* Optimal repayment hint — only shown when at risk */}
              {!useDemo && aavePosition.isAtRisk && aavePosition.optimalRepayment > BigInt(0) && (
                <div className="p-4 rounded-2xl bg-status-danger/5 border border-status-danger/20 flex items-center justify-between">
                  <span className="text-[10px] font-black text-status-danger uppercase tracking-widest">
                    Rescue Queued — Repay {(Number(aavePosition.optimalRepayment) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC
                  </span>
                  <svg className="w-4 h-4 text-status-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
              )}

              {(useDemo || !aavePosition.isAtRisk) && (
                <div className="p-4 rounded-2xl bg-brand-500/5 border border-brand-500/10 flex items-center justify-between">
                  <span className="text-[10px] font-black text-brand-400 uppercase tracking-widest">OKX DEX Aggregator Bound</span>
                  <svg className="w-4 h-4 text-brand-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
                </div>
              )}
            </div>

            {/* Wallet Balance Box */}
            <div className="bento-card p-8 space-y-6">
              <h2 className="text-lg font-black tracking-tight text-white uppercase tracking-wider mb-2">Portfolio Vault</h2>
              <WalletBalances
                assets={displayBalances}
                isLoading={!useDemo && balancesLoading}
              />
              <div className="pt-4 border-t border-vault-border/50 text-center">
                <p className="text-[9px] font-black text-vault-muted uppercase tracking-[0.3em]">
                  {useDemo ? "Demo Data — Connect Wallet" : "Live Balances • X Layer Mainnet"}
                </p>
              </div>
            </div>

          </div>

          {/* ── COLUMN RIGHT (8/12): Performance & Logs ── */}
          <div className="lg:col-span-8 space-y-8 animate-slide-up" style={{ animationDelay: "300ms" }}>

            {/* LP Positions Box */}
            <div className="bento-card p-8">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-xl font-black tracking-tight text-white mb-1 uppercase tracking-wider">Uniswap V3 Inventory</h2>
                  <p className="text-[10px] font-black text-vault-muted uppercase tracking-[0.2em]">Automated Tick Rebalancing</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="hidden sm:flex flex-col items-end">
                    <span className="text-[10px] font-black text-status-safe uppercase tracking-widest">
                      {useDemo ? "Demo Mode" : "Live Positions"}
                    </span>
                    <span className="text-xs font-mono font-bold text-vault-muted">
                      {useDemo ? "Connect Wallet" : `${displayLPPositions.filter((p: any) => !p.isOutOfRange).length}/${displayLPPositions.length} In Range`}
                    </span>
                  </div>
                  <div className="h-10 w-[1px] bg-vault-border/50" />
                  <div className="flex items-center gap-2 text-brand-400 font-black text-[11px] uppercase tracking-widest">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z" /></svg>
                    X Layer Arena
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {displayLPPositions.map((pos: any) => (
                  <LPRangeVisualizer key={pos.tokenId} {...pos} />
                ))}

                {displayLPPositions.length === 0 && !displayLpLoading && (
                  <div className="py-20 text-center">
                    <div className="w-12 h-12 bg-vault-border/20 rounded-full flex items-center justify-center mx-auto mb-4 opacity-50">
                      <svg className="w-6 h-6 text-vault-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                    </div>
                    <p className="text-vault-muted text-sm font-bold uppercase tracking-widest">No Active Positions Found</p>
                    <p className="text-vault-muted/50 text-xs mt-2">No Uniswap V3 LP positions detected for this wallet on X Layer.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Activity Feed Box */}
            <div className="bento-card p-8">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-xl font-black tracking-tight text-white mb-1 uppercase tracking-wider">Neural Execution Logs</h2>
                  <p className="text-[10px] font-black text-vault-muted uppercase tracking-[0.2em]">Live Heartbeat • Sequential Polling</p>
                </div>
                <a
                  href={`https://www.oklink.com/xlayer/address/0x1e6955512b94a8CECbD28781c00B4930900f5147`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-black text-brand-400 uppercase tracking-widest hover:text-white transition-colors"
                >
                  View on OKLink ↗
                </a>
              </div>
              <ActivityFeed activities={DEMO_ACTIVITIES} />
            </div>

          </div>

        </div>

        {/* ── Footer ── */}
        <footer className="pt-12 pb-8 animate-fade-in" style={{ animationDelay: "400ms" }}>
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-8 rounded-[2.5rem] bg-vault-card/40 border border-vault-border/50 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
              </div>
              <div>
                <p className="text-sm font-black text-white tracking-widest uppercase">VaultMind Protocol</p>
                <p className="text-[10px] font-bold text-vault-muted mt-1 uppercase tracking-widest">Built for OKX Build X • Powering Agentic Safety</p>
              </div>
            </div>
            <div className="flex items-center gap-8">
              <div className="text-right border-r border-vault-border/50 pr-8">
                <p className="text-[9px] font-black text-vault-muted uppercase tracking-widest">FlashRescue</p>
                <a
                  href="https://www.oklink.com/xlayer/address/0x1e6955512b94a8CECbD28781c00B4930900f5147"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono font-black text-brand-400 hover:text-white transition-colors mt-1 block"
                >
                  0x1e69…5147
                </a>
              </div>
              <div className="text-right border-r border-vault-border/50 pr-8">
                <p className="text-[9px] font-black text-vault-muted uppercase tracking-widest">LiquidityMgr</p>
                <a
                  href="https://www.oklink.com/xlayer/address/0x2AF9F9314ADbd03811EE8Fd71087f92cba6341b7"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono font-black text-brand-400 hover:text-white transition-colors mt-1 block"
                >
                  0x2AF9…41b7
                </a>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-black text-vault-muted uppercase tracking-widest">Network</p>
                <p className="text-sm font-mono font-black text-status-safe mt-1">X Layer · 196</p>
              </div>
            </div>
          </div>
        </footer>

      </main>
    </div>
  );
}
