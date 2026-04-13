"use client";

import React from "react";

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  change?: { value: string; positive: boolean };
  icon?: React.ReactNode;
  accent?: "cyan" | "safe" | "amber";
  isLoading?: boolean;
}

const accentMap: Record<string, { border: string; text: string; glow: string }> = {
  cyan:  { border: "border-l-cyan-400", text: "text-cyan-400", glow: "bg-cyan-400" },
  safe:  { border: "border-l-safe",     text: "text-safe",     glow: "bg-safe" },
  amber: { border: "border-l-amber",    text: "text-amber",    glow: "bg-amber" },
};

export function StatCard({ label, value, sub, change, icon, accent = "cyan", isLoading }: StatCardProps) {
  const style = accentMap[accent];

  if (isLoading) {
    return (
      <div className="metric-card p-5 border-l-2 border-l-base-subtle animate-pulse">
        <div className="h-3 w-20 bg-base-subtle rounded mb-4"></div>
        <div className="h-8 w-28 bg-base-subtle rounded"></div>
      </div>
    );
  }

  return (
    <div className={`metric-card p-5 border-l-2 ${style.border}`}>
      {/* Label */}
      <div className="flex items-center justify-between mb-1">
        <span className="data-label">{label}</span>
        {icon && (
          <div className={`${style.text} opacity-40`}>
            {icon}
          </div>
        )}
      </div>

      {/* Value */}
      <div className="mt-2">
        <span className={`text-2xl font-semibold data-value ${style.text}`}>
          {value}
        </span>
      </div>

      {/* Sub + Change */}
      <div className="flex items-center justify-between mt-3">
        {sub && (
          <span className="text-[10px] font-medium text-base-muted">{sub}</span>
        )}
        {change && (
          <span className={`text-[10px] font-medium data-value ${
            change.positive ? "text-safe" : "text-danger"
          }`}>
            {change.positive ? "↑" : "↓"} {change.value}
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Asset Balance Card ────────────────────────────────────── */

interface AssetBalance {
  symbol: string;
  name: string;
  balance: string;
  usdValue: string;
  color: string;
}

interface WalletBalancesProps {
  assets: AssetBalance[];
  isLoading?: boolean;
}

export function WalletBalances({ assets, isLoading }: WalletBalancesProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2].map(i => (
          <div key={i} className="flex items-center justify-between p-3 rounded-md bg-base-elevated border border-base-border animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-base-subtle"></div>
              <div className="space-y-1.5">
                <div className="h-3 w-12 bg-base-subtle rounded"></div>
                <div className="h-2 w-20 bg-base-subtle rounded"></div>
              </div>
            </div>
            <div className="h-3 w-16 bg-base-subtle rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {assets.map((asset) => (
        <div
          key={asset.symbol}
          className="flex items-center justify-between p-3 rounded-md bg-base-elevated/50 border border-base-border hover:border-base-border-2 transition-all duration-200"
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center text-[10px] font-bold text-white"
              style={{ background: asset.color }}
            >
              {asset.symbol.slice(0, 2)}
            </div>
            <div>
              <p className="text-[13px] font-medium text-white">{asset.symbol}</p>
              <p className="text-[10px] text-base-muted">{asset.name}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[13px] font-medium data-value text-white">{asset.balance}</p>
            <p className="text-[10px] text-base-muted">${asset.usdValue}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
