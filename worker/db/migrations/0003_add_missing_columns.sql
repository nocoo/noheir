-- Migration: Add missing columns to various tables
-- Note: is_archived was added manually to production before this migration existed

-- financial_products: add updated_at (is_archived may already exist in some envs)
-- Using separate statements so partial application is possible
ALTER TABLE financial_products ADD COLUMN updated_at INTEGER;

-- capital_units: add updated_at
ALTER TABLE capital_units ADD COLUMN updated_at INTEGER;

-- Update existing rows to have updated_at = created_at
UPDATE financial_products SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE capital_units SET updated_at = created_at WHERE updated_at IS NULL;
