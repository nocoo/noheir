/**
 * MCP configuration for Gen 3 (Worker-integrated with OAuth 2.1).
 * Replaces Gen 2's token-based config.
 */

export interface McpConfigParams {
  workerUrl: string;
}

export function getMcpProjectPath(): string {
  return "<path-to-project>";
}

/**
 * Build the MCP config JSON for Claude Desktop.
 * Gen 3 uses OAuth 2.1 - only the URL is needed.
 */
export function buildMcpConfigJson(params: Partial<McpConfigParams>): string {
  const config = {
    mcpServers: {
      noheir: {
        url: params.workerUrl || "https://noheir.worker.hexly.ai/mcp",
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
    !params.workerUrl.includes("YOUR_")
  );
}
