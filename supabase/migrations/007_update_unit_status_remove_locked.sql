-- ============================================================================
-- Migration 007: Update unit status - remove '锁定期', add '已归档'
-- ============================================================================

-- Step 1: Change all '锁定期' status to '已成立'
-- This preserves all existing data while changing the status
UPDATE capital_units
SET status = '已成立'
WHERE status = '锁定期';

-- Step 2: Update the check constraint to remove '锁定期' and add '已归档'
-- First, drop the existing constraint
ALTER TABLE capital_units DROP CONSTRAINT IF EXISTS capital_units_status_check;

-- Step 3: Add the new check constraint with updated statuses
ALTER TABLE capital_units
  ADD CONSTRAINT capital_units_status_check
  CHECK (status IN (
    '已成立',   -- Idle - Available for deployment
    '计划中',   -- Planned
    '筹集中',   -- Raising
    '已归档'    -- Archived
  ));

-- Step 4: The 'end_date' column will be kept for reference but won't be displayed in the UI
-- No action needed on the column itself

-- Step 5: Verify the changes
-- Run this to check the status distribution:
-- SELECT status, COUNT(*) as count FROM capital_units GROUP BY status;
