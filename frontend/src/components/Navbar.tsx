"use client";

import React, { useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useSwitchChain } from "wagmi";
import { xLayer } from "@/lib/wagmi";

const NAV_ITEMS = [
  { label: "Dashboard",     href: "#dashboard" },
  { label: "Positions",     href: "#positions"  },
  { label: "Safety Engine", href: "#safety"     },
  { label: "Metrics",       href: "#metrics"    },
];

export function Navbar() {
  const { address, isConnected, isConnecting, connect, disconnect, shortAddress, isCorrectChain, error } =
    useWallet();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const [copied, setCopied] = useState(false);
  const [showError, setShowError] = useState(false);
  const [activeNav, setActiveNav] = useState("Dashboard");

  const copyAddress = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConnect = () => {
    setShowError(false);
    connect();
    // Show error state if nothing happened after 1.5s (no wallet extension)
    setTimeout(() => {
      if (!isConnected) setShowError(true);
    }, 1500);
  };

  const handleNavClick = (label: string, href: string) => {
    setActiveNav(label);
    // Smooth scroll to section anchor
    const el = document.querySelector(href);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <nav className="nav-bar">
      <div className="max-w-[1440px] mx-auto px-6 h-14 flex items-center justify-between">

        {/* ── Logo ── */}
        <a
          href="#dashboard"
          onClick={() => setActiveNav("Dashboard")}
          className="flex items-center gap-3 cursor-pointer select-none hover:opacity-90 transition-opacity"
        >
          <img src="/logo.png" alt="VaultMind Logo" className="w-8 h-8 rounded-md shadow-[0_0_12px_rgba(0,212,255,0.3)]" />
          <span className="text-[15px] font-semibold text-white tracking-tight">
            Vault<span className="text-cyan-400">Mind</span>
          </span>
        </a>

        {/* ── Center nav — anchor-scroll links ── */}
        <div className="hidden lg:flex items-center gap-1 p-0.5 rounded-md bg-base-elevated border border-base-border">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.label}
              onClick={() => handleNavClick(item.label, item.href)}
              className={`px-3 py-1.5 text-[12px] font-medium transition-all duration-200 rounded-[5px] ${
                activeNav === item.label
                  ? "bg-cyan-400/10 text-cyan-400 border border-cyan-400/20"
                  : "text-base-muted hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* ── Right section ── */}
        <div className="flex items-center gap-3">

          {/* Network badge */}
          <div className="hidden sm:flex items-center gap-2">
            {!isConnected ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-base-border bg-base-elevated text-[11px] font-medium text-base-muted">
                <span className="w-1.5 h-1.5 rounded-full bg-base-muted" />
                X Layer • 196
              </div>
            ) : isCorrectChain ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-safe/20 bg-safe/5 text-safe text-[11px] font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-safe status-dot" />
                X Layer Mainnet
              </div>
            ) : (
              <button
                onClick={() => switchChain?.({ chainId: xLayer.id })}
                disabled={isSwitching}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-amber/30 bg-amber/10 text-amber text-[11px] font-medium hover:bg-amber/20 transition-all cursor-pointer disabled:opacity-60"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber status-dot" />
                {isSwitching ? "Switching..." : "Switch to X Layer"}
              </button>
            )}
          </div>

          {/* Wallet interaction */}
          {isConnected ? (
            <div className="flex items-center gap-2">
              <button
                onClick={copyAddress}
                title={address}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-base-border bg-base-elevated hover:border-cyan-400/30 transition-all duration-200"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-safe status-dot" />
                <span className="text-[12px] font-mono font-medium text-white">{shortAddress}</span>
                {copied && (
                  <svg className="w-3 h-3 text-safe" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <button
                onClick={disconnect}
                title="Disconnect wallet"
                className="w-8 h-8 flex items-center justify-center rounded-md border border-base-border bg-base-elevated hover:border-danger/30 hover:text-danger text-base-muted transition-all duration-200"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-end gap-1">
              <button
                id="connect-wallet-btn"
                onClick={handleConnect}
                disabled={isConnecting}
                className="flex items-center gap-2 px-4 py-1.5 rounded-md bg-cyan-400/10 border border-cyan-400/20 text-cyan-400 text-[12px] font-semibold hover:bg-cyan-400/20 disabled:opacity-60 transition-all duration-200"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                {isConnecting ? "Connecting..." : "Connect OKX Wallet"}
              </button>
              {/* No wallet extension error */}
              {(showError || error) && !isConnected && (
                <div className="flex items-center gap-1.5 text-[10px] text-amber animate-fade-in">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>No wallet found —{" "}</span>
                  <a
                    href="https://www.okx.com/web3"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-white transition-colors"
                  >
                    Install OKX Wallet
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
