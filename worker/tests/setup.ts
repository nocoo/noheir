/**
 * Test helper: in-memory SQLite with Drizzle for repository unit tests.
 *
 * Usage:
 *   import { getTestRepos, resetTestDb } from "./setup";
 *
 *   beforeEach(() => resetTestDb());
 *
 *   test("...", async () => {
 *     const repos = getTestRepos();
 *     await repos.transactions.create(userId, data);
 *   });
 */
import Database from "better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { type AllRepos, createAllRepos } from "../db/repositories";

let sqlite: Database.Database;
let db: BetterSQLite3Database;
let repos: AllRepos;

const SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  image TEXT,
  provider_account_id TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS financial_products (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  channel TEXT,
  category TEXT,
  currency TEXT DEFAULT 'CNY',
  lock_period_days INTEGER DEFAULT 0,
  open_days INTEGER,
  cycle_days INTEGER,
  annual_return_rate REAL,
  is_archived INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS capital_units (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  unit_code TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'CNY',
  status TEXT DEFAULT '已成立',
  strategy TEXT,
  tactics TEXT,
  product_id TEXT REFERENCES financial_products(id) ON DELETE SET NULL,
  start_date TEXT,
  end_date TEXT,
  note TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS contribution_logs (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL REFERENCES capital_units(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES financial_products(id) ON DELETE RESTRICT,
  product_name TEXT,
  operation_type TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  balance_after_cents INTEGER,
  pnl_cents INTEGER,
  operation_date TEXT NOT NULL,
  source TEXT DEFAULT 'manual',
  note TEXT,
  deleted_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  day INTEGER NOT NULL,
  primary_category TEXT NOT NULL,
  secondary_category TEXT,
  tertiary_category TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  type TEXT NOT NULL,
  account TEXT NOT NULL,
  currency TEXT DEFAULT '人民币' NOT NULL,
  tags TEXT DEFAULT '[]',
  note TEXT,
  raw_index INTEGER,
  has_secondary_mapping INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS transfers (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  day INTEGER NOT NULL,
  primary_category TEXT,
  secondary_category TEXT DEFAULT '转账',
  transaction_type TEXT,
  inflow_amount_cents INTEGER DEFAULT 0,
  outflow_amount_cents INTEGER DEFAULT 0,
  currency TEXT DEFAULT '人民币' NOT NULL,
  account TEXT NOT NULL,
  tags TEXT DEFAULT '[]',
  note TEXT,
  raw_index INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  owner_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  site_name TEXT DEFAULT '',
  settings TEXT DEFAULT '{}',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS expense_categories (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color_token TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS expense_categories_user_name_uniq
  ON expense_categories (user_id, name);

CREATE TABLE IF NOT EXISTS recurring_expenses (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category_id TEXT REFERENCES expense_categories(id) ON DELETE SET NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CNY',
  account TEXT,
  frequency TEXT NOT NULL,
  interval INTEGER NOT NULL DEFAULT 1,
  day_of_month INTEGER,
  month_of_year INTEGER,
  weekday INTEGER,
  start_date TEXT NOT NULL,
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  ended_at TEXT,
  note TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`;

const TABLES = [
  "recurring_expenses",
  "expense_categories",
  "contribution_logs",
  "settings",
  "capital_units",
  "financial_products",
  "transfers",
  "transactions",
  "users",
];

export function createTestDb() {
  if (sqlite) sqlite.close();
  sqlite = new Database(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON;");
  sqlite.exec(SCHEMA_DDL);
  db = drizzle(sqlite);
  repos = createAllRepos(db as unknown as Parameters<typeof createAllRepos>[0]);
}

export function resetTestDb() {
  for (const table of TABLES) {
    sqlite.exec(`DELETE FROM ${table}`);
  }
  sqlite.exec("DELETE FROM sqlite_sequence");
}

export function getTestRepos(): AllRepos {
  if (!repos) createTestDb();
  return repos;
}

export function getTestDb(): BetterSQLite3Database {
  if (!db) createTestDb();
  return db;
}

export function closeTestDb() {
  if (sqlite) sqlite.close();
}

/** Seed a test user and return their ID */
export function seedUser(id = "test-user-1", email = "test@example.com"): string {
  sqlite.exec(
    `INSERT OR IGNORE INTO users (id, email, name, provider_account_id, created_at)
     VALUES ('${id}', '${email}', 'Test User', 'google-${id}', ${Date.now()})`,
  );
  return id;
}

// Auto-create on import
createTestDb();
