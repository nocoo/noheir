-- ============================================================================
-- 🔒 SECURITY FIX - Execute this immediately in Supabase Dashboard
-- ============================================================================
--
-- WHAT THIS DOES:
-- 1. Revokes excessive permissions from 'anon' (unauthenticated users)
-- 2. Fixes default privileges for future tables
--
-- EXECUTION:
-- 1. Go to: https://supabase.com/dashboard/project/ovglfjkumvzxyhklohst/sql/new
-- 2. Paste this entire script
-- 3. Click "Run"
--
-- VERIFICATION (after running):
-- SELECT table_name, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE grantee = 'anon' AND table_schema = 'public';
-- Expected: 0 rows

-- ============================================================================

-- Step 1: Revoke ALL on tables from anon
REVOKE ALL ON TABLE "public"."capital_units" FROM "anon";
REVOKE ALL ON TABLE "public"."financial_products" FROM "anon";
REVOKE ALL ON TABLE "public"."transactions" FROM "anon";
REVOKE ALL ON TABLE "public"."settings" FROM "anon";

-- Step 2: Revoke ALL on sequences from anon
REVOKE ALL ON SEQUENCE "public"."site_metadata_id_seq" FROM "anon";

-- Step 3: Revoke ALL on functions from anon
REVOKE ALL ON FUNCTION "public"."get_units_with_products"() FROM "anon";

-- Step 4: Fix default privileges (prevents future tables from being vulnerable)
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public"
  REVOKE ALL ON TABLES FROM "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public"
  REVOKE ALL ON SEQUENCES FROM "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public"
  REVOKE ALL ON FUNCTIONS FROM "anon";

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================
-- Run this after the fix to verify:

/*
-- Should return 0 rows (no anon permissions)
SELECT
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'anon'
  AND table_schema = 'public'
ORDER BY table_name, privilege_type;

-- Should show all tables for authenticated users
SELECT
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'authenticated'
  AND table_schema = 'public'
ORDER BY table_name, privilege_type;
*/
