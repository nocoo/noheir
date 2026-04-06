# DEPRECATED

This directory contains the legacy stdio-based MCP server (v2).

**Status**: Deprecated as of 2026-04-06. Will be removed in a future release.

## Migration

The MCP server has been rewritten and integrated into the Worker:

- **New Location**: `worker/src/mcp/`
- **Transport**: stdio → Streamable HTTP
- **Auth**: Static token → OAuth 2.1 with PKCE
- **Endpoint**: `https://noheir.worker.hexly.ai/mcp`

## Client Configuration (Claude Desktop)

Replace the old stdio configuration:

```json
// OLD (deprecated)
{
  "mcpServers": {
    "noheir": {
      "command": "bun",
      "args": ["run", "mcp/src/index.ts"],
      "env": { "..." }
    }
  }
}

// NEW
{
  "mcpServers": {
    "noheir": {
      "url": "https://noheir.worker.hexly.ai/mcp"
    }
  }
}
```

First connection will trigger OAuth login via browser.

## Removal Timeline

This directory will be removed after 2026-05-01 (30-day deprecation period).
