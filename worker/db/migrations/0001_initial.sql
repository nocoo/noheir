-- NoHeir D1 Schema — Initial Migration
-- Generated from worker/db/schema.ts

-- 1. users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  image TEXT,
  provider_account_id TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- 2. financial_products
CREATE TABLE IF NOT EXISTS financial_products (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  channel TEXT,
  category TEXT,
  currency TEXT DEFAULT 'CNY',
  lock_period_days INTEGER DEFAULT 0,
  annual_return_rate REAL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- 3. capital_units
CREATE TABLE IF NOT EXISTS capital_units (
  id TEXT PRIMARY KEY,
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
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- 4. transactions
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
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
  currency TEXT NOT NULL DEFAULT '人民币',
  tags TEXT DEFAULT '[]',
  note TEXT,
  raw_index INTEGER,
  has_secondary_mapping INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- 5. transfers
CREATE TABLE IF NOT EXISTS transfers (
  id TEXT PRIMARY KEY,
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
  currency TEXT NOT NULL DEFAULT '人民币',
  account TEXT NOT NULL,
  tags TEXT DEFAULT '[]',
  note TEXT,
  raw_index INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- 6. settings
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  site_name TEXT DEFAULT '',
  settings TEXT DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_transactions_user_year_month ON transactions(user_id, year, month);
CREATE INDEX IF NOT EXISTS idx_transactions_user_type ON transactions(user_id, type);
CREATE INDEX IF NOT EXISTS idx_transfers_user_date ON transfers(user_id, date);
CREATE INDEX IF NOT EXISTS idx_transfers_user_year_month ON transfers(user_id, year, month);
CREATE INDEX IF NOT EXISTS idx_capital_units_user ON capital_units(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_products_user ON financial_products(user_id);
CREATE INDEX IF NOT EXISTS idx_settings_owner ON settings(owner_id);
