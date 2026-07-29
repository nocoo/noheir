-- Backfill the missing initial invest logs for R29-R32.
-- These units were created with a product already attached, before
-- POST /api/units learned to write this log, so availability rendered as
-- "状态未知". operation_date = each unit's creation day (== its start_date).
-- Guarded by NOT EXISTS so a re-run is a no-op.

INSERT INTO contribution_logs
  (id, user_id, unit_id, product_id, product_name, operation_type,
   amount_cents, operation_date, source, note, created_at, updated_at)
SELECT
  lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
  substr(lower(hex(randomblob(2))), 2) || '-a' ||
  substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
  u.user_id,
  u.id,
  u.product_id,
  p.name,
  'invest',
  u.amount_cents,
  u.start_date,
  'import',
  'Backfill: initial investment, reconstructed from unit creation date',
  unixepoch() * 1000,
  unixepoch() * 1000
FROM capital_units u
JOIN financial_products p ON p.id = u.product_id
WHERE u.unit_code IN ('R29', 'R30', 'R31', 'R32')
  AND u.status = '已成立'
  AND u.product_id IS NOT NULL
  AND u.start_date IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM contribution_logs c
    WHERE c.unit_id = u.id AND c.deleted_at IS NULL
  );
