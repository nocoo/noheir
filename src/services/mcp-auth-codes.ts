// ---------------------------------------------------------------------------
// MCP Auth Code data layer — OAuth authorization sessions & codes
// ---------------------------------------------------------------------------

import type { Db } from "@/lib/db";
import { ulid } from "ulid";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface McpAuthCode {
  id: string;
  state: string;
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: string;
  scope: string;
  code: string | null;
  user_id: string | null;
  consumed: number; // 0 or 1
  expires_at: number;
}

export interface CreateMcpAuthCodeInput {
  state: string;
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method?: string;
  scope?: string;
  expires_at: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get current Unix epoch timestamp in seconds. */
function nowEpoch(): number {
  return Math.floor(Date.now() / 1000);
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Authorization code TTL in seconds (10 minutes) */
export const AUTH_CODE_TTL = 10 * 60;

// ---------------------------------------------------------------------------
// createAuthSession
// ---------------------------------------------------------------------------

/** Create an authorization session (stores authorize request params keyed by state). */
export async function createAuthSession(db: Db, input: CreateMcpAuthCodeInput): Promise<void> {
  const id = ulid();
  const now = new Date().toISOString();

  const sql = `
    INSERT INTO mcp_auth_sessions
      (id, state, client_id, redirect_uri, code_challenge, code_challenge_method, scope, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  await db.execute(sql, [
    id,
    input.state,
    input.client_id,
    input.redirect_uri,
    input.code_challenge,
    input.code_challenge_method ?? "S256",
    input.scope ?? "mcp:full",
    input.expires_at,
    now,
  ]);
}

// ---------------------------------------------------------------------------
// upgradeAuthSession
// ---------------------------------------------------------------------------

/** Set the authorization code and user ID on an existing session (after login callback). */
export async function upgradeAuthSession(
  db: Db,
  state: string,
  code: string,
  userId: string,
): Promise<boolean> {
  const now = nowEpoch();
  const meta = await db.execute(
    `UPDATE mcp_auth_sessions
     SET code = ?, user_id = ?, expires_at = ?
     WHERE state = ? AND code IS NULL AND expires_at > ?`,
    [code, userId, now + AUTH_CODE_TTL, state, now],
  );
  return meta.changes > 0;
}

// ---------------------------------------------------------------------------
// getAuthCodeByCode
// ---------------------------------------------------------------------------

/** Look up an auth code (valid, unconsumed, not expired). */
export async function getAuthCodeByCode(db: Db, code: string): Promise<McpAuthCode | null> {
  const now = nowEpoch();
  return db.firstOrNull<McpAuthCode>(
    `SELECT id, state, client_id, redirect_uri, code_challenge, code_challenge_method, scope, code, user_id, consumed, expires_at
     FROM mcp_auth_sessions
     WHERE code = ? AND consumed = 0 AND expires_at > ?`,
    [code, now],
  );
}

// ---------------------------------------------------------------------------
// getAuthSessionByState
// ---------------------------------------------------------------------------

/** Look up an auth session by state (for callback verification). */
export async function getAuthSessionByState(db: Db, state: string): Promise<McpAuthCode | null> {
  const now = nowEpoch();
  return db.firstOrNull<McpAuthCode>(
    `SELECT id, state, client_id, redirect_uri, code_challenge, code_challenge_method, scope, code, user_id, consumed, expires_at
     FROM mcp_auth_sessions
     WHERE state = ? AND expires_at > ?`,
    [state, now],
  );
}

// ---------------------------------------------------------------------------
// consumeAuthCode
// ---------------------------------------------------------------------------

/** Atomically consume an auth code (set consumed = 1). Returns true if consumed. */
export async function consumeAuthCode(db: Db, code: string): Promise<boolean> {
  const meta = await db.execute(
    `UPDATE mcp_auth_sessions SET consumed = 1
     WHERE code = ? AND consumed = 0`,
    [code],
  );
  return meta.changes > 0;
}
