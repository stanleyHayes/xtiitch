-- Restore the pre-hardening policies (no bypass clause, no FORCE) and remove the
-- application role.

DO $$
DECLARE
  tenant_table text;
  policy_using text := '(business_id = NULLIF(current_setting(''xtiitch.current_business_id'', true), '''')::uuid)';
BEGIN
  FOREACH tenant_table IN ARRAY ARRAY[
    'businesses', 'store_settings', 'business_users', 'customer_businesses',
    'auth_sessions', 'payments', 'manual_takings'
  ] LOOP
    EXECUTE format('ALTER TABLE %I NO FORCE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tenant_table || '_tenant_isolation', tenant_table);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING %s WITH CHECK %s',
      tenant_table || '_tenant_isolation', tenant_table, policy_using, policy_using
    );
  END LOOP;
END $$;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM xtiitch_app;
REVOKE SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM xtiitch_app;
REVOKE USAGE ON SCHEMA public FROM xtiitch_app;
DROP ROLE IF EXISTS xtiitch_app;
