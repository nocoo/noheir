import { APP_NAME, APP_VERSION } from "@/lib/version";

export const dynamic = "force-dynamic";

/**
 * GET /api/live — Liveness health check.
 *
 * No auth required. Returns app name, version, and timestamp.
 * Used by monitoring, load balancers, and deployment health checks.
 */
export async function GET() {
  return Response.json(
    {
      status: "ok",
      version: APP_VERSION,
      component: APP_NAME,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
