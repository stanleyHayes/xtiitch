-- 000121_backfill_legacy_deposit_default_rls
--
-- Migration 000120 ran under the restricted application role. Businesses has
-- FORCE RLS, so that update could not see tenant rows. Repeat the targeted
-- legacy-default backfill using the same explicit bypass convention as other
-- cross-tenant data migrations, then immediately turn the bypass off.

select set_config('xtiitch.bypass', 'on', false);

update businesses
set default_deposit_minor = 100
where default_deposit_minor = 10000;

select set_config('xtiitch.bypass', 'off', false);
