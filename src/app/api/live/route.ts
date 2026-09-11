import { APP_NAME, APP_VERSION } from "@/lib/version";

export const dynamic = "force-dynamic";

/**
 * GET /api/live — Surety-standard health check.
 *
 * Public readiness check through the same authenticated Worker SQL gateway
 * used by the application. The probe reads no user data and times out in 5s.
 *
 * 200 = healthy, 503 = unhealthy. Cache-Control: no-store.
 */
export async function GET() {
  let connected = false;
  try {
    const url = process.env.WORKER_URL;
    const token = process.env.WORKER_TOKEN;
    if (url && token) {
      const response = await fetch(new URL("/api/v1/query", url), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ sql: "SELECT 1 AS probe", params: [] }),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(5_000),
      });
      connected = response.ok && (await response.json())?.results?.[0]?.probe === 1;
    }
  } catch {
    // Report dependency failure without exposing credentials or private diagnostics.
  }

  return Response.json(
    {
      status: connected ? "ok" : "error",
      version: APP_VERSION,
      component: APP_NAME,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      database: { connected },
    },
    { status: connected ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
