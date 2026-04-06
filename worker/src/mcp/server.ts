/**
 * MCP Server for noheir
 *
 * Provides MCP tools for financial data management via Streamable HTTP transport.
 * Implements OAuth 2.1 token validation for authentication.
 */

import { createMcpServer, registerEntityTools, validateOrigin } from "@nocoo/base-mcp";
import { hashToken } from "@nocoo/base-mcp/auth";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { Context } from "hono";
import type { AllRepos } from "../../db/repositories";
import { productEntity } from "./entities/product";
import { unitEntity } from "./entities/unit";
import { registerQueryTools } from "./tools/query";
import { registerSummaryTools } from "./tools/summary";
import { registerDeleteTools } from "./tools/delete";

// ============================================================================
// Types
// ============================================================================

interface McpEnv {
  SITE_URL?: string;
}

interface McpContext {
  repos: AllRepos;
  env: McpEnv;
}

// ============================================================================
// Token Validation
// ============================================================================

interface TokenValidationSuccess {
  valid: true;
  userId: string;
  scope: string;
}

interface TokenValidationFailure {
  valid: false;
  error: string;
  status: number;
}

type TokenValidationResult = TokenValidationSuccess | TokenValidationFailure;

async function validateToken(
  authHeader: string | undefined,
  repos: AllRepos
): Promise<TokenValidationResult> {
  if (!authHeader?.startsWith("Bearer ")) {
    return { valid: false, error: "Missing or invalid Authorization header", status: 401 };
  }

  const token = authHeader.slice(7);
  const tokenHash = await hashToken(token);

  const tokenRecord = await repos.mcpOAuth.tokens.findByHash(tokenHash);
  if (!tokenRecord) {
    return { valid: false, error: "Invalid access token", status: 401 };
  }

  // Check if revoked
  if (tokenRecord.revoked) {
    return { valid: false, error: "Token has been revoked", status: 401 };
  }

  // Check expiration
  const now = new Date().toISOString();
  if (tokenRecord.expiresAt < now) {
    return { valid: false, error: "Token has expired", status: 401 };
  }

  // Update last used timestamp (fire-and-forget)
  repos.mcpOAuth.tokens.updateLastUsed(tokenHash).catch(() => {});

  return {
    valid: true,
    userId: tokenRecord.userId,
    scope: tokenRecord.scope,
  };
}

// ============================================================================
// MCP Server Instance Factory
// ============================================================================

function createMcpServerInstance(userId: string, repos: AllRepos) {
  const server = createMcpServer({
    name: "noheir",
    version: "3.0.0",
  });

  // Register entity tools with appropriate repos slices
  registerEntityTools(server, productEntity, {
    repos: { products: repos.products, userId },
  });

  registerEntityTools(server, unitEntity, {
    repos: { units: repos.units, products: repos.products, contributionLogs: repos.contributionLogs, userId },
  });

  // Register query tools (transactions, transfers, summary, monthly report)
  registerQueryTools(server, {
    repos: {
      transactions: repos.transactions,
      transfers: repos.transfers,
      metadata: repos.metadata,
      reports: repos.reports,
      userId,
    },
  });

  // Register summary tools (products summary, units summary)
  registerSummaryTools(server, {
    repos: {
      products: repos.products,
      units: repos.units,
      contributionLogs: repos.contributionLogs,
      userId,
    },
  });

  // Register delete tools (delete_product, delete_unit)
  registerDeleteTools(server, {
    repos: {
      products: repos.products,
      units: repos.units,
      contributionLogs: repos.contributionLogs,
      userId,
    },
  });

  return server;
}

// ============================================================================
// MCP Endpoint Handlers
// ============================================================================

/**
 * POST /mcp - Main MCP endpoint (Streamable HTTP)
 */
export async function handleMcpPost(
  c: Context,
  ctx: McpContext
): Promise<Response> {
  // 1. Origin validation (DNS rebinding protection)
  const siteUrl = c.env?.SITE_URL || "https://noheir.hexly.ai";
  const originResult = validateOrigin(c.req.header("origin") ?? null, siteUrl);
  if (!originResult.valid) {
    return c.json({ error: originResult.error }, originResult.status as 400 | 403);
  }

  // 2. Token validation
  const authResult = await validateToken(c.req.header("authorization"), ctx.repos);
  if (!authResult.valid) {
    return c.json({ error: authResult.error }, authResult.status as 401);
  }

  // 3. Create MCP server with user context
  const server = createMcpServerInstance(authResult.userId, ctx.repos);

  // 4. Create transport and handle request
  // Stateless mode: no session tracking, each request is independent
  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
    // sessionIdGenerator omitted = true stateless mode (no session IDs)
  });

  await server.connect(transport);
  return transport.handleRequest(c.req.raw);
}

/**
 * GET /mcp - SSE notifications endpoint (not implemented in v1)
 */
export function handleMcpGet(c: Context): Response {
  return c.json({ error: "SSE notifications not supported in v1" }, 405);
}

/**
 * DELETE /mcp - Session close (no-op in stateless mode)
 */
export function handleMcpDelete(c: Context): Response {
  return c.json({ closed: true }, 200);
}
