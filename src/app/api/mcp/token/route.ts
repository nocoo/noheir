/**
 * MCP OAuth Token Proxy
 */

const WORKER_URL = process.env.WORKER_URL || "https://noheir.worker.hexly.ai";

export async function POST(request: Request) {
  const body = await request.text();
  const contentType = request.headers.get("Content-Type") || "application/x-www-form-urlencoded";

  const workerResponse = await fetch(`${WORKER_URL}/mcp/token`, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
    },
    body,
  });

  return new Response(workerResponse.body, {
    status: workerResponse.status,
    headers: workerResponse.headers,
  });
}
