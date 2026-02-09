-- ============================================================================
-- Migration: Enhance search_transactions_fuzzy with year/month/currency filters
-- Date: 2026-02-10
-- Description: Adds p_year, p_month, p_currency parameters to support MCP queries
-- ============================================================================

-- Drop old function signature (11 params) before creating new one (14 params)
DROP FUNCTION IF EXISTS "public"."search_transactions_fuzzy"(
  TEXT, TEXT[], TEXT, TEXT[], TEXT[], TEXT, TEXT, NUMERIC, NUMERIC, INTEGER, INTEGER
);

CREATE OR REPLACE FUNCTION "public"."search_transactions_fuzzy"(
  p_keyword TEXT DEFAULT NULL,
  p_categories TEXT[] DEFAULT NULL,
  p_type TEXT DEFAULT NULL,
  p_accounts TEXT[] DEFAULT NULL,
  p_tags TEXT[] DEFAULT NULL,
  p_start_date TEXT DEFAULT NULL,
  p_end_date TEXT DEFAULT NULL,
  p_min_amount NUMERIC DEFAULT NULL,
  p_max_amount NUMERIC DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_year INTEGER DEFAULT NULL,
  p_month INTEGER DEFAULT NULL,
  p_currency TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  date TEXT,
  year INTEGER,
  month INTEGER,
  day INTEGER,
  primary_category TEXT,
  secondary_category TEXT,
  tertiary_category TEXT,
  amount NUMERIC,
  type TEXT,
  account TEXT,
  currency TEXT,
  tags TEXT[],
  note TEXT,
  matched_field TEXT
)
LANGUAGE "plpgsql"
SET "search_path" TO 'public'
AS $$
DECLARE
  v_limit INTEGER;
BEGIN
  v_limit := LEAST(GREATEST(p_limit, 1), 500);

  RETURN QUERY
  SELECT
    t.id,
    t.date,
    t.year,
    t.month,
    t.day,
    t.primary_category,
    t.secondary_category,
    t.tertiary_category,
    t.amount,
    t.type,
    t.account,
    t.currency,
    t.tags,
    t.note,
    CASE
      WHEN p_keyword IS NOT NULL AND t.note ILIKE '%' || p_keyword || '%' THEN 'note'
      WHEN p_keyword IS NOT NULL AND t.primary_category ILIKE '%' || p_keyword || '%' THEN 'category'
      WHEN p_keyword IS NOT NULL AND t.account ILIKE '%' || p_keyword || '%' THEN 'account'
      ELSE NULL
    END AS matched_field
  FROM "transactions" t
  WHERE t.user_id = auth.uid()
    AND (p_keyword IS NULL
      OR t.note ILIKE '%' || p_keyword || '%'
      OR t.primary_category ILIKE '%' || p_keyword || '%'
      OR t.secondary_category ILIKE '%' || p_keyword || '%'
      OR t.tertiary_category ILIKE '%' || p_keyword || '%'
      OR t.account ILIKE '%' || p_keyword || '%'
    )
    AND (p_categories IS NULL OR t.primary_category = ANY(p_categories))
    AND (p_type IS NULL OR t.type = p_type)
    AND (p_accounts IS NULL OR t.account = ANY(p_accounts))
    AND (p_tags IS NULL OR t.tags && p_tags)
    AND (p_start_date IS NULL OR t.date >= p_start_date)
    AND (p_end_date IS NULL OR t.date <= p_end_date)
    AND (p_min_amount IS NULL OR t.amount >= p_min_amount)
    AND (p_max_amount IS NULL OR t.amount <= p_max_amount)
    AND (p_year IS NULL OR t.year = p_year)
    AND (p_month IS NULL OR t.month = p_month)
    AND (p_currency IS NULL OR t.currency = p_currency)
  ORDER BY t.date DESC, t.created_at DESC
  LIMIT v_limit OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION "public"."search_transactions_fuzzy"(
  TEXT, TEXT[], TEXT, TEXT[], TEXT[], TEXT, TEXT, NUMERIC, NUMERIC, INTEGER, INTEGER, INTEGER, INTEGER, TEXT
) IS
'Fuzzy search transactions with filters including year, month, and currency. Enforces user isolation via auth.uid(). Results limited to 500 max per query.';
