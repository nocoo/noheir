// ---------------------------------------------------------------------------
// MCP Client data layer — CRUD for dynamic client registration
// ---------------------------------------------------------------------------

import { ulid } from "ulid";
import type { Db } from "@/lib/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface McpClient {
  id: string;
  client_id: string;
  client_name: string;
  redirect_uris: string; // JSON array
  grant_types: string; // JSON array
  created_at: string;
}

export interface CreateMcpClientInput {
  client_name: string;
  redirect_uris: string[];
  grant_types?: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a unique client ID. */
export function generateClientId(): string {
  return `noheir_mcp_${ulid()}`;
}

// ---------------------------------------------------------------------------
// createMcpClient
// ---------------------------------------------------------------------------

export async function createMcpClient(db: Db, input: CreateMcpClientInput): Promise<McpClient> {
  const id = ulid();
  const clientId = generateClientId();
  const now = new Date().toISOString();

  const sql = `
    INSERT INTO mcp_clients (id, client_id, client_name, redirect_uris, grant_types, response_types, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  await db.execute(sql, [
    id,
    clientId,
    input.client_name,
    JSON.stringify(input.redirect_uris),
    JSON.stringify(input.grant_types ?? ["authorization_code"]),
    JSON.stringify(["code"]),
    now,
    now,
  ]);

  const client = await getMcpClientById(db, id);
  if (!client) throw new Error(`Failed to retrieve mcp_client ${id} after creation`);
  return client;
}

// ---------------------------------------------------------------------------
// getMcpClientById
// ---------------------------------------------------------------------------

export async function getMcpClientById(db: Db, id: string): Promise<McpClient | null> {
  return db.firstOrNull<McpClient>(
    "SELECT id, client_id, client_name, redirect_uris, grant_types, created_at FROM mcp_clients WHERE id = ?",
    [id],
  );
}

// ---------------------------------------------------------------------------
// getMcpClientByClientId
// ---------------------------------------------------------------------------

export async function getMcpClientByClientId(db: Db, clientId: string): Promise<McpClient | null> {
  return db.firstOrNull<McpClient>(
    "SELECT id, client_id, client_name, redirect_uris, grant_types, created_at FROM mcp_clients WHERE client_id = ?",
    [clientId],
  );
}
