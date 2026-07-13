import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { users } from "../schema";
import type { User } from "../types";

export function createUsersRepo(db: DrizzleD1Database) {
  return {
    async findById(id: string): Promise<User | null> {
      const row = await db.select().from(users).where(eq(users.id, id)).get();
      return row ?? null;
    },

    /**
     * Create or update a user row.
     *
     * Uses "find-then-insert/update" instead of `ON CONFLICT` because
     * Drizzle D1's `.onConflictDoUpdate()` does not reliably return
     * the row with `.returning().get()`.
     *
     * The `id` is the Google OAuth `sub` claim (providerAccountId),
     * which NextAuth passes as the userId throughout the system.
     */
    async upsert(data: {
      id: string;
      email: string;
      name?: string | null | undefined;
      image?: string | null | undefined;
      providerAccountId: string;
    }): Promise<User> {
      const existing = await db.select().from(users).where(eq(users.id, data.id)).get();

      if (existing) {
        const updated = await db
          .update(users)
          .set({
            email: data.email,
            name: data.name ?? existing.name,
            image: data.image ?? existing.image,
          })
          .where(eq(users.id, data.id))
          .returning()
          .get();
        return updated;
      }

      const inserted = await db
        .insert(users)
        .values({
          id: data.id,
          email: data.email,
          name: data.name ?? null,
          image: data.image ?? null,
          providerAccountId: data.providerAccountId,
        })
        .returning()
        .get();
      return inserted;
    },
  };
}

export type UsersRepo = ReturnType<typeof createUsersRepo>;
