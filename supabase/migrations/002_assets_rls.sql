-- ============================================================================
-- Capital Asset Management RLS Policies
-- ============================================================================

-- Enable RLS on both tables
ALTER TABLE financial_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE capital_units ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Financial Products RLS Policies
-- ============================================================================

-- Users can view their own products
CREATE POLICY "Users can view own financial_products"
ON financial_products
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own products
CREATE POLICY "Users can insert own financial_products"
ON financial_products
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own products
CREATE POLICY "Users can update own financial_products"
ON financial_products
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own products
CREATE POLICY "Users can delete own financial_products"
ON financial_products
FOR DELETE
USING (auth.uid() = user_id);

-- ============================================================================
-- Capital Units RLS Policies
-- ============================================================================

-- Users can view their own units
CREATE POLICY "Users can view own capital_units"
ON capital_units
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own units
CREATE POLICY "Users can insert own capital_units"
ON capital_units
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own units
CREATE POLICY "Users can update own capital_units"
ON capital_units
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own units
CREATE POLICY "Users can delete own capital_units"
ON capital_units
FOR DELETE
USING (auth.uid() = user_id);
