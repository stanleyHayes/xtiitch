-- Make tenant isolation enforced by the database, not only the application.
--
-- Two changes:
--  1. A dedicated, NON-superuser application role. Migrations run as the owner
--     (a superuser, which bypasses RLS); the API connects as this role, for
--     which row-level security is actually enforced. FORCE on each table is
--     belt-and-suspenders should ownership ever change.
--  2. Every tenant policy gains an explicit `xtiitch.bypass` escape used only by
--     the handful of legitimately cross-tenant credential lookups (login by
--     handle, refresh by token hash, webhook lookup by provider reference).
--     A query that forgets to set a scope and does not set bypass now returns
--     no rows (fail-closed) instead of leaking another business's data.

DO $$
DECLARE
  tenant_table text;
  policy_using text := '(current_setting(''xtiitch.bypass'', true) = ''on'''
    || ' OR business_id = NULLIF(current_setting(''xtiitch.current_business_id'', true), '''')::uuid)';
BEGIN
  FOREACH tenant_table IN ARRAY ARRAY[
    'businesses', 'store_settings', 'business_users', 'customer_businesses',
    'auth_sessions', 'payments', 'manual_takings'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tenant_table || '_tenant_isolation', tenant_table);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING %s WITH CHECK %s',
      tenant_table || '_tenant_isolation', tenant_table, policy_using, policy_using
    );
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tenant_table);
  END LOOP;
END $$;

-- The application role. The dev password here is for local development only;
-- production must provision this role's credentials through infrastructure, not
-- this committed migration.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'xtiitch_app') THEN
    CREATE ROLE xtiitch_app LOGIN PASSWORD 'xtiitch_app'
      NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO xtiitch_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO xtiitch_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO xtiitch_app;
