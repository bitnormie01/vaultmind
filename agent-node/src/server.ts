/**
 * VaultMind Agent — Status API Server
 *
 * Exposes a lightweight HTTP API alongside the agent loop so the
 * frontend dashboard can poll live agent state in real-time.
 *
 * Endpoints:
 *   GET /api/status     → current agent counters + last-poll timestamp
 *   GET /api/activities → last N agent activity events (FIFO ring buffer)
 *   GET /health         → simple liveness probe
 */

import { createServer, IncomingMessage, ServerResponse } from "http";

// ─── Types ────────────────────────────────────────────────────────────

export interface AgentStatusPayload {
  isRunning: boolean;
  lastPollTimestamp: number;
  consecutiveErrors: number;
  totalRescues: number;
  totalRebalances: number;
  totalRpcCalls: number;
  droppedBySimulation: number;
  uptime: number; // seconds since server start
}

export interface ActivityEvent {
  id: string;
  type: "FLASH_RESCUE" | "LP_REBALANCE" | "SIMULATION_DROPPED" | "MONITORING" | "ERROR";
  status: "success" | "pending" | "dropped" | "info" | "error";
  description: string;
  detail?: string;
  txHash?: string;
  timestamp: number; // Unix ms
}

// ─── Shared State (mutated by VaultMindAgent) ─────────────────────────

let _agentStatus: AgentStatusPayload = {
  isRunning: false,
  lastPollTimestamp: 0,
  consecutiveErrors: 0,
  totalRescues: 0,
  totalRebalances: 0,
  totalRpcCalls: 0,
  droppedBySimulation: 0,
  uptime: 0,
};

const MAX_ACTIVITIES = 50;
const _activityRing: ActivityEvent[] = [];
const _startTime = Date.now();

// ─── Public API — called by VaultMindAgent ───────────────────────────

export function updateAgentStatus(patch: Partial<AgentStatusPayload>): void {
  _agentStatus = {
    ..._agentStatus,
    ...patch,
    uptime: Math.floor((Date.now() - _startTime) / 1000),
  };
}

export function pushActivity(event: Omit<ActivityEvent, "id" | "timestamp">): void {
  const activity: ActivityEvent = {
    ...event,
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
  };
  _activityRing.unshift(activity); // newest first
  if (_activityRing.length > MAX_ACTIVITIES) {
    _activityRing.pop();
  }
}

// ─── HTTP Server ──────────────────────────────────────────────────────

function cors(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function json(res: ServerResponse, statusCode: number, data: unknown): void {
  cors(res);
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

export function startApiServer(port = 4000): void {
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = req.url || "/";
    const method = req.method || "GET";

    // CORS preflight
    if (method === "OPTIONS") {
      cors(res);
      res.writeHead(204);
      res.end();
      return;
    }

    if (url === "/health") {
      json(res, 200, { ok: true, ts: Date.now() });
      return;
    }

    if (url === "/api/status") {
      json(res, 200, {
        ..._agentStatus,
        uptime: Math.floor((Date.now() - _startTime) / 1000),
      });
      return;
    }

    if (url.startsWith("/api/activities")) {
      const limitParam = new URL(url, "http://localhost").searchParams.get("limit");
      const limit = Math.min(parseInt(limitParam || "20", 10), MAX_ACTIVITIES);
      json(res, 200, { activities: _activityRing.slice(0, limit) });
      return;
    }

    json(res, 404, { error: "Not found" });
  });

  server.listen(port, () => {
    console.log(`[VaultMind API] Status server running on http://localhost:${port}`);
  });
}
