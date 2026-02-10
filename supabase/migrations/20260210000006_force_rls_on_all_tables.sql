-- ============================================================================
-- Migration: Force Row Level Security on all tables
-- Date: 2026-02-10
-- Description: Adds FORCE ROW LEVEL SECURITY so that even the table owner
--   (postgres role) cannot bypass RLS. Defense-in-depth measure.
-- ============================================================================

ALTER TABLE "public"."financial_products" FORCE ROW LEVEL SECURITY;
ALTER TABLE "public"."capital_units" FORCE ROW LEVEL SECURITY;
ALTER TABLE "public"."transactions" FORCE ROW LEVEL SECURITY;
ALTER TABLE "public"."transfers" FORCE ROW LEVEL SECURITY;
ALTER TABLE "public"."settings" FORCE ROW LEVEL SECURITY;
