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

/**
 * Build the MCP config JSON for Claude Desktop.
 * If params are missing, uses placeholder values.
 */
export function buildMcpConfigJson(params: Partial<McpConfigParams>): string {
  const config = {
    mcpServers: {
      noheir: {
        command: "bun",
        args: ["run", `${params.projectPath || "<path-to-project>"}/mcp/src/index.ts`],
        env: {
          WORKER_URL: params.workerUrl || "YOUR_WORKER_URL",
          WORKER_TOKEN: params.workerToken || "YOUR_WORKER_TOKEN",
          USER_ID: params.userId || "YOUR_USER_ID",
        },
      },
    },
  };

  return JSON.stringify(config, null, 2);
}

/**
 * Check if MCP config has all required parameters filled.
 */
export function isMcpConfigComplete(params: Partial<McpConfigParams>): boolean {
  return Boolean(
    params.workerUrl &&
    params.workerToken &&
    params.userId &&
    params.projectPath &&
    !params.workerUrl.includes("YOUR_") &&
    !params.workerToken.includes("YOUR_") &&
    !params.userId.includes("YOUR_")
  );
}
