-- ============================================================================
-- Migration: Enhance get_financial_metadata with sub-category lists
-- Date: 2026-02-10
-- Description: Adds secondary_categories and tertiary_categories arrays
--   so AI agents can discover all available filter values before querying.
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."get_financial_metadata"()
RETURNS JSON
LANGUAGE "plpgsql"
SET "search_path" TO 'public'
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'years', (
      SELECT COALESCE(json_agg(y ORDER BY y DESC), '[]'::json)
      FROM (
        SELECT DISTINCT year AS y FROM transactions WHERE user_id = auth.uid()
        UNION
        SELECT DISTINCT year AS y FROM transfers WHERE user_id = auth.uid()
      ) sub
    ),
    'accounts', (
      SELECT COALESCE(json_agg(a ORDER BY a), '[]'::json)
      FROM (
        SELECT DISTINCT account AS a FROM transactions WHERE user_id = auth.uid()
        UNION
        SELECT DISTINCT account AS a FROM transfers WHERE user_id = auth.uid()
      ) sub
    ),
    'categories', (
      SELECT COALESCE(json_agg(c ORDER BY c), '[]'::json)
      FROM (
        SELECT DISTINCT primary_category AS c FROM transactions WHERE user_id = auth.uid()
      ) sub
    ),
    'secondary_categories', (
      SELECT COALESCE(json_agg(c ORDER BY c), '[]'::json)
      FROM (
        SELECT DISTINCT secondary_category AS c FROM transactions
        WHERE user_id = auth.uid()
          AND secondary_category IS NOT NULL AND secondary_category != ''
      ) sub
    ),
    'tertiary_categories', (
      SELECT COALESCE(json_agg(c ORDER BY c), '[]'::json)
      FROM (
        SELECT DISTINCT tertiary_category AS c FROM transactions
        WHERE user_id = auth.uid()
          AND tertiary_category IS NOT NULL AND tertiary_category != ''
      ) sub
    ),
    'currencies', (
      SELECT COALESCE(json_agg(c ORDER BY c), '[]'::json)
      FROM (
        SELECT DISTINCT currency AS c FROM transactions WHERE user_id = auth.uid()
        UNION
        SELECT DISTINCT currency AS c FROM transfers WHERE user_id = auth.uid()
      ) sub
    ),
    'tags', (
      SELECT COALESCE(json_agg(t ORDER BY t), '[]'::json)
      FROM (
        SELECT DISTINCT unnest(tags) AS t FROM transactions WHERE user_id = auth.uid()
        UNION
        SELECT DISTINCT unnest(tags) AS t FROM transfers WHERE user_id = auth.uid()
      ) sub
    ),
    'transaction_count', (
      SELECT count(*) FROM transactions WHERE user_id = auth.uid()
    ),
    'transfer_count', (
      SELECT count(*) FROM transfers WHERE user_id = auth.uid()
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION "public"."get_financial_metadata" IS
'Returns distinct metadata (years, accounts, categories at 3 levels, currencies, tags, counts) aggregated server-side. AI agents should call this first to discover available filter values before using query_transactions or query_transfers.';
