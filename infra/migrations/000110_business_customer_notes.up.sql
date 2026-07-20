-- §15.1 "Notes on a customer (e.g. 'prefers loose fit')" — Starter and above.
-- One free-text note per (business, customer): the owner annotates THEIR view
-- of a customer, so the note is tenant-owned even though the customer identity
-- itself is global (§15.3 one customer record — the note can never live on the
-- shared customers row, or one store would read another store's annotations).
-- Gating is NOT enforced here: notes are a crm_level >= 1 capability from the
-- plan entitlement matrix (§11.1/§15.3 admin-configurable), checked live by the
-- application on every read and write.

CREATE TABLE business_customer_notes (
  business_id uuid NOT NULL REFERENCES businesses (business_id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers (customer_id) ON DELETE CASCADE,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, customer_id)
);

COMMENT ON TABLE business_customer_notes IS
  '§15.1 owner free-text note per (business, customer); crm_level >= 1, enforced by the application. Tenant-owned annotation over the global customer identity.';

-- Tenant isolation under the project's hardened RLS shape (bypass-clause +
-- FORCE), copied from 000108: the owner reads/writes only their own notes
-- under tenant scope; the business-delete cascade cleans up by business_id.
DO $$
DECLARE
  tenant_table text;
  policy_using text := '(current_setting(''xtiitch.bypass'', true) = ''on'''
    || ' OR business_id = NULLIF(current_setting(''xtiitch.current_business_id'', true), '''')::uuid)';
BEGIN
  FOREACH tenant_table IN ARRAY ARRAY['business_customer_notes'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING %s WITH CHECK %s',
      tenant_table || '_tenant_isolation', tenant_table, policy_using, policy_using
    );
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON business_customer_notes TO xtiitch_app;
