/**
 * useAgentStatus — polls the VaultMind agent-node API every 5s.
 *
 * Falls back to demo data gracefully when the agent is offline.
 * Returns both the raw status payload AND a transformed activities array
 * that matches the ActivityFeed component's expected shape.
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ─── Types (mirrors server.ts) ────────────────────────────────────────

export interface AgentStatus {
  isRunning: boolean;
  lastPollTimestamp: number;
  consecutiveErrors: number;
  totalRescues: number;
  totalRebalances: number;
  totalRpcCalls: number;
  droppedBySimulation: number;
  uptime: number;
  offline: boolean;
}

export interface AgentActivity {
  id: string;
  type: "FLASH_RESCUE" | "LP_REBALANCE" | "SIMULATION_DROPPED" | "MONITORING" | "ERROR";
  status: "success" | "pending" | "dropped" | "info" | "error";
  description: string;
  detail?: string;
  txHash?: string;
  timestamp: Date;
}

const DEMO_STATUS: AgentStatus = {
  isRunning: true,
  lastPollTimestamp: Date.now() - 14 * 60 * 1000,
  consecutiveErrors: 0,
  totalRescues: 12,
  totalRebalances: 142,
  totalRpcCalls: 1847,
  droppedBySimulation: 3,
  uptime: 86400 * 3, // 3 days
  offline: true,
};

const DEMO_ACTIVITIES: AgentActivity[] = [
  {
    id: "demo-1",
    type: "FLASH_RESCUE",
    status: "success",
    description: "Emergency Flash Rescue Executed",
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
    txHash: "0x4aee4cbc6f76152f86f1b96e75a3de7103af18c95d3cf86987c671377303f278",
    detail: "Health Factor restored from 1.08 → 1.54 via OKX DEX liquidity routing.",
  },
  {
    id: "demo-2",
    type: "LP_REBALANCE",
    status: "success",
    description: "Concentrated LP Range Optimization",
    timestamp: new Date(Date.now() - 23 * 60 * 1000),
    txHash: "0x9dd370afe26da3ae53c2947534cb173efc634809cd16928884d7201161966ba3",
    detail: "Shifted WOKB/USDC 0.3% ticks to stay within high-volume volatility bands.",
  },
  {
    id: "demo-3",
    type: "SIMULATION_DROPPED",
    status: "dropped",
    description: "Fail-Closed: Slippage Limit Exceeded",
    timestamp: new Date(Date.now() - 42 * 60 * 1000),
    detail: "Pre-execution simulation detected 1.2% slippage (Limit: 0.5%). Transaction aborted.",
  },
  {
    id: "demo-4",
    type: "MONITORING",
    status: "info",
    description: "Continuous Safety Scans Active",
    timestamp: new Date(Date.now() - 60 * 60 * 1000),
    detail: "X Layer Block #12,842,102 verified. All safety oracles reporting sync.",
  },
];

// ─── Hook ─────────────────────────────────────────────────────────────

export function useAgentStatus(pollIntervalMs = 5000) {
  const [status, setStatus] = useState<AgentStatus>(DEMO_STATUS);
  const [activities, setActivities] = useState<AgentActivity[]>(DEMO_ACTIVITIES);
  const [isLive, setIsLive] = useState(false);
  const isMounted = useRef(true);

  const fetchStatus = useCallback(async () => {
    try {
      const [statusRes, activitiesRes] = await Promise.all([
        fetch("/api/agent/status", { cache: "no-store" }),
        fetch("/api/agent/activities?limit=20", { cache: "no-store" }),
      ]);

      const statusData: AgentStatus = await statusRes.json();
      const activitiesData: { activities: any[]; offline?: boolean } = await activitiesRes.json();

      if (!isMounted.current) return;

      if (!statusData.offline) {
        setStatus(statusData);
        setIsLive(true);
      }

      if (!activitiesData.offline && activitiesData.activities.length > 0) {
        const parsed: AgentActivity[] = activitiesData.activities.map((a: any) => ({
          ...a,
          timestamp: new Date(a.timestamp),
        }));
        setActivities(parsed);
      }
    } catch {
      // Keep demo data — agent offline
      if (isMounted.current) {
        setIsLive(false);
      }
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    fetchStatus();
    const interval = setInterval(fetchStatus, pollIntervalMs);
    return () => {
      isMounted.current = false;
      clearInterval(interval);
    };
  }, [fetchStatus, pollIntervalMs]);

  return { status, activities, isLive };
}
