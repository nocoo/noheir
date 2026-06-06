-- 002 Recurring Expense Calendar — DB layer
-- Spec: docs/002-recurring-expense-calendar.md § Data Model
-- Adds two tables behind the same foreign_keys = ON pragma already in use
-- by prior migrations (D1 default since 2024-09).

-- ============================================================================
-- expense_categories
-- ============================================================================

CREATE TABLE IF NOT EXISTS expense_categories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color_token TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- (user_id, name) uniqueness — surfaced as 409 by the repository layer.
CREATE UNIQUE INDEX IF NOT EXISTS expense_categories_user_name_uniq
  ON expense_categories (user_id, name);

-- ============================================================================
-- recurring_expenses
-- ============================================================================
-- ON DELETE SET NULL for category_id: deleting a category nulls out the FK
-- on referring rules, leaving the rules themselves intact. Repository layer
-- explicitly tests this behaviour to guard against environment differences.

CREATE TABLE IF NOT EXISTS recurring_expenses (
  id TEXT PRIMARY KEY,
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
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
