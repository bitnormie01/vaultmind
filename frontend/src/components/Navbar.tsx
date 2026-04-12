"use client";

import React, { useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useSwitchChain } from "wagmi";
import { xLayer } from "@/lib/wagmi";

export function Navbar() {
  const { address, isConnected, isConnecting, connect, disconnect, shortAddress, isCorrectChain } =
    useWallet();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <nav className="glass-nav">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">

        {/* ── Logo ── */}
        <div className="flex items-center gap-4 group cursor-pointer">
          <div className="relative w-10 h-10">
            <div className="absolute inset-0 rounded-xl bg-brand-500/20 blur-md group-hover:bg-brand-500/40 transition-all duration-500" />
            <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-brand-400 via-brand-600 to-brand-800 flex items-center justify-center shadow-lg shadow-brand-950/50 transform group-hover:rotate-12 transition-transform duration-500">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold text-white tracking-tight leading-none">VaultMind</span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-status-safe status-pulse" />
              <span className="text-[10px] uppercase font-bold tracking-widest text-vault-muted">Protocol Active</span>
            </div>
          </div>
        </div>

        {/* ── Center nav ── */}
        <div className="hidden lg:flex items-center gap-2 p-1 rounded-2xl bg-vault-subtle/20 border border-vault-border">
          {["Dashboard", "Positions", "Safety Engine", "Settings"].map((item) => (
            <button
              key={item}
              className={`px-4 py-2 text-sm font-medium transition-all duration-300 rounded-xl ${
                item === "Dashboard" 
                  ? "bg-brand-600 text-white shadow-lg shadow-brand-900/20" 
                  : "text-vault-muted hover:text-white hover:bg-vault-border"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        {/* ── Right section ── */}
        <div className="flex items-center gap-4">

          {/* Network context */}
          <div className="hidden sm:flex items-center gap-2">
            {!isConnected ? (
                <div className="px-3 py-1.5 rounded-full border border-vault-border bg-vault-surface/40 text-[11px] font-medium text-vault-muted">
                    Mainnet • 196
                </div>
            ) : isCorrectChain ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-status-safe/20 bg-status-safe/5 text-status-safe text-[11px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-status-safe status-pulse" />
                    X Layer Mainnet
                </div>
            ) : (
                <button
                    onClick={() => switchChain?.({ chainId: xLayer.id })}
                    disabled={isSwitching}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-status-danger/30 bg-status-danger/10 text-status-danger text-[11px] font-bold hover:bg-status-danger/20 transition-all cursor-pointer"
                >
                    <span className="w-1.5 h-1.5 rounded-full bg-status-danger status-pulse" />
                    {isSwitching ? "Switching..." : "Switch to X Layer"}
                </button>
            )}
          </div>

          {/* Wallet interaction */}
          {isConnected ? (
            <div className="flex items-center gap-2">
              <button
                onClick={copyAddress}
                className="flex items-center gap-3 px-4 py-2.5 rounded-2xl border border-vault-border bg-vault-card/80 hover:border-brand-500/40 hover:bg-vault-card transition-all duration-300 group"
              >
                <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-brand-500 to-status-safe flex-shrink-0 shadow-sm" />
                <span className="text-xs font-mono font-bold text-white tracking-wider">{shortAddress}</span>
                <div className="w-6 h-6 flex items-center justify-center rounded-lg bg-vault-border/50 group-hover:bg-brand-500/10 group-hover:text-brand-400 text-vault-muted transition-colors">
                    {copied ? (
                        <svg className="w-3.5 h-3.5 text-status-safe" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                    ) : (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                    )}
                </div>
              </button>
              <button
                onClick={disconnect}
                className="w-10 h-10 flex items-center justify-center rounded-2xl border border-vault-border bg-vault-card/80 hover:border-status-danger/30 hover:bg-status-danger/5 text-vault-muted hover:text-status-danger transition-all duration-300"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              onClick={connect}
              disabled={isConnecting}
              className="px-6 py-2.5 rounded-2xl bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white text-sm font-bold tracking-tight transition-all duration-300 shadow-xl shadow-brand-900/40 hover:shadow-brand-600/50 hover:-translate-y-0.5"
            >
              {isConnecting ? "Connecting..." : "Launch App"}
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
