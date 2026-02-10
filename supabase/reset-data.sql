-- =============================================================================
-- Reset all user data and auth users from the local Supabase instance.
--
-- Usage:
--   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/reset-data.sql
--
-- This script:
--   1. Truncates all application tables (respects FK order via CASCADE)
--   2. Deletes all auth users
--   3. Resets identity sequences
--
-- WARNING: This is destructive and irreversible. Local dev use only.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Truncate all application tables
--    CASCADE handles FK dependencies (e.g. capital_units -> financial_products)
-- ---------------------------------------------------------------------------
TRUNCATE TABLE
  capital_units,
  financial_products,
  transactions,
  transfers,
  settings
CASCADE;

-- ---------------------------------------------------------------------------
-- 2. Delete all auth users
--    This removes entries from auth.users and all related auth tables
--    (sessions, refresh_tokens, identities, etc.) via CASCADE.
-- ---------------------------------------------------------------------------
DELETE FROM auth.users;

-- ---------------------------------------------------------------------------
-- 3. Reset the settings identity sequence back to 1
-- ---------------------------------------------------------------------------
ALTER SEQUENCE settings_id_seq RESTART WITH 1;

COMMIT;

-- Confirm
SELECT 'All data cleared.' AS status;
