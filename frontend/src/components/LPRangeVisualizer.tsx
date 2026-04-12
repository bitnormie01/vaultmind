"use client";

import React from "react";

interface LPRangeVisualizerProps {
  tokenId: string;
  token0Symbol: string;
  token1Symbol: string;
  currentPrice: number;
  lowerPrice: number;
  upperPrice: number;
  currentTick: number;
  tickLower: number;
  tickUpper: number;
  liquidity: string;
  feeTier: number;  // in bps e.g. 3000 = 0.3%
  isLoading?: boolean;
}

export function LPRangeVisualizer({
  tokenId,
  token0Symbol,
  token1Symbol,
  currentPrice,
  lowerPrice,
  upperPrice,
  currentTick,
  tickLower,
  tickUpper,
  liquidity,
  feeTier,
  isLoading = false,
}: LPRangeVisualizerProps) {
  const isInRange = currentTick >= tickLower && currentTick < tickUpper;
  const feeDisplay = `${(feeTier / 10000).toFixed(2)}%`;

  // Map prices to bar positions
  const extend = (upperPrice - lowerPrice) * 0.4;
  const vizMin = lowerPrice - extend;
  const vizMax = upperPrice + extend;
  const vizRange = vizMax - vizMin;

  const toPercent = (price: number) =>
    Math.max(0, Math.min(100, ((price - vizMin) / vizRange) * 100));

  const lowerPct  = toPercent(lowerPrice);
  const upperPct  = toPercent(upperPrice);
  const currentPct = toPercent(currentPrice);
  const rangePct  = upperPct - lowerPct;

  const statusColor = isInRange ? "var(--color-status-safe)" : "var(--color-status-warning)";
  const statusLabel = isInRange ? "In Range" : "Rebalance Required";

  if (isLoading) {
    return (
      <div className="bento-card p-5 space-y-4 animate-pulse">
        <div className="h-4 w-32 bg-vault-border rounded-full" />
        <div className="h-12 w-full bg-vault-border rounded-2xl" />
        <div className="flex justify-between">
          <div className="h-3 w-20 bg-vault-border rounded-full" />
          <div className="h-3 w-20 bg-vault-border rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="bento-card p-5 group">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            <div className="w-10 h-10 rounded-2xl bg-brand-600 border-4 border-vault-card flex items-center justify-center text-[10px] font-black text-white shadow-xl">
              {token0Symbol.slice(0, 1)}
            </div>
            <div className="w-10 h-10 rounded-2xl bg-status-safe/20 border-4 border-vault-card flex items-center justify-center text-[10px] font-black text-status-safe shadow-xl">
              {token1Symbol.slice(0, 1)}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              {token0Symbol} / {token1Symbol}
              <span className="text-[10px] font-black text-vault-muted/50 px-2 py-0.5 rounded-md border border-vault-border/50 uppercase tracking-widest">
                {feeDisplay}
              </span>
            </h4>
            <p className="text-[10px] font-bold text-vault-muted uppercase tracking-widest mt-1">ID: {tokenId} • LP Position</p>
          </div>
        </div>

        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border bg-opacity-10 ${
            isInRange ? "border-status-safe/20 bg-status-safe text-status-safe" : "border-status-warning/20 bg-status-warning text-status-warning"
        }`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current status-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest leading-none">
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Range Bar */}
      <div className="space-y-4">
        <div className="relative h-14 rounded-2xl bg-vault-bg/50 border border-vault-border/50 overflow-hidden shadow-inner">
          {/* Active range highlight */}
          <div
            className="absolute top-0 bottom-0 transition-all duration-1000 cubic-bezier(0.16, 1, 0.3, 1)"
            style={{
              left: `${lowerPct}%`,
              width: `${rangePct}%`,
              background: isInRange
                ? "linear-gradient(90deg, transparent, rgba(16,185,129,0.1), transparent)"
                : "linear-gradient(90deg, transparent, rgba(245,158,11,0.1), transparent)",
              borderLeft: `1px solid ${statusColor}44`,
              borderRight: `1px solid ${statusColor}44`,
            }}
          />

          {/* Markers */}
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center h-full px-0">
             <div className="relative w-full h-1 bg-vault-border/30 rounded-full" />
          </div>

          {[lowerPct, upperPct].map((pct, i) => (
            <div
              key={i}
              className="absolute top-2 bottom-2 w-1 rounded-full transform -translate-x-1/2"
              style={{
                left: `${pct}%`,
                background: statusColor,
                boxShadow: `0 0 12px ${statusColor}`,
              }}
            />
          ))}

          {/* Current price marker */}
          <div
            className="absolute top-0 bottom-0 flex flex-col items-center justify-center transition-all duration-700"
            style={{ left: `${currentPct}%`, transform: "translateX(-50%)" }}
          >
            <div className="h-full w-0.5 bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)]" />
            <div className="absolute top-[-4px] w-2 h-2 rounded-full bg-white shadow-[0_0_10px_white]" />
            <div className="absolute bottom-[-4px] w-2 h-2 rounded-full bg-white shadow-[0_0_10px_white]" />
          </div>
        </div>

        {/* Labels Grid */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-left">
            <p className="text-[9px] font-black text-vault-muted uppercase tracking-[0.2em]">Lower Bound</p>
            <p className="text-xs font-mono font-bold text-white mt-1.5">{lowerPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="text-center bg-vault-surface/40 rounded-2xl p-2 border border-vault-border/30">
            <p className="text-[9px] font-black text-brand-400 uppercase tracking-[0.2em]">Current Price</p>
            <p className="text-sm font-mono font-black text-white mt-1 transform group-hover:scale-105 transition-transform">{currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-black text-vault-muted uppercase tracking-[0.2em]">Upper Bound</p>
            <p className="text-xs font-mono font-bold text-white mt-1.5">{upperPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        </div>
      </div>

      {/* Info bar */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-vault-border/50">
        <div className="flex items-center gap-1.5 grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all">
            <span className="text-[9px] font-bold text-vault-muted tracking-widest uppercase">Uniswap V3 Pooled Liquidity</span>
            <span className="text-xs font-mono font-bold text-white">{Number(liquidity).toLocaleString()}</span>
        </div>
        {!isInRange && (
            <div className="flex items-center gap-2 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-status-warning" />
                <span className="text-[9px] font-black text-status-warning uppercase tracking-widest">Automation Queued</span>
            </div>
        )}
      </div>
    </div>
  );
}
