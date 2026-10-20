import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("retired internal AI and MCP runtime", () => {
  it("has no protocol-only package dependencies", () => {
    const manifest = JSON.parse(readFileSync("package.json", "utf8"));
    for (const name of ["@modelcontextprotocol/sdk", "@nocoo/base-mcp"]) {
      expect(manifest.dependencies[name]).toBeUndefined();
    }
  });

  it("removes obsolete protocol and credential implementations", () => {
    for (const path of [
      "worker/src/mcp.ts",
      "src/lib/mcp",
      "src/services/mcp-clients.ts",
      "src/services/mcp-auth-codes.ts",
      "src/services/mcp-tokens.ts",
    ]) {
      expect(existsSync(path), path).toBe(false);
    }
  });

  it("never seeds obsolete credentials or model configuration", () => {
    const catalog = readFileSync("scripts/demo-catalog.ts", "utf8");
    expect(catalog).not.toMatch(/mcp_clients|mcp_tokens|mcp_auth_sessions|mcp_refresh_tokens/);
    expect(catalog).not.toContain("ai_config");
  });
});
