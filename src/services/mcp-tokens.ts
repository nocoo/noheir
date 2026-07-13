// ---------------------------------------------------------------------------
// MCP Token data layer — access & refresh token management
// ---------------------------------------------------------------------------

import type { Db } from "@/lib/db";
import { ulid } from "ulid";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface McpToken {
  id: string;
  access_token_hash: string;
  access_token_preview: string;
  client_id: string;
  user_id: string;
  client_name: string | null;
  scope: string;
  revoked: number; // 0 or 1
  revoked_at: string | null;
  expires_at: string;
  last_used_at: string | null;
  issued_at: string;
}

export interface McpRefreshToken {
  id: string;
  refresh_token_hash: string;
  access_token_id: string;
  client_id: string;
  user_id: string;
  scope: string;
  expires_at: string;
  revoked: number;
}

export interface CreateMcpTokenInput {
  access_token_hash: string;
  access_token_preview: string;
  refresh_token_hash: string;
  client_id: string;
  user_id: string;
  scope?: string;
  client_name?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Access token TTL: 30 days in seconds */
export const ACCESS_TOKEN_TTL = 30 * 24 * 60 * 60;

/** Refresh token TTL: 90 days in seconds */
export const REFRESH_TOKEN_TTL = 90 * 24 * 60 * 60;

// ---------------------------------------------------------------------------
// Token generation helpers
// ---------------------------------------------------------------------------

/** Generate a random hex string of given byte length. */
export function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Compute SHA-256 hex hash of a string. */
export async function sha256(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const buffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Generate a new access token with prefix. */
export function generateAccessToken(): string {
  return `noheir_at_${randomHex(24)}`;
}

/** Generate a new refresh token with prefix. */
export function generateRefreshToken(): string {
  return `noheir_rt_${randomHex(24)}`;
}

// ---------------------------------------------------------------------------
// createMcpToken
// ---------------------------------------------------------------------------

export async function createMcpToken(db: Db, input: CreateMcpTokenInput): Promise<McpToken> {
  const id = ulid();
  const now = new Date();
  const issuedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + ACCESS_TOKEN_TTL * 1000).toISOString();
  const refreshExpiresAt = new Date(now.getTime() + REFRESH_TOKEN_TTL * 1000).toISOString();

  // Insert access token
  const tokenSql = `
    INSERT INTO mcp_tokens
      (id, access_token_hash, access_token_preview, client_id, user_id, scope, client_name, issued_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  await db.execute(tokenSql, [
    id,
    input.access_token_hash,
    input.access_token_preview,
    input.client_id,
    input.user_id,
    input.scope ?? "mcp:full",
    input.client_name ?? null,
    issuedAt,
    expiresAt,
  ]);

  // Insert refresh token
  const refreshId = ulid();
  const refreshSql = `
    INSERT INTO mcp_refresh_tokens
      (id, refresh_token_hash, access_token_id, client_id, user_id, scope, issued_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  await db.execute(refreshSql, [
    refreshId,
    input.refresh_token_hash,
    id,
    input.client_id,
    input.user_id,
    input.scope ?? "mcp:full",
    issuedAt,
    refreshExpiresAt,
  ]);

  const token = await getMcpTokenById(db, id);
  if (!token) throw new Error(`Failed to retrieve mcp_token ${id} after creation`);
  return token;
}

// ---------------------------------------------------------------------------
// getMcpTokenById
// ---------------------------------------------------------------------------

export async function getMcpTokenById(db: Db, id: string): Promise<McpToken | null> {
  return db.firstOrNull<McpToken>("SELECT * FROM mcp_tokens WHERE id = ?", [id]);
}

// ---------------------------------------------------------------------------
// getValidTokenByHash
// ---------------------------------------------------------------------------

/** Look up a valid (not revoked, not expired) token by access_token_hash. */
export async function getValidTokenByHash(
  db: Db,
  accessTokenHash: string,
): Promise<McpToken | null> {
  const now = new Date().toISOString();
  return db.firstOrNull<McpToken>(
    `SELECT * FROM mcp_tokens
     WHERE access_token_hash = ? AND revoked = 0 AND expires_at > ?`,
    [accessTokenHash, now],
  );
}

// ---------------------------------------------------------------------------
// getValidTokenByRefreshHash
// ---------------------------------------------------------------------------

/** Look up a valid token by refresh_token_hash (for token refresh). */
export async function getValidTokenByRefreshHash(
  db: Db,
  refreshTokenHash: string,
): Promise<(McpToken & { refresh_token_id: string }) | null> {
  const now = new Date().toISOString();
  const result = await db.firstOrNull<McpToken & { refresh_token_id: string }>(
    `SELECT t.*, r.id as refresh_token_id
     FROM mcp_tokens t
     JOIN mcp_refresh_tokens r ON r.access_token_id = t.id
     WHERE r.refresh_token_hash = ? AND r.revoked = 0 AND r.expires_at > ? AND t.revoked = 0`,
    [refreshTokenHash, now],
  );
  return result;
}

// ---------------------------------------------------------------------------
// updateLastUsed
// ---------------------------------------------------------------------------

/** Update last_used_at timestamp for a token. */
export async function updateLastUsed(db: Db, id: string): Promise<void> {
  const now = new Date().toISOString();
  await db.execute("UPDATE mcp_tokens SET last_used_at = ? WHERE id = ?", [now, id]);
}

// ---------------------------------------------------------------------------
// revokeToken
// ---------------------------------------------------------------------------

/** Revoke a token by ID. */
export async function revokeToken(db: Db, id: string): Promise<boolean> {
  const now = new Date().toISOString();
  const meta = await db.execute(
    "UPDATE mcp_tokens SET revoked = 1, revoked_at = ? WHERE id = ? AND revoked = 0",
    [now, id],
  );
  return meta.changes > 0;
}

// ---------------------------------------------------------------------------
// revokeTokensByClientAndUser
// ---------------------------------------------------------------------------

/** Revoke all tokens for a client (used during token rotation). */
export async function revokeTokensByClientAndUser(
  db: Db,
  clientId: string,
  userId: string,
): Promise<number> {
  const now = new Date().toISOString();

  // Revoke access tokens
  const tokenMeta = await db.execute(
    "UPDATE mcp_tokens SET revoked = 1, revoked_at = ? WHERE client_id = ? AND user_id = ? AND revoked = 0",
    [now, clientId, userId],
  );

  // Revoke refresh tokens
  await db.execute(
    "UPDATE mcp_refresh_tokens SET revoked = 1, revoked_at = ? WHERE client_id = ? AND user_id = ? AND revoked = 0",
    [now, clientId, userId],
  );

  return tokenMeta.changes;
}

// ---------------------------------------------------------------------------
// listMcpTokens
// ---------------------------------------------------------------------------

/** List all tokens (for admin display). */
export async function listMcpTokens(db: Db): Promise<McpToken[]> {
  const result = await db.query<McpToken>("SELECT * FROM mcp_tokens ORDER BY issued_at DESC");
  return result.results;
}
