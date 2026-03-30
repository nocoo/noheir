/**
 * MCP configuration for Gen 2 (Worker-based).
 * Replaces Gen 1's Supabase-based config.
 */

export interface McpConfigParams {
  workerUrl: string;
  workerToken: string;
  userId: string;
  projectPath: string;
}

export function getMcpProjectPath(): string {
  return "<path-to-project>";
}

export function buildMcpConfigJson(params: McpConfigParams): string {
  const config = {
    mcpServers: {
      noheir: {
        command: "bun",
        args: ["run", `${params.projectPath}/mcp/src/index.ts`],
        env: {
          WORKER_URL: params.workerUrl,
          WORKER_TOKEN: params.workerToken,
          WORKER_USER_ID: params.userId,
        },
      },
    },
  };

  return JSON.stringify(config, null, 2);
}
