-- Migration: Add is_archived column to financial_products
-- Note: is_archived was added manually to production before any migration
-- existed (see 0003 header comment). This migration brings fresh
-- environments (local dev, CI test DBs) in line with the schema in
-- worker/db/schema.ts so the column actually exists.

ALTER TABLE financial_products ADD COLUMN is_archived INTEGER DEFAULT 0;

-- Backfill: treat any pre-existing rows as not archived.
UPDATE financial_products SET is_archived = 0 WHERE is_archived IS NULL;
