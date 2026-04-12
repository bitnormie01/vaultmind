"use client";

import React from "react";

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  change?: { value: string; positive: boolean };
  icon?: React.ReactNode;
  accent?: "brand" | "safe" | "warning" | "danger";
  isLoading?: boolean;
}

const accentStyles: Record<string, { bg: string; text: string; shadow: string }> = {
  brand:   { bg: "bg-brand-500/10",    text: "text-brand-400",    shadow: "shadow-brand-500/10" },
  safe:    { bg: "bg-status-safe/10",   text: "text-status-safe",   shadow: "shadow-status-safe/10" },
  warning: { bg: "bg-status-warning/10", text: "text-status-warning", shadow: "shadow-status-warning/10" },
  danger:  { bg: "bg-status-danger/10",  text: "text-status-danger",  shadow: "shadow-status-danger/10" },
};

export function StatCard({ label, value, sub, change, icon, accent = "brand", isLoading }: StatCardProps) {
  const styles = accentStyles[accent];

  if (isLoading) {
    return (
      <div className="bento-card p-6 min-h-[160px] animate-pulse">
        <div className="h-3 w-24 bg-vault-subtle/30 rounded-full" />
        <div className="h-10 w-32 bg-vault-subtle/30 rounded-xl mt-6" />
        <div className="h-3 w-16 bg-vault-subtle/30 rounded-full mt-4" />
      </div>
    );
  }

  return (
    <div className="bento-card p-6 flex flex-col justify-between group">
      {/* Background Glow */}
      <div className={`absolute -top-12 -right-12 w-24 h-24 rounded-full blur-[40px] opacity-20 transition-all duration-500 group-hover:scale-150 group-hover:opacity-40 ${styles.bg}`} />
      
      <div className="relative">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-vault-muted/80">{label}</span>
          {icon && (
            <div className={`p-2 rounded-xl border border-vault-border/50 bg-vault-surface/50 ${styles.text}`}>
              {icon}
            </div>
          )}
        </div>

        <div className="flex items-baseline gap-2 mt-2">
            <h3 className={`text-4xl font-bold font-mono tracking-tight ${styles.text} tabular-nums`}>
                {value}
            </h3>
        </div>

        {sub && (
          <p className="text-[11px] font-medium text-vault-muted mt-2 flex items-center gap-1.5 leading-relaxed">
            <span className="w-1 h-1 rounded-full bg-vault-muted/40" />
            {sub}
          </p>
        )}
      </div>

      {change && (
        <div className={`mt-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
          change.positive 
            ? "bg-status-safe/10 border-status-safe/20 text-status-safe" 
            : "bg-status-danger/10 border-status-danger/20 text-status-danger"
        }`}>
          <span>{change.positive ? "↑" : "↓"}</span>
          <span className="tracking-wide">{(change.value)}</span>
        </div>
      )}
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
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center justify-between p-4 rounded-3xl bg-vault-card/40 border border-vault-border animate-pulse">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-2xl bg-vault-subtle/30" />
              <div className="space-y-2">
                <div className="h-3 w-16 bg-vault-subtle/30 rounded-full" />
                <div className="h-2 w-24 bg-vault-subtle/30 rounded-full" />
              </div>
            </div>
            <div className="space-y-2 text-right">
              <div className="h-3 w-20 bg-vault-subtle/30 rounded-full ml-auto" />
              <div className="h-2 w-10 bg-vault-subtle/30 rounded-full ml-auto" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-2.5">
      {assets.map((asset) => (
        <div
          key={asset.symbol}
          className="group flex items-center justify-between p-4 rounded-3xl bg-vault-card/40 border border-vault-border hover:border-brand-500/30 hover:bg-vault-card/60 transition-all duration-300"
        >
          <div className="flex items-center gap-4">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-bold text-white shadow-xl transform group-hover:scale-105 group-hover:-rotate-3 transition-all duration-500"
              style={{ 
                background: `linear-gradient(135deg, ${asset.color}, ${asset.color}dd)`,
                boxShadow: `0 8px 16px -4px ${asset.color}44` 
              }}
            >
              {asset.symbol.slice(0, 2)}
            </div>
            <div>
              <p className="text-sm font-bold text-white tracking-tight leading-none">{asset.symbol}</p>
              <p className="text-[10px] font-bold text-vault-muted uppercase tracking-widest mt-1.5 opacity-60">{asset.name}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-mono font-bold text-white">{asset.balance}</p>
            <p className="text-[11px] font-bold text-vault-muted/70 mt-1">${asset.usdValue}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
