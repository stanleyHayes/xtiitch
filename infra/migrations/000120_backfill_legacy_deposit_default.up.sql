-- 000120_backfill_legacy_deposit_default
--
-- Migration 000116 lowered the column default and constraints to GHS 1, but
-- deliberately left existing businesses on the original GHS 100 seed. There
-- is no store-default deposit editor, so GHS 100 rows are untouched legacy
-- defaults rather than owner choices. Bring them in line with the documented
-- blank/unset fallback: GHS 1, never zero.

update businesses
set default_deposit_minor = 100
where default_deposit_minor = 10000;
