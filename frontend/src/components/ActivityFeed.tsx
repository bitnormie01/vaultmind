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
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    label: "Safety Rescue",
  },
  LP_REBALANCE: {
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
    label: "LP Shift",
  },
  SIMULATION_DROPPED: {
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    ),
    label: "Fail-Closed Check",
  },
  MONITORING: {
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
    label: "Polling Registry",
  },
};

const STATUS_STYLES: Record<Status, { bg: string; text: string; dot: string; border: string }> = {
  success: { bg: "bg-status-safe/5",    text: "text-status-safe",    dot: "bg-status-safe",    border: "border-status-safe/20" },
  pending: { bg: "bg-brand-500/5",      text: "text-brand-400",      dot: "bg-brand-400",      border: "border-brand-500/20" },
  dropped: { bg: "bg-status-danger/5",  text: "text-status-danger",  dot: "bg-status-danger",  border: "border-status-danger/20" },
  info:    { bg: "bg-vault-surface/40",  text: "text-vault-muted",    dot: "bg-vault-muted",    border: "border-vault-border/50" },
};

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60)   return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h`;
}

export function ActivityFeed({ activities, isLoading }: ActivityFeedProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex gap-4 p-4 rounded-2xl bg-vault-card/40 border border-vault-border animate-pulse">
            <div className="w-9 h-9 rounded-xl bg-vault-subtle/30 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-32 bg-vault-subtle/30 rounded-full" />
              <div className="h-2 w-full bg-vault-subtle/30 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-[2rem] bg-vault-card/40 border border-vault-border flex items-center justify-center mb-4 shadow-inner">
          <svg className="w-6 h-6 text-vault-muted/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-sm font-bold text-vault-muted">No Sequence Logs</p>
        <p className="text-[10px] font-bold text-vault-muted/40 uppercase tracking-widest mt-2 px-10">Waiting for agent to commit next on-chain heartbeat</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {activities.map((activity) => {
        const meta = TYPE_META[activity.type];
        const style = STATUS_STYLES[activity.status];

        return (
          <div
            key={activity.id}
            className={`group flex gap-4 p-4 rounded-[1.25rem] border ${style.border} ${style.bg} hover:bg-opacity-10 transition-all duration-300 transform hover:scale-[1.01]`}
          >
            {/* Left Status Bar */}
            <div className="w-1 flex flex-col items-center gap-1">
                <div className={`w-1 h-3 rounded-full ${style.dot} opacity-50`} />
                <div className="flex-1 w-[2px] bg-vault-border/50 rounded-full" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                         <div className={`p-1.5 rounded-lg border ${style.border} ${style.text} bg-vault-surface shadow-sm`}>
                             {meta.icon}
                         </div>
                         <span className={`text-[11px] font-black uppercase tracking-widest ${style.text}`}>{meta.label}</span>
                    </div>
                    <span className="text-[10px] font-bold font-mono text-vault-muted bg-vault-card px-2 py-0.5 rounded-md border border-vault-border/50">{timeAgo(activity.timestamp)} ago</span>
                </div>
                
                <p className="text-sm font-bold text-white/90 mt-3 tracking-tight">{activity.description}</p>
                
                {activity.detail && (
                    <p className="text-[11px] font-medium text-vault-muted mt-2 leading-relaxed opacity-80">{activity.detail}</p>
                )}

                {(activity.txHash || activity.status === 'success') && (
                    <div className="flex items-center gap-3 mt-4 pt-3 border-t border-vault-border/30">
                        {activity.txHash && (
                            <a
                                href={`https://www.oklink.com/xlayer/tx/${activity.txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 text-[10px] font-black text-brand-400 hover:text-white uppercase tracking-widest bg-brand-500/5 px-2 py-1 rounded-lg border border-brand-500/10 transition-all"
                            >
                                Explorer
                                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                            </a>
                        )}
                        <span className="text-[9px] font-black text-vault-muted/40 uppercase tracking-widest ml-auto">Verified via OKX OnchainOS Gateway</span>
                    </div>
                )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
