import { APP_NAME, APP_VERSION } from "@/lib/version";

export const dynamic = "force-dynamic";

/**
 * GET /api/live — Surety-standard health check.
 *
 * No auth required. Returns status, version, component, timestamp, and uptime.
 * Used by monitoring, load balancers, and deployment health checks.
 *
 * 200 = healthy, 503 = unhealthy. Cache-Control: no-store.
 */
export async function GET() {
  return Response.json(
    {
      status: "ok",
      version: APP_VERSION,
      component: APP_NAME,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
