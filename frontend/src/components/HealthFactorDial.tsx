"use client";

import React, { useEffect, useRef, useState } from "react";

interface HealthFactorDialProps {
  value: number;
  isLoading?: boolean;
}

function getStatus(hf: number): {
  color: string;
  label: string;
  textClass: string;
} {
  if (hf >= 2.0)  return { color: "#22c55e", label: "SAFE",     textClass: "text-safe" };
  if (hf >= 1.5)  return { color: "#00d4ff", label: "SECURE",   textClass: "text-cyan-400" };
  if (hf >= 1.1)  return { color: "#f59e0b", label: "CAUTION",  textClass: "text-amber" };
  return            { color: "#ef4444", label: "CRITICAL", textClass: "text-danger" };
}

export function HealthFactorDial({ value, isLoading = false }: HealthFactorDialProps) {
  const [animated, setAnimated] = useState(0);
  const animRef = useRef<number>(null);

  useEffect(() => {
    if (isLoading) return;
    let start: number | null = null;
    const duration = 1200;

    const step = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimated(eased * value);
      if (progress < 1) animRef.current = requestAnimationFrame(step);
    };

    animRef.current = requestAnimationFrame(step);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [value, isLoading]);

  const status = getStatus(animated);

  // Arc geometry
  const MIN_HF = 0;
  const MAX_HF = 5;
  const MAX_ANGLE = 240;
  const clampedHF = Math.max(MIN_HF, Math.min(animated, MAX_HF));
  const angleFraction = clampedHF / MAX_HF;
  const needleAngle = angleFraction * MAX_ANGLE;

  const r = 80;
  const cx = 100;
  const cy = 105;
  const startAngleDeg = -210;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  function arcPath(fromAngle: number, toAngle: number): string {
    const sa = toRad(startAngleDeg + fromAngle);
    const ea = toRad(startAngleDeg + toAngle);
    const x1 = cx + r * Math.cos(sa);
    const y1 = cy + r * Math.sin(sa);
    const x2 = cx + r * Math.cos(ea);
    const y2 = cy + r * Math.sin(ea);
    const largeArc = (toAngle - fromAngle) > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
  }

  // Zone angles (proportional to HF values)
  const hfToAngle = (hf: number) => (Math.min(hf, MAX_HF) / MAX_HF) * MAX_ANGLE;

  const zones = [
    { from: 0,            to: hfToAngle(1.1), color: "#ef4444", opacity: 0.6 },   // Red: liquidation
    { from: hfToAngle(1.1), to: hfToAngle(1.5), color: "#f59e0b", opacity: 0.5 }, // Amber: danger
    { from: hfToAngle(1.5), to: MAX_ANGLE,       color: "#22c55e", opacity: 0.3 }, // Green: safe
  ];

  // Liquidation threshold marker at HF = 1.0
  const liqAngle = hfToAngle(1.0);
  const liqRad = toRad(startAngleDeg + liqAngle);
  const liqX1 = cx + (r - 12) * Math.cos(liqRad);
  const liqY1 = cy + (r - 12) * Math.sin(liqRad);
  const liqX2 = cx + (r + 6) * Math.cos(liqRad);
  const liqY2 = cy + (r + 6) * Math.sin(liqRad);

  // Needle endpoint
  const needleRad = toRad(startAngleDeg + needleAngle);
  const needleX = cx + (r - 20) * Math.cos(needleRad);
  const needleY = cy + (r - 20) * Math.sin(needleRad);

  return (
    <div className="relative flex flex-col items-center">
      <div className="relative w-56 h-48">
        <svg viewBox="0 0 200 170" className="w-full h-full">
          {/* Background track */}
          <path
            d={arcPath(0, MAX_ANGLE)}
            fill="none"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="10"
            strokeLinecap="round"
          />

          {/* Colored zone arcs */}
          {zones.map((zone, i) => (
            <path
              key={i}
              d={arcPath(zone.from, zone.to)}
              fill="none"
              stroke={zone.color}
              strokeWidth="10"
              strokeLinecap={i === 0 ? "round" : "butt"}
              opacity={zone.opacity}
            />
          ))}

          {/* Active value arc */}
          {!isLoading && needleAngle > 0.5 && (
            <path
              d={arcPath(0, Math.max(0.5, needleAngle))}
              fill="none"
              stroke={status.color}
              strokeWidth="10"
              strokeLinecap="round"
              opacity={0.9}
            />
          )}

          {/* Liquidation threshold marker */}
          <line
            x1={liqX1} y1={liqY1}
            x2={liqX2} y2={liqY2}
            stroke="#ef4444"
            strokeWidth="2"
            opacity={0.7}
          />
          <text
            x={cx + (r + 14) * Math.cos(liqRad)}
            y={cy + (r + 14) * Math.sin(liqRad)}
            fill="#ef4444"
            fontSize="7"
            fontWeight="600"
            textAnchor="middle"
            opacity={0.6}
            className="font-mono"
          >
            LIQ
          </text>

          {/* Scale ticks */}
          {[0, 1, 2, 3, 4, 5].map((hf) => {
            const a = toRad(startAngleDeg + hfToAngle(hf));
            const tickR = r + 4;
            const labelR = r + 14;
            return (
              <g key={hf}>
                <circle
                  cx={cx + tickR * Math.cos(a)}
                  cy={cy + tickR * Math.sin(a)}
                  r="1.5"
                  fill="rgba(255,255,255,0.15)"
                />
                <text
                  x={cx + labelR * Math.cos(a)}
                  y={cy + labelR * Math.sin(a)}
                  fill="rgba(255,255,255,0.25)"
                  fontSize="7"
                  fontWeight="500"
                  textAnchor="middle"
                  alignmentBaseline="middle"
                  className="font-mono"
                >
                  {hf}
                </text>
              </g>
            );
          })}

          {/* Needle */}
          {!isLoading && (
            <>
              <line
                x1={cx} y1={cy}
                x2={needleX} y2={needleY}
                stroke={status.color}
                strokeWidth="2"
                strokeLinecap="round"
                opacity={0.9}
              />
              <circle cx={cx} cy={cy} r="4" fill={status.color} opacity={0.8} />
              <circle cx={cx} cy={cy} r="2" fill="white" />
            </>
          )}
        </svg>

        {/* Center display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-6">
          {isLoading ? (
            <div className="space-y-2 text-center">
              <div className="h-8 w-20 bg-base-subtle rounded animate-pulse mx-auto"></div>
              <div className="h-3 w-14 bg-base-subtle rounded animate-pulse mx-auto"></div>
            </div>
          ) : (
            <>
              <span className={`text-3xl font-semibold data-value ${status.textClass}`}>
                {animated.toFixed(2)}
              </span>
              <span className={`text-[10px] font-medium tracking-wider mt-1 ${status.textClass} opacity-70`}>
                {status.label}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Status bar below */}
      {!isLoading && (
        <div className={`mt-2 flex items-center gap-2 px-3 py-1.5 rounded-md border ${
          value < 1.1 ? "border-danger/20 bg-danger/5 text-danger" :
          value < 1.5 ? "border-amber/20 bg-amber/5 text-amber" :
          "border-safe/20 bg-safe/5 text-safe"
        }`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current status-dot"></span>
          <span className="text-[11px] font-medium">
            {value < 1.1 ? "Rescue Triggered" :
             value < 1.5 ? "Monitoring Active" :
             "Nominal"}
          </span>
        </div>
      )}
    </div>
  );
}
