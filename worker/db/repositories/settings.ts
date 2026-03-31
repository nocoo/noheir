import { eq, and } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { settings } from "../schema";
import type { Setting, NewSetting } from "../types";

export function createSettingsRepo(db: DrizzleD1Database) {
  return {
    async getByUserId(userId: string): Promise<Setting | null> {
      const row = await db
        .select()
        .from(settings)
        .where(eq(settings.ownerId, userId))
        .get();
      return row ?? null;
    },

    async deleteByUser(userId: string): Promise<boolean> {
      const rows = await db
        .delete(settings)
        .where(eq(settings.ownerId, userId))
        .returning()
        .all();
      return rows.length > 0;
    },

    async upsert(userId: string, data: Partial<Pick<NewSetting, "siteName" | "settings">>): Promise<Setting> {
      const existing = await db
        .select()
        .from(settings)
        .where(eq(settings.ownerId, userId))
        .get();

      if (existing) {
        const updated = await db
          .update(settings)
          .set(data)
          .where(and(eq(settings.id, existing.id), eq(settings.ownerId, userId)))
          .returning()
          .get();
        return updated;
      }

      const inserted = await db
        .insert(settings)
        .values({ ownerId: userId, ...data })
        .returning()
        .get();
      return inserted;
    },
  };
}

export type SettingsRepo = ReturnType<typeof createSettingsRepo>;
