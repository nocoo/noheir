-- ============================================================================
-- Migration: Add get_financial_metadata RPC function
-- Date: 2026-02-10
-- Description: Server-side aggregation of distinct metadata (years, accounts,
--   categories, currencies, tags, counts) from transactions + transfers.
--   Replaces client-side deduplication which was silently truncated by
--   PostgREST max_rows=1000 limit.
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

GRANT EXECUTE ON FUNCTION "public"."get_financial_metadata" TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_financial_metadata" TO "service_role";

COMMENT ON FUNCTION "public"."get_financial_metadata" IS
'Returns distinct metadata (years, accounts, categories, currencies, tags, counts) aggregated server-side from transactions + transfers. Enforces user isolation via auth.uid(). Single RPC call replaces multiple truncation-prone PostgREST queries.';
