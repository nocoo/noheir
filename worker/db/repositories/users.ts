import { sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { users } from "../schema";
import type { User } from "../types";

export function createUsersRepo(db: DrizzleD1Database) {
  return {
    async findByNormalizedEmail(email: string): Promise<User[]> {
      const normalized = email.trim().toLowerCase();
      return db.select().from(users).where(sql`lower(trim(${users.email})) = ${normalized}`).all();
    },
  };
}

export type UsersRepo = ReturnType<typeof createUsersRepo>;
