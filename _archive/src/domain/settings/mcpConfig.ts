export interface McpConfigParams {
  email: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  projectPath: string;
}

/**
 * Return the expected project root path for MCP config.
 * In browser context this is a placeholder; users should replace with actual path.
 */
export function getMcpProjectPath(): string {
  return '<path-to-project>';
}

/**
 * Build the Claude Desktop MCP configuration JSON string.
 */
export function buildMcpConfigJson(params: McpConfigParams): string {
  const config = {
    mcpServers: {
      noheir: {
        command: 'bun',
        args: ['run', `${params.projectPath}/mcp/src/index.ts`],
        env: {
          SUPABASE_URL: params.supabaseUrl,
          SUPABASE_ANON_KEY: params.supabaseAnonKey,
          SUPABASE_EMAIL: params.email,
          SUPABASE_PASSWORD: '<your-password>',
        },
      },
    },
  };

  return JSON.stringify(config, null, 2);
}
