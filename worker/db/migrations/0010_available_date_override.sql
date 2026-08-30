-- Manual unlock date on a capital unit.
-- Availability is derived from latest invest + product lock. After 番号对换 /
-- 产品切换 the formula can disagree with the real remaining lock of the same
-- money; this column pins the first available date without rewriting invest logs.

ALTER TABLE capital_units ADD COLUMN available_date_override TEXT;
