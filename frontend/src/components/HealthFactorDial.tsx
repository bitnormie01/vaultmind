"use client";

import React, { useEffect, useRef, useState } from "react";

interface HealthFactorDialProps {
  value: number;         // Current health factor (e.g. 1.87)
  isLoading?: boolean;
}

function getStatus(hf: number): {
  color: string;
  glow: string;
  label: string;
  accent: string;
} {
  if (hf >= 2.0)  return { color: "var(--color-status-safe)", glow: "rgba(34,211,160,0.4)", label: "OPTIMAL", accent: "text-status-safe" };
  if (hf >= 1.5)  return { color: "var(--color-brand-400)", glow: "rgba(96,165,250,0.4)", label: "SECURE", accent: "text-brand-400" };
  if (hf >= 1.2)  return { color: "var(--color-status-warning)", glow: "rgba(245,158,11,0.4)", label: "MODERATE", accent: "text-status-warning" };
  return            { color: "var(--color-status-danger)", glow: "rgba(239,68,68,0.5)",   label: "CRITICAL", accent: "text-status-danger" };
}

export function HealthFactorDial({ value, isLoading = false }: HealthFactorDialProps) {
  const [animated, setAnimated] = useState(0);
  const animRef = useRef<number>(null);

  useEffect(() => {
    if (isLoading) return;
    let start: number | null = null;
    const duration = 1500;

    const step = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4); // ease-out quartic
      setAnimated(eased * value);
      if (progress < 1) animRef.current = requestAnimationFrame(step);
    };

    animRef.current = requestAnimationFrame(step);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [value, isLoading]);

  const status = getStatus(animated);

  const MIN_HF = 1;
  const MAX_HF = 4;
  const MAX_ANGLE = 270;
  const clampedHF = Math.max(MIN_HF, Math.min(animated, MAX_HF));
  const angleFraction = (clampedHF - MIN_HF) / (MAX_HF - MIN_HF);
  const angle = angleFraction * MAX_ANGLE;

  const r = 82;
  const cx = 100;
  const cy = 100;
  const startAngle = -225;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  function arcPath(sweepAngle: number): string {
    const sa = toRad(startAngle);
    const ea = toRad(startAngle + sweepAngle);
    const x1 = cx + r * Math.cos(sa);
    const y1 = cy + r * Math.sin(sa);
    const x2 = cx + r * Math.cos(ea);
    const y2 = cy + r * Math.sin(ea);
    const largeArc = sweepAngle > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
  }


  return (
    <div className="relative flex flex-col items-center">
      {/* SVG Dial */}
      <div className="relative w-64 h-64">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          {/* Background track */}
          <path
            d={arcPath(MAX_ANGLE)}
            fill="none"
            stroke="rgba(255,255,255,0.03)"
            strokeWidth="14"
            strokeLinecap="round"
          />

          <defs>
            <filter id="dialGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="dialGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={status.color} stopOpacity="0.8" />
                <stop offset="100%" stopColor={status.color} />
            </linearGradient>
          </defs>

          {/* Active arc */}
          {!isLoading && (
            <path
              d={arcPath(Math.max(1, angle))}
              fill="none"
              stroke="url(#dialGradient)"
              strokeWidth="14"
              strokeLinecap="round"
              filter="url(#dialGlow)"
              className="transition-all duration-500 ease-out"
            />
          )}

          {/* Scale labels in SVG */}
          {[1, 2, 3, 4].map((hf) => {
            const a = toRad(startAngle + ((hf - MIN_HF) / (MAX_HF - MIN_HF)) * MAX_ANGLE);
            const labelR = 64;
            return (
              <text
                key={hf}
                x={cx + labelR * Math.cos(a)}
                y={cy + labelR * Math.sin(a)}
                fill="rgba(255,255,255,0.2)"
                fontSize="8"
                fontWeight="900"
                textAnchor="middle"
                alignmentBaseline="middle"
                className="font-mono"
              >
                {hf.toFixed(1)}
              </text>
            );
          })}
        </svg>

        {/* Center display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
          {isLoading ? (
            <div className="space-y-3 text-center">
              <div className="h-10 w-24 bg-vault-subtle/20 rounded-xl animate-pulse mx-auto" />
              <div className="h-3 w-16 bg-vault-subtle/20 rounded-full animate-pulse mx-auto" />
            </div>
          ) : (
            <>
              <div className="relative group">
                  <div className={`absolute inset-0 blur-2xl opacity-20 ${status.accent} bg-current`} />
                  <span className={`relative text-5xl font-black font-mono tracking-tight tabular-nums ${status.accent}`}>
                    {animated.toFixed(2)}
                  </span>
              </div>
              <div className={`mt-2 px-3 py-1 rounded-full border border-current bg-current bg-opacity-5 ${status.accent}`}>
                  <span className="text-[10px] font-black tracking-[0.2em]">{status.label}</span>
              </div>
              <span className="text-vault-muted/50 text-[10px] font-bold uppercase tracking-widest mt-4">Safety Latency: 40ms</span>
            </>
          )}
        </div>
      </div>

      {/* Warning/Status banner */}
      {!isLoading && (
          <div className={`mt-6 inline-flex items-center gap-2.5 px-4 py-2 rounded-2xl border ${
              value < 1.3 ? "border-status-danger/20 bg-status-danger/5 text-status-danger" : 
              value < 1.6 ? "border-status-warning/20 bg-status-warning/5 text-status-warning" : 
              "border-status-safe/20 bg-status-safe/5 text-status-safe"
          }`}>
            <span className="w-2 h-2 rounded-full bg-current status-pulse" />
            <span className="text-[11px] font-black uppercase tracking-widest leading-none">
                {value < 1.3 ? "Immediate Rescue Triggered" : 
                 value < 1.6 ? "Predictive Monitoring Active" : 
                 "System Nominal • Safe Reserves"}
            </span>
          </div>
      )}
    </div>
  );
}
