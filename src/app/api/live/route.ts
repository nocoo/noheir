import { NextResponse } from "next/server";
import { APP_NAME, APP_VERSION } from "@/lib/version";

/**
 * GET /api/live — Liveness health check.
 *
 * No auth required. Returns app name, version, and timestamp.
 * Used by monitoring, load balancers, and deployment health checks.
 */
export function GET() {
  return NextResponse.json({
    status: "ok",
    name: APP_NAME,
    version: APP_VERSION,
    timestamp: Date.now(),
  });
}
