import { eq, and, lt } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import {
  mcpClients,
  mcpAuthSessions,
  mcpTokens,
  mcpRefreshTokens,
} from "../schema";
import type {
  McpClient,
  NewMcpClient,
  McpAuthSession,
  NewMcpAuthSession,
  McpToken,
  NewMcpToken,
  McpRefreshToken,
  NewMcpRefreshToken,
} from "../types";

// ============================================================================
// MCP OAuth Repositories
// ============================================================================

export function createMcpClientsRepo(db: DrizzleD1Database) {
  return {
    async findById(id: string): Promise<McpClient | null> {
      const row = await db
        .select()
        .from(mcpClients)
        .where(eq(mcpClients.id, id))
        .get();
      return row ?? null;
    },

    async findByClientId(clientId: string): Promise<McpClient | null> {
      const row = await db
        .select()
        .from(mcpClients)
        .where(eq(mcpClients.clientId, clientId))
        .get();
      return row ?? null;
    },

    async create(data: NewMcpClient): Promise<McpClient> {
      const row = await db
        .insert(mcpClients)
        .values(data)
        .returning()
        .get();
      return row;
    },

    async update(
      clientId: string,
      data: Partial<Omit<NewMcpClient, "id" | "clientId" | "createdAt">>
    ): Promise<McpClient | null> {
      const row = await db
        .update(mcpClients)
        .set({ ...data, updatedAt: new Date().toISOString() })
        .where(eq(mcpClients.clientId, clientId))
        .returning()
        .get();
      return row ?? null;
    },

    async delete(clientId: string): Promise<boolean> {
      const result = await db
        .delete(mcpClients)
        .where(eq(mcpClients.clientId, clientId))
        .returning()
        .get();
      return result !== undefined;
    },
  };
}

export function createMcpAuthSessionsRepo(db: DrizzleD1Database) {
  return {
    async findByState(state: string): Promise<McpAuthSession | null> {
      const row = await db
        .select()
        .from(mcpAuthSessions)
        .where(eq(mcpAuthSessions.state, state))
        .get();
      return row ?? null;
    },

    async findByCode(code: string): Promise<McpAuthSession | null> {
      const row = await db
        .select()
        .from(mcpAuthSessions)
        .where(eq(mcpAuthSessions.code, code))
        .get();
      return row ?? null;
    },

    async create(data: NewMcpAuthSession): Promise<McpAuthSession> {
      const row = await db
        .insert(mcpAuthSessions)
        .values(data)
        .returning()
        .get();
      return row;
    },

    async setCode(
      state: string,
      code: string,
      userId: string
    ): Promise<McpAuthSession | null> {
      const row = await db
        .update(mcpAuthSessions)
        .set({ code, userId })
        .where(eq(mcpAuthSessions.state, state))
        .returning()
        .get();
      return row ?? null;
    },

    async markConsumed(id: string): Promise<boolean> {
      const result = await db
        .update(mcpAuthSessions)
        .set({ consumed: true })
        .where(eq(mcpAuthSessions.id, id))
        .returning()
        .get();
      return result !== undefined;
    },

    async deleteExpired(): Promise<number> {
      const now = Math.floor(Date.now() / 1000);
      const result = await db
        .delete(mcpAuthSessions)
        .where(lt(mcpAuthSessions.expiresAt, now))
        .returning();
      return result.length;
    },
  };
}

export function createMcpTokensRepo(db: DrizzleD1Database) {
  return {
    async findById(id: string): Promise<McpToken | null> {
      const row = await db
        .select()
        .from(mcpTokens)
        .where(eq(mcpTokens.id, id))
        .get();
      return row ?? null;
    },

    async findByHash(accessTokenHash: string): Promise<McpToken | null> {
      const row = await db
        .select()
        .from(mcpTokens)
        .where(eq(mcpTokens.accessTokenHash, accessTokenHash))
        .get();
      return row ?? null;
    },

    async findByUser(userId: string): Promise<McpToken[]> {
      const rows = await db
        .select()
        .from(mcpTokens)
        .where(eq(mcpTokens.userId, userId));
      return rows;
    },

    async create(data: NewMcpToken): Promise<McpToken> {
      const row = await db
        .insert(mcpTokens)
        .values(data)
        .returning()
        .get();
      return row;
    },

    async updateLastUsed(
      accessTokenHash: string,
      ip?: string
    ): Promise<boolean> {
      const result = await db
        .update(mcpTokens)
        .set({
          lastUsedAt: new Date().toISOString(),
          lastUsedIp: ip ?? null,
        })
        .where(eq(mcpTokens.accessTokenHash, accessTokenHash))
        .returning()
        .get();
      return result !== undefined;
    },

    async revoke(id: string): Promise<boolean> {
      const result = await db
        .update(mcpTokens)
        .set({
          revoked: true,
          revokedAt: new Date().toISOString(),
        })
        .where(eq(mcpTokens.id, id))
        .returning()
        .get();
      return result !== undefined;
    },

    async revokeByUser(userId: string): Promise<number> {
      const result = await db
        .update(mcpTokens)
        .set({
          revoked: true,
          revokedAt: new Date().toISOString(),
        })
        .where(
          and(eq(mcpTokens.userId, userId), eq(mcpTokens.revoked, false))
        )
        .returning();
      return result.length;
    },
  };
}

