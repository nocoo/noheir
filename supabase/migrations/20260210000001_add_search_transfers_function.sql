-- ============================================================================
-- Migration: Add search_transfers_fuzzy RPC function
-- Date: 2026-02-10
-- Description: Fuzzy search for transfers table, mirrors search_transactions_fuzzy
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Indexes for transfers search performance
-- ----------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE INDEX IF NOT EXISTS "idx_transfers_tags" ON "public"."transfers" USING "gin" ("tags");

CREATE INDEX IF NOT EXISTS "idx_transfers_note_trgm" ON "public"."transfers" USING "gin" ("note" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_transfers_user_date" ON "public"."transfers" USING "btree" ("user_id", "date" DESC);


-- ----------------------------------------------------------------------------
-- Function: search_transfers_fuzzy
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."search_transfers_fuzzy"(
  p_keyword TEXT DEFAULT NULL,
  p_accounts TEXT[] DEFAULT NULL,
  p_transaction_type TEXT DEFAULT NULL,
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
  transaction_type TEXT,
  inflow_amount NUMERIC,
  outflow_amount NUMERIC,
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
    t.transaction_type,
    t.inflow_amount,
    t.outflow_amount,
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
  FROM "transfers" t
  WHERE t.user_id = auth.uid()
    -- Keyword search (fuzzy match in note, category, account)
    AND (p_keyword IS NULL
      OR t.note ILIKE '%' || p_keyword || '%'
      OR t.primary_category ILIKE '%' || p_keyword || '%'
      OR t.secondary_category ILIKE '%' || p_keyword || '%'
      OR t.account ILIKE '%' || p_keyword || '%'
    )
    -- Account filter
    AND (p_accounts IS NULL OR t.account = ANY(p_accounts))
    -- Transaction type filter
    AND (p_transaction_type IS NULL OR t.transaction_type = p_transaction_type)
    -- Tags filter
    AND (p_tags IS NULL OR t.tags && p_tags)
    -- Date range filter
    AND (p_start_date IS NULL OR t.date >= p_start_date)
    AND (p_end_date IS NULL OR t.date <= p_end_date)
    -- Amount range filter: match on GREATEST(inflow, outflow)
    AND (p_min_amount IS NULL OR GREATEST(t.inflow_amount, t.outflow_amount) >= p_min_amount)
    AND (p_max_amount IS NULL OR GREATEST(t.inflow_amount, t.outflow_amount) <= p_max_amount)
    -- Year/month filter
    AND (p_year IS NULL OR t.year = p_year)
    AND (p_month IS NULL OR t.month = p_month)
    -- Currency filter
    AND (p_currency IS NULL OR t.currency = p_currency)
  ORDER BY t.date DESC, t.created_at DESC
  LIMIT v_limit OFFSET p_offset;
END;
$$;


-- ----------------------------------------------------------------------------
-- Grant Permissions
-- ----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION "public"."search_transfers_fuzzy" TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."search_transfers_fuzzy" TO "service_role";


COMMENT ON FUNCTION "public"."search_transfers_fuzzy" IS
'Fuzzy search transfers with filters including keyword, account, transaction_type, tags, date range, amount range, year, month, currency. Amount range matches on GREATEST(inflow_amount, outflow_amount). Enforces user isolation via auth.uid(). Results limited to 500 max per query.';
