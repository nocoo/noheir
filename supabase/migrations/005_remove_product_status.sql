-- Remove status column from financial_products table
-- 产品状态应根据是否有关联的资金单元动态计算，不需要存储

-- Step 1: Drop the status column
ALTER TABLE financial_products
DROP COLUMN IF EXISTS status;

-- Step 2: Drop the check constraint for status
ALTER TABLE financial_products
DROP CONSTRAINT IF EXISTS financial_products_status_check;

-- Note: Product status is now derived from capital_units:
-- - '投资中': has at least one associated capital_unit with status '已成立'
-- - '已退出': no associated capital_units or all units are archived
