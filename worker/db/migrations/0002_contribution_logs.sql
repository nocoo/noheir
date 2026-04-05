-- Migration: Add contribution_logs table
CREATE TABLE IF NOT EXISTS contribution_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL REFERENCES capital_units(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES financial_products(id) ON DELETE RESTRICT,
  product_name TEXT,
  operation_type TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  balance_after_cents INTEGER,
  operation_date TEXT NOT NULL,
  source TEXT DEFAULT 'manual',
  note TEXT,
  deleted_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contribution_logs_user_id ON contribution_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_contribution_logs_unit_id ON contribution_logs(unit_id);
CREATE INDEX IF NOT EXISTS idx_contribution_logs_product_id ON contribution_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_contribution_logs_operation_date ON contribution_logs(operation_date);
