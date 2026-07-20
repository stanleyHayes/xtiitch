-- Revert 000112: remove the internal scheduler system actor. Audit and billing
-- event rows that already reference it keep their history (the foreign keys
-- are ON DELETE SET NULL).

delete from admin_users
where admin_user_id = '00000000-0000-0000-0000-000000000001';
