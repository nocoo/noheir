/**
 * MCP OAuth Callback Proxy
 *
 * This endpoint is called after user login, forwarding to Worker with user_id.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";

const WORKER_URL = process.env.WORKER_URL || "https://noheir.worker.hexly.ai";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");

  if (!state) {
    return NextResponse.json({ error: "Missing state parameter" }, { status: 400 });
  }

  // Get user session
  const session = await auth();
  if (!session?.user?.id) {
    // Redirect to login with callback
    const callbackUrl = `/api/mcp/callback?state=${encodeURIComponent(state)}`;
    return NextResponse.redirect(new URL(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`, request.url));
  }

  // Forward to Worker with user_id
  const workerUrl = new URL(`${WORKER_URL}/mcp/callback`);
  workerUrl.searchParams.set("state", state);
  workerUrl.searchParams.set("user_id", session.user.id);

  const workerResponse = await fetch(workerUrl.toString(), {
    method: "GET",
    redirect: "manual",
  });

  // Forward redirect or HTML response
  if (workerResponse.status >= 300 && workerResponse.status < 400) {
    const location = workerResponse.headers.get("Location");
    if (location) {
      return NextResponse.redirect(location);
    }
  }

  // Return HTML response (success/error page)
  return new Response(workerResponse.body, {
    status: workerResponse.status,
    headers: workerResponse.headers,
  });
}
