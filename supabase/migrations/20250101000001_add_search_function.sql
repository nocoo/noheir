-- ============================================================================
-- Migration: Add Fuzzy Search Function and Performance Indexes
-- Date: 2025-01-01
-- Description: Adds search_transactions_fuzzy function and GIN indexes for AI agent
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Indexes for Performance Optimization
-- ----------------------------------------------------------------------------

-- GIN index for tags array (supports @> contains operator)
CREATE INDEX IF NOT EXISTS "idx_transactions_tags" ON "public"."transactions" USING "gin" ("tags");

-- GIN index for note (supports trigram fuzzy search)
-- Requires pg_trgm extension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE INDEX IF NOT EXISTS "idx_transactions_note_trgm" ON "public"."transactions" USING "gin" ("note" gin_trgm_ops);

-- B-tree index for account (exact match and sorting)
CREATE INDEX IF NOT EXISTS "idx_transactions_account" ON "public"."transactions" USING "btree" ("account");

-- Composite index for common query patterns (user + type + date)
CREATE INDEX IF NOT EXISTS "idx_transactions_user_type_date" ON "public"."transactions" USING "btree" ("user_id", "type", "date" DESC);


-- ----------------------------------------------------------------------------
-- Function: search_transactions_fuzzy
-- ----------------------------------------------------------------------------
-- Purpose: Fuzzy search transactions with multiple filters
-- Security: Uses auth.uid() to enforce user isolation
-- Performance: Uses indexes, supports pagination
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."search_transactions_fuzzy"(
  p_keyword TEXT DEFAULT NULL,           -- Keyword to search in note/category/account
  p_categories TEXT[] DEFAULT NULL,      -- Filter by primary_category (exact match)
  p_type TEXT DEFAULT NULL,              -- Filter by type (income/expense/transfer)
  p_accounts TEXT[] DEFAULT NULL,        -- Filter by accounts
  p_tags TEXT[] DEFAULT NULL,            -- Filter by tags (any match)
  p_start_date TEXT DEFAULT NULL,        -- Start date (YYYY-MM-DD)
  p_end_date TEXT DEFAULT NULL,          -- End date (YYYY-MM-DD)
  p_min_amount NUMERIC DEFAULT NULL,     -- Minimum amount
  p_max_amount NUMERIC DEFAULT NULL,     -- Maximum amount
  p_limit INTEGER DEFAULT 50,            -- Max results (default 50, max 500)
  p_offset INTEGER DEFAULT 0             -- Offset for pagination
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
  matched_field TEXT                    -- Which field matched the keyword
)
LANGUAGE "plpgsql"
SET "search_path" TO 'public'
AS $$
DECLARE
  v_limit INTEGER;
BEGIN
  -- Safety limit: cap at 500 to prevent excessive queries
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
    -- Determine which field matched the keyword (for UI highlighting)
    CASE
      WHEN p_keyword IS NOT NULL AND t.note ILIKE '%' || p_keyword || '%' THEN 'note'
      WHEN p_keyword IS NOT NULL AND t.primary_category ILIKE '%' || p_keyword || '%' THEN 'category'
      WHEN p_keyword IS NOT NULL AND t.account ILIKE '%' || p_keyword || '%' THEN 'account'
      ELSE NULL
    END AS matched_field
  FROM "transactions" t
  WHERE t.user_id = auth.uid()
    -- Keyword search (fuzzy match in note, category, account)
    AND (p_keyword IS NULL
      OR t.note ILIKE '%' || p_keyword || '%'
      OR t.primary_category ILIKE '%' || p_keyword || '%'
      OR t.secondary_category ILIKE '%' || p_keyword || '%'
      OR t.tertiary_category ILIKE '%' || p_keyword || '%'
      OR t.account ILIKE '%' || p_keyword || '%'
    )
    -- Category filter (exact match, any of the provided)
    AND (p_categories IS NULL OR t.primary_category = ANY(p_categories))
    -- Type filter (exact match)
    AND (p_type IS NULL OR t.type = p_type)
    -- Account filter (exact match, any of the provided)
    AND (p_accounts IS NULL OR t.account = ANY(p_accounts))
    -- Tags filter (any match: tags array contains any of p_tags)
    AND (p_tags IS NULL OR t.tags && p_tags)
    -- Date range filter
    AND (p_start_date IS NULL OR t.date >= p_start_date)
    AND (p_end_date IS NULL OR t.date <= p_end_date)
    -- Amount range filter
    AND (p_min_amount IS NULL OR t.amount >= p_min_amount)
    AND (p_max_amount IS NULL OR t.amount <= p_max_amount)
  ORDER BY t.date DESC, t.created_at DESC
  LIMIT v_limit OFFSET p_offset;
END;
$$;


-- ----------------------------------------------------------------------------
-- Grant Permissions
-- ----------------------------------------------------------------------------
-- authenticated role can execute the function (RLS enforced inside)
GRANT EXECUTE ON FUNCTION "public"."search_transactions_fuzzy" TO "authenticated";

-- service_role has full access
GRANT EXECUTE ON FUNCTION "public"."search_transactions_fuzzy" TO "service_role";


-- ----------------------------------------------------------------------------
-- Comments for Documentation
-- ----------------------------------------------------------------------------
COMMENT ON FUNCTION "public"."search_transactions_fuzzy" IS
'Fuzzy search transactions for AI agent. Supports keyword search in note/category/account, with filters for type, accounts, tags, date range, and amount range. Enforces user isolation via auth.uid(). Results limited to 500 max per query.';
