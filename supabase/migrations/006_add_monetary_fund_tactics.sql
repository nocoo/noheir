-- ============================================================================
-- Add '货币基金' to InvestmentTactics enum constraint
-- ============================================================================

-- Step 1: Drop the existing check constraint
ALTER TABLE capital_units DROP CONSTRAINT IF EXISTS capital_units_tactics_check;

-- Step 2: Add the check constraint with '货币基金' included
ALTER TABLE capital_units
  ADD CONSTRAINT capital_units_tactics_check
  CHECK (tactics IN (
    '养老年金',
    '个人养老金',
    '定期存款',
    '理财产品',
    '现金产品',
    '债券基金',
    '偏股基金',
    '稳健理财',
    '增额寿险',
    '货币基金'  -- NEW: Added for monetary funds
  ));

-- Step 3: Update the TypeScript type definition (manual step required)
-- The file src/types/assets.ts should be updated to include '货币基金' in InvestmentTactics
