/**
 * Next.js API route — proxies to the agent-node status API.
 *
 * Avoids CORS issues by proxying from the Next.js server itself.
 * Falls back to demo data when the agent-node is not running.
 */

import { NextResponse } from "next/server";

const AGENT_API_BASE = process.env.AGENT_API_URL || "http://localhost:4000";
const TIMEOUT_MS = 2000;

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    return res;
  } finally {
    clearTimeout(id);
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const upstreamPath = "/" + (path?.join("/") ?? "");

  try {
    const upstream = await fetchWithTimeout(`${AGENT_API_BASE}${upstreamPath}`);
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    // Agent not running — return a graceful offline response
    if (upstreamPath.includes("activities")) {
      return NextResponse.json({
        activities: [],
        offline: true,
      });
    }
    return NextResponse.json({
      isRunning: false,
      lastPollTimestamp: 0,
      consecutiveErrors: 0,
      totalRescues: 0,
      totalRebalances: 0,
      totalRpcCalls: 0,
      droppedBySimulation: 0,
      uptime: 0,
      offline: true,
    });
  }
}
