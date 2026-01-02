-- Migration: Add note field to get_units_with_products function
-- Date: 2025-01-02

-- Step 1: Drop the existing function
DROP FUNCTION IF EXISTS "public"."get_units_with_products"();

-- Step 2: Recreate with note field included
CREATE OR REPLACE FUNCTION "public"."get_units_with_products"()
RETURNS TABLE(
  "id" "uuid",
  "user_id" "uuid",
  "unit_code" "text",
  "amount" numeric,
  "currency" "text",
  "status" "text",
  "strategy" "text",
  "tactics" "text",
  "product_id" "uuid",
  "start_date" "date",
  "end_date" "date",
  "note" "text",
  "created_at" timestamp with time zone,
  "product" "jsonb"
)
LANGUAGE "plpgsql"
SET "search_path" TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.user_id,
    u.unit_code,
    u.amount,
    u.currency,
    u.status,
    u.strategy,
    u.tactics,
    u.product_id,
    u.start_date,
    u.end_date,
    u.note,
    u.created_at,
    to_jsonb(p) AS product
  FROM capital_units u
  LEFT JOIN financial_products p ON u.product_id = p.id
  WHERE u.user_id = auth.uid()
  ORDER BY u.created_at DESC;
END;
$$;

-- Step 3: Grant permissions
GRANT ALL ON FUNCTION "public"."get_units_with_products"() TO "authenticated", "service_role";
