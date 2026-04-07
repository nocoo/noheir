/**
 * MCP OAuth Callback Endpoint
 *
 * Called after user login, forwards to Worker with user_id to generate auth code.
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
  const siteUrl = process.env.NEXTAUTH_URL || "https://noheir.hexly.ai";

  if (!session?.user?.id) {
    // Redirect to login with callback
    const callbackUrl = `${siteUrl}/api/mcp/callback?state=${encodeURIComponent(state)}`;
    const loginUrl = new URL("/login", siteUrl);
    loginUrl.searchParams.set("callbackUrl", callbackUrl);
    return NextResponse.redirect(loginUrl.toString());
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
