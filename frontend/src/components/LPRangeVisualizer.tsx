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
  feeTier: number;
  isLoading?: boolean;
  isOutOfRange?: boolean;
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
  isOutOfRange: isOutOfRangeProp,
}: LPRangeVisualizerProps) {
  const isInRange = isOutOfRangeProp !== undefined
    ? !isOutOfRangeProp
    : (currentTick >= tickLower && currentTick < tickUpper);
  const feeDisplay = `${(feeTier / 10000).toFixed(2)}%`;

  // Range bar positions
  const extend = (upperPrice - lowerPrice) * 0.5;
  const vizMin = lowerPrice - extend;
  const vizMax = upperPrice + extend;
  const vizRange = vizMax - vizMin;

  const toPercent = (price: number) =>
    Math.max(0, Math.min(100, ((price - vizMin) / vizRange) * 100));

  const lowerPct = toPercent(lowerPrice);
  const upperPct = toPercent(upperPrice);
  const currentPct = toPercent(currentPrice);
  const rangePct = upperPct - lowerPct;

  if (isLoading) {
    return (
      <div className="panel p-4 space-y-3 animate-pulse">
        <div className="h-4 w-28 bg-base-subtle rounded"></div>
        <div className="h-10 w-full bg-base-subtle rounded"></div>
        <div className="flex justify-between">
          <div className="h-3 w-16 bg-base-subtle rounded"></div>
          <div className="h-3 w-16 bg-base-subtle rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          {/* Token pair icons */}
          <div className="flex -space-x-1.5">
            <div className="w-7 h-7 rounded-md bg-cyan-600 border-2 border-base-bg flex items-center justify-center text-[9px] font-bold text-white">
              {token0Symbol.slice(0, 2)}
            </div>
            <div className="w-7 h-7 rounded-md bg-safe/20 border-2 border-base-bg flex items-center justify-center text-[9px] font-bold text-safe">
              {token1Symbol.slice(0, 1)}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-medium text-white">
                {token0Symbol}/{token1Symbol}
              </span>
              <span className="text-[10px] font-medium text-base-muted px-1.5 py-0.5 rounded border border-base-border bg-base-elevated">
                {feeDisplay}
              </span>
            </div>
            <span className="text-[10px] text-base-muted">#{tokenId}</span>
          </div>
        </div>

        {/* Status badge */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10px] font-medium ${
          isInRange
            ? "border-safe/20 bg-safe/5 text-safe"
            : "border-amber/20 bg-amber/5 text-amber"
        }`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current status-dot"></span>
          {isInRange ? "In Range" : "Out of Range"}
        </div>
      </div>

      {/* Range visualization — horizontal track */}
      <div className="relative h-10 rounded-md bg-base-bg border border-base-border overflow-hidden">
        {/* Position range zone */}
        <div
          className="absolute top-0 bottom-0 transition-all duration-700"
          style={{
            left: `${lowerPct}%`,
            width: `${rangePct}%`,
            background: isInRange
              ? "linear-gradient(90deg, rgba(34,197,94,0.08), rgba(34,197,94,0.15), rgba(34,197,94,0.08))"
              : "linear-gradient(90deg, rgba(245,158,11,0.08), rgba(245,158,11,0.15), rgba(245,158,11,0.08))",
          }}
        />

        {/* Range boundaries */}
        {[lowerPct, upperPct].map((pct, i) => (
          <div
            key={i}
            className="absolute top-1 bottom-1 w-[2px] -translate-x-1/2"
            style={{
              left: `${pct}%`,
              background: isInRange ? "rgba(34,197,94,0.5)" : "rgba(245,158,11,0.5)",
            }}
          />
        ))}

        {/* Current price dot */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-500"
          style={{ left: `${currentPct}%` }}
        >
          <div className="w-3 h-3 rounded-full bg-white border-2 border-base-bg shadow-[0_0_8px_rgba(255,255,255,0.4)]" />
        </div>
      </div>

      {/* Three-column price labels */}
      <div className="grid grid-cols-3 gap-3 mt-3">
        <div>
          <span className="data-label text-[9px]">Lower Bound</span>
          <p className="text-[13px] font-medium data-value text-white mt-0.5">
            ${lowerPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="text-center px-2 py-1.5 rounded-md bg-base-elevated border border-base-border">
          <span className="data-label text-[9px] text-cyan-400">Current</span>
          <p className="text-[13px] font-semibold data-value text-white mt-0.5">
            ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="text-right">
          <span className="data-label text-[9px]">Upper Bound</span>
          <p className="text-[13px] font-medium data-value text-white mt-0.5">
            ${upperPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Footer info */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-base-border">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-base-muted">Liquidity</span>
          <span className="text-[11px] data-value text-white">{Number(liquidity).toLocaleString()}</span>
        </div>
        {!isInRange && (
          <div className="flex items-center gap-1.5 text-amber">
            <span className="w-1.5 h-1.5 rounded-full bg-amber status-dot"></span>
            <span className="text-[10px] font-medium">Rebalance Queued</span>
          </div>
        )}
      </div>
    </div>
  );
}
