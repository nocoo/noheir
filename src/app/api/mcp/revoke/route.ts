/**
 * MCP OAuth Revoke Proxy
 */

const WORKER_URL = process.env.WORKER_URL || "https://noheir.worker.hexly.ai";

export async function POST(request: Request) {
  const workerResponse = await fetch(`${WORKER_URL}/mcp/revoke`, {
    method: "POST",
    headers: request.headers,
    body: request.body,
    // @ts-expect-error - duplex is required for streaming request bodies
    duplex: "half",
  });

  return new Response(workerResponse.body, {
    status: workerResponse.status,
    headers: workerResponse.headers,
  });
}
