-- ============================================================================
-- RPC Function: Get Units with Products
-- Returns capital units with their associated financial product details
-- ============================================================================

CREATE OR REPLACE FUNCTION get_units_with_products()
RETURNS TABLE (
  -- Unit fields
  id UUID,
  user_id UUID,
  unit_code TEXT,
  amount NUMERIC,
  currency TEXT,
  status TEXT,
  strategy TEXT,
  tactics TEXT,
  product_id UUID,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ,
  -- Product fields (prefixed to avoid name collision)
  product JSONB
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
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
    u.created_at,
    to_jsonb(p) AS product
  FROM capital_units u
  LEFT JOIN financial_products p ON u.product_id = p.id
  WHERE u.user_id = auth.uid()
  ORDER BY u.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_units_with_products() TO authenticated;
