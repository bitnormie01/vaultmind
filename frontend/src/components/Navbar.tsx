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
    <nav className="nav-bar">
      <div className="max-w-[1440px] mx-auto px-6 h-14 flex items-center justify-between">

        {/* ── Logo ── */}
        <div className="flex items-center gap-3 cursor-pointer select-none">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <span className="text-[15px] font-semibold text-white tracking-tight">
            Vault<span className="text-cyan-400">Mind</span>
          </span>
        </div>

        {/* ── Center nav ── */}
        <div className="hidden lg:flex items-center gap-1 p-0.5 rounded-md bg-base-elevated border border-base-border">
          {["Dashboard", "Positions", "Safety Engine", "Settings"].map((item) => (
            <button
              key={item}
              className={`px-3 py-1.5 text-[12px] font-medium transition-all duration-200 rounded-[5px] ${
                item === "Dashboard"
                  ? "bg-cyan-400/10 text-cyan-400 border border-cyan-400/20"
                  : "text-base-muted hover:text-white"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        {/* ── Right section ── */}
        <div className="flex items-center gap-3">

          {/* Network badge */}
          <div className="hidden sm:flex items-center gap-2">
            {!isConnected ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-base-border bg-base-elevated text-[11px] font-medium text-base-muted">
                <span className="w-1.5 h-1.5 rounded-full bg-base-muted"></span>
                X Layer • 196
              </div>
            ) : isCorrectChain ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-safe/20 bg-safe/5 text-safe text-[11px] font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-safe status-dot"></span>
                X Layer Mainnet
              </div>
            ) : (
              <button
                onClick={() => switchChain?.({ chainId: xLayer.id })}
                disabled={isSwitching}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-amber/30 bg-amber/10 text-amber text-[11px] font-medium hover:bg-amber/20 transition-all cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber status-dot"></span>
                {isSwitching ? "Switching..." : "Switch to X Layer"}
              </button>
            )}
          </div>

          {/* Wallet interaction */}
          {isConnected ? (
            <div className="flex items-center gap-2">
              <button
                onClick={copyAddress}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-base-border bg-base-elevated hover:border-cyan-400/30 transition-all duration-200"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-safe status-dot"></span>
                <span className="text-[12px] font-mono font-medium text-white">{shortAddress}</span>
                {copied && (
                  <svg className="w-3 h-3 text-safe" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <button
                onClick={disconnect}
                className="w-8 h-8 flex items-center justify-center rounded-md border border-base-border bg-base-elevated hover:border-danger/30 hover:text-danger text-base-muted transition-all duration-200"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              onClick={connect}
              disabled={isConnecting}
              className="flex items-center gap-2 px-4 py-1.5 rounded-md bg-cyan-400/10 border border-cyan-400/20 text-cyan-400 text-[12px] font-semibold hover:bg-cyan-400/20 disabled:opacity-60 transition-all duration-200"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              {isConnecting ? "Connecting..." : "Connect OKX Wallet"}
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