export function createMcpRefreshTokensRepo(db: DrizzleD1Database) {
  return {
    async findByHash(refreshTokenHash: string): Promise<McpRefreshToken | null> {
      const row = await db
        .select()
        .from(mcpRefreshTokens)
        .where(eq(mcpRefreshTokens.refreshTokenHash, refreshTokenHash))
        .get();
      return row ?? null;
    },

    async findByAccessTokenId(
      accessTokenId: string
    ): Promise<McpRefreshToken | null> {
      const row = await db
        .select()
        .from(mcpRefreshTokens)
        .where(eq(mcpRefreshTokens.accessTokenId, accessTokenId))
        .get();
      return row ?? null;
    },

    async create(data: NewMcpRefreshToken): Promise<McpRefreshToken> {
      const row = await db
        .insert(mcpRefreshTokens)
        .values(data)
        .returning()
        .get();
      return row;
    },

    /**
     * Rotate a refresh token: mark old as rotated, create new one.
     * Detects reuse: if the old token was already rotated, revokes
     * the entire token family.
     */
    async rotate(
      oldTokenHash: string,
      newData: NewMcpRefreshToken
    ): Promise<{ newToken: McpRefreshToken; reuseDetected: boolean }> {
      const oldToken = await this.findByHash(oldTokenHash);

      if (!oldToken) {
        throw new Error("Refresh token not found");
      }

      // Check for token reuse (security breach)
      if (oldToken.rotatedAt !== null) {
        // Reuse detected! Revoke entire token family
        await this.revokeByAccessTokenId(oldToken.accessTokenId);
        return { newToken: null as unknown as McpRefreshToken, reuseDetected: true };
      }

      // Create new refresh token
      const newToken = await this.create(newData);

      // Mark old token as rotated
      await db
        .update(mcpRefreshTokens)
        .set({
          rotatedAt: new Date().toISOString(),
          rotatedTo: newToken.id,
        })
        .where(eq(mcpRefreshTokens.id, oldToken.id));

      return { newToken, reuseDetected: false };
    },

    async revoke(id: string): Promise<boolean> {
      const result = await db
        .update(mcpRefreshTokens)
        .set({
          revoked: true,
          revokedAt: new Date().toISOString(),
        })
        .where(eq(mcpRefreshTokens.id, id))
        .returning()
        .get();
      return result !== undefined;
    },

    async revokeByAccessTokenId(accessTokenId: string): Promise<number> {
      const result = await db
        .update(mcpRefreshTokens)
        .set({
          revoked: true,
          revokedAt: new Date().toISOString(),
        })
        .where(eq(mcpRefreshTokens.accessTokenId, accessTokenId))
        .returning();
      return result.length;
    },

    async revokeByUser(userId: string): Promise<number> {
      const result = await db
        .update(mcpRefreshTokens)
        .set({
          revoked: true,
          revokedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(mcpRefreshTokens.userId, userId),
            eq(mcpRefreshTokens.revoked, false)
          )
        )
        .returning();
      return result.length;
    },
  };
}

// ============================================================================
// Combined MCP OAuth Repo Factory
// ============================================================================

export function createMcpOAuthRepo(db: DrizzleD1Database) {
  return {
    clients: createMcpClientsRepo(db),
    authSessions: createMcpAuthSessionsRepo(db),
    tokens: createMcpTokensRepo(db),
    refreshTokens: createMcpRefreshTokensRepo(db),
  };
}

export type McpOAuthRepo = ReturnType<typeof createMcpOAuthRepo>;
export type McpClientsRepo = ReturnType<typeof createMcpClientsRepo>;
export type McpAuthSessionsRepo = ReturnType<typeof createMcpAuthSessionsRepo>;
export type McpTokensRepo = ReturnType<typeof createMcpTokensRepo>;
export type McpRefreshTokensRepo = ReturnType<typeof createMcpRefreshTokensRepo>;
