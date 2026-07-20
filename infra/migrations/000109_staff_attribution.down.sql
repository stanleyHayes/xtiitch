-- Revert 000109: drop the §14.1 staff-attribution columns.
ALTER TABLE orders DROP COLUMN IF EXISTS created_by_business_user_id;
ALTER TABLE manual_takings DROP COLUMN IF EXISTS logged_by_business_user_id;
