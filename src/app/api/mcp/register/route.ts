/**
 * MCP OAuth Register Proxy
 */

const WORKER_URL = process.env.WORKER_URL || "https://noheir.worker.hexly.ai";

export async function POST(request: Request) {
  // Clone body before consuming
  const body = await request.text();

  const workerResponse = await fetch(`${WORKER_URL}/mcp/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
  });

  return new Response(workerResponse.body, {
    status: workerResponse.status,
    headers: workerResponse.headers,
  });
}
