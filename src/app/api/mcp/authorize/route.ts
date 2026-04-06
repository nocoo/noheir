/**
 * MCP OAuth Authorize Proxy
 *
 * Note: This returns a redirect, so we need to handle it specially.
 */

import { NextResponse } from "next/server";

const WORKER_URL = process.env.WORKER_URL || "https://noheir.worker.hexly.ai";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const workerUrl = new URL(`${WORKER_URL}/mcp/authorize`);

  // Forward all query params
  url.searchParams.forEach((value, key) => {
    workerUrl.searchParams.set(key, value);
  });

  const workerResponse = await fetch(workerUrl.toString(), {
    method: "GET",
    headers: request.headers,
    redirect: "manual",
  });

  // Forward redirect response
  if (workerResponse.status >= 300 && workerResponse.status < 400) {
    const location = workerResponse.headers.get("Location");
    if (location) {
      return NextResponse.redirect(location);
    }
  }

  return new Response(workerResponse.body, {
    status: workerResponse.status,
    headers: workerResponse.headers,
  });
}
