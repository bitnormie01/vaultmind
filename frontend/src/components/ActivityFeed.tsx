"use client";

import React from "react";

type ActionType = "FLASH_RESCUE" | "LP_REBALANCE" | "SIMULATION_DROPPED" | "MONITORING";
type Status = "success" | "pending" | "dropped" | "info";

interface Activity {
  id: string;
  type: ActionType;
  status: Status;
  description: string;
  timestamp: Date;
  txHash?: string;
  detail?: string;
}

interface ActivityFeedProps {
  activities: Activity[];
  isLoading?: boolean;
}

const TYPE_META: Record<ActionType, { icon: React.ReactNode; label: string }> = {
  FLASH_RESCUE: {
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    label: "Flash Rescue",
  },
  LP_REBALANCE: {
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
    label: "LP Rebalance",
  },
  SIMULATION_DROPPED: {
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    label: "Threat Neutralized",
  },
  MONITORING: {
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
    label: "Monitoring",
  },
};

const STATUS_STYLES: Record<Status, { dot: string; text: string; border: string }> = {
  success: { dot: "bg-safe",    text: "text-safe",    border: "border-safe/15" },
  pending: { dot: "bg-cyan-400", text: "text-cyan-400", border: "border-cyan-400/15" },
  dropped: { dot: "bg-amber",   text: "text-amber",   border: "border-amber/15" },
  info:    { dot: "bg-base-muted", text: "text-base-muted", border: "border-base-border" },
};

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60)   return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

export function ActivityFeed({ activities, isLoading }: ActivityFeedProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-3 p-3 rounded-md bg-base-elevated border border-base-border animate-pulse">
            <div className="w-7 h-7 rounded-md bg-base-subtle flex-shrink-0"></div>
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-28 bg-base-subtle rounded"></div>
              <div className="h-2 w-full bg-base-subtle rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-10 h-10 rounded-md bg-base-elevated border border-base-border flex items-center justify-center mb-3">
          <svg className="w-4 h-4 text-base-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-[13px] font-medium text-base-muted">No Activity</p>
        <p className="text-[11px] text-base-muted/60 mt-1">Waiting for next agent heartbeat</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {activities.map((activity) => {
        const meta = TYPE_META[activity.type];
        const style = STATUS_STYLES[activity.status];

        return (
          <div
            key={activity.id}
            className={`flex gap-3 p-3 rounded-md border ${style.border} bg-base-card/50 hover:bg-base-elevated transition-all duration-200`}
          >
            {/* Icon */}
            <div className={`w-7 h-7 rounded-md border border-base-border bg-base-elevated flex items-center justify-center flex-shrink-0 ${style.text}`}>
              {meta.icon}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`}></span>
                  <span className={`text-[11px] font-medium ${style.text}`}>{meta.label}</span>
                </div>
                <span className="text-[10px] data-value text-base-muted">{timeAgo(activity.timestamp)}</span>
              </div>

              <p className="text-[12px] font-medium text-white mt-1.5">{activity.description}</p>

              {activity.detail && (
                <p className="text-[11px] text-base-muted mt-1 leading-relaxed">{activity.detail}</p>
              )}

              {activity.txHash && (
                <div className="mt-2 pt-2 border-t border-base-border/50">
                  <a
                    href={`https://www.oklink.com/xlayer/tx/${activity.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[10px] font-medium text-cyan-400 hover:text-white transition-colors"
                  >
                    View on OKLink
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
