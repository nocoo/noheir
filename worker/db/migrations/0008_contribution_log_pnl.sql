-- 003 Unit Commit & Log Enrichment — pnl_cents
-- Spec: docs/003-unit-commit-and-log-enrichment.md § Data Model
-- Nullable, no default: existing rows stay NULL ("存量不管").
-- amount_cents = principal movement; pnl_cents = realized gain/loss.

ALTER TABLE contribution_logs ADD COLUMN pnl_cents INTEGER;
