/**
 * MCP Proxy Route
 *
 * Proxies all MCP requests to the Worker, keeping the Worker URL internal.
 * This allows clients to use the main domain for MCP while the actual
 * processing happens on the Worker.
 */

const WORKER_URL = process.env.WORKER_URL || "https://noheir.worker.hexly.ai";

export async function POST(request: Request) {
  const body = await request.text();
  const authHeader = request.headers.get("Authorization");

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (authHeader) {
    headers["Authorization"] = authHeader;
  }

  const workerResponse = await fetch(`${WORKER_URL}/mcp`, {
    method: "POST",
    headers,
    body,
  });

  return new Response(workerResponse.body, {
    status: workerResponse.status,
    headers: workerResponse.headers,
  });
}

export async function GET() {
  const workerResponse = await fetch(`${WORKER_URL}/mcp`, {
    method: "GET",
  });

  return new Response(workerResponse.body, {
    status: workerResponse.status,
    headers: workerResponse.headers,
  });
}

export async function DELETE() {
  const workerResponse = await fetch(`${WORKER_URL}/mcp`, {
    method: "DELETE",
  });

  return new Response(workerResponse.body, {
    status: workerResponse.status,
    headers: workerResponse.headers,
  });
}
