-- ============================================================================
-- Migration: Add get_monthly_report RPC function
-- Date: 2026-02-10
-- Description: Server-side monthly aggregation returning income/expense totals,
--   net amount, transaction/transfer counts, and top categories breakdown.
--   Accepts year + month as required parameters, optional currency filter.
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."get_monthly_report"(
  p_year     INTEGER,
  p_month    INTEGER,
  p_currency TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE "plpgsql"
SET "search_path" TO 'public'
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'year', p_year,
    'month', p_month,

    -- Income total
    'total_income', (
      SELECT COALESCE(SUM(amount), 0)
      FROM transactions
      WHERE user_id = auth.uid()
        AND year = p_year AND month = p_month
        AND type = 'income'
        AND (p_currency IS NULL OR currency = p_currency)
    ),

    -- Expense total
    'total_expense', (
      SELECT COALESCE(SUM(amount), 0)
      FROM transactions
      WHERE user_id = auth.uid()
        AND year = p_year AND month = p_month
        AND type = 'expense'
        AND (p_currency IS NULL OR currency = p_currency)
    ),

    -- Net = income - expense
    'net_amount', (
      SELECT COALESCE(SUM(
        CASE WHEN type = 'income' THEN amount
             WHEN type = 'expense' THEN -amount
             ELSE 0 END
      ), 0)
      FROM transactions
      WHERE user_id = auth.uid()
        AND year = p_year AND month = p_month
        AND (p_currency IS NULL OR currency = p_currency)
    ),

    -- Transaction count
    'transaction_count', (
      SELECT count(*)
      FROM transactions
      WHERE user_id = auth.uid()
        AND year = p_year AND month = p_month
        AND (p_currency IS NULL OR currency = p_currency)
    ),

    -- Transfer count
    'transfer_count', (
      SELECT count(*)
      FROM transfers
      WHERE user_id = auth.uid()
        AND year = p_year AND month = p_month
        AND (p_currency IS NULL OR currency = p_currency)
    ),

    -- Transfer inflow total
    'total_transfer_in', (
      SELECT COALESCE(SUM(inflow_amount), 0)
      FROM transfers
      WHERE user_id = auth.uid()
        AND year = p_year AND month = p_month
        AND (p_currency IS NULL OR currency = p_currency)
    ),

    -- Transfer outflow total
    'total_transfer_out', (
      SELECT COALESCE(SUM(outflow_amount), 0)
      FROM transfers
      WHERE user_id = auth.uid()
        AND year = p_year AND month = p_month
        AND (p_currency IS NULL OR currency = p_currency)
    ),

    -- Top expense categories (by total amount, descending)
    'expense_by_category', (
      SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.total DESC), '[]'::json)
      FROM (
        SELECT primary_category AS category, SUM(amount) AS total, count(*) AS count
        FROM transactions
        WHERE user_id = auth.uid()
          AND year = p_year AND month = p_month
          AND type = 'expense'
          AND (p_currency IS NULL OR currency = p_currency)
        GROUP BY primary_category
      ) sub
    ),

    -- Top income categories (by total amount, descending)
    'income_by_category', (
      SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.total DESC), '[]'::json)
      FROM (
        SELECT primary_category AS category, SUM(amount) AS total, count(*) AS count
        FROM transactions
        WHERE user_id = auth.uid()
          AND year = p_year AND month = p_month
          AND type = 'income'
          AND (p_currency IS NULL OR currency = p_currency)
        GROUP BY primary_category
      ) sub
    ),

    -- Currencies involved this month (for multi-currency awareness)
    'currencies', (
      SELECT COALESCE(json_agg(DISTINCT c ORDER BY c), '[]'::json)
      FROM (
        SELECT currency AS c FROM transactions
        WHERE user_id = auth.uid() AND year = p_year AND month = p_month
        UNION
        SELECT currency AS c FROM transfers
        WHERE user_id = auth.uid() AND year = p_year AND month = p_month
      ) sub
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION "public"."get_monthly_report"(INTEGER, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION "public"."get_monthly_report"(INTEGER, INTEGER, TEXT) TO service_role;

COMMENT ON FUNCTION "public"."get_monthly_report"(INTEGER, INTEGER, TEXT) IS
'Monthly financial report with income/expense totals, net amount, transfer flows, category breakdowns, and currency list. Requires year + month. Optional currency filter for multi-currency users.';
