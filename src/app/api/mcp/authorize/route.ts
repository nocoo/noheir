/**
 * MCP OAuth Authorize Endpoint
 *
 * Handles authorization flow:
 * 1. Forward params to Worker to create auth session
 * 2. Check if user is logged in
 * 3. If logged in, redirect to callback
 * 4. If not, redirect to login with callback URL
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

  // Forward to Worker to create auth session
  const workerUrl = new URL(`${WORKER_URL}/mcp/authorize`);
  url.searchParams.forEach((value, key) => {
    workerUrl.searchParams.set(key, value);
  });

  const workerResponse = await fetch(workerUrl.toString(), {
    method: "GET",
  });

  // If Worker returns error, forward it
  if (!workerResponse.ok) {
    const errorData = await workerResponse.json().catch(() => ({ error: "Unknown error" }));
    return NextResponse.json(errorData, { status: workerResponse.status });
  }

  // Worker created auth session successfully
  // Now check if user is logged in
  const session = await auth();

  // Build callback URL
  const siteUrl = process.env.NEXTAUTH_URL || "https://noheir.hexly.ai";
  const callbackUrl = `${siteUrl}/api/mcp/callback?state=${encodeURIComponent(state)}`;

  if (session?.user?.id) {
    // User is logged in, go directly to callback
    return NextResponse.redirect(callbackUrl);
  }

  // User not logged in, redirect to login
  const loginUrl = new URL("/login", siteUrl);
  loginUrl.searchParams.set("callbackUrl", callbackUrl);
  return NextResponse.redirect(loginUrl.toString());
}
