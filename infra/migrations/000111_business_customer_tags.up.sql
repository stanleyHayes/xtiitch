-- §15.1 "Tags / labels (e.g. 'VIP', 'wholesale', 'bride')" — Growth and above.
-- A tag is a (business, customer, tag) triple: labels are tenant-owned
-- annotations over the GLOBAL customer identity (§15.3 one customer record),
-- so no store ever sees another store's tags. One row per distinct tag; the
-- set for a customer is replaced wholesale by PUT /v1/crm/customers/{id}/tags.
-- Gating is NOT enforced here: tags are a crm_level >= 2 capability from the
-- plan entitlement matrix (§11.1/§15.3 admin-configurable), checked live by
-- the application on every read and write.

CREATE TABLE business_customer_tags (
  business_id uuid NOT NULL REFERENCES businesses (business_id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers (customer_id) ON DELETE CASCADE,
  tag text NOT NULL CHECK (btrim(tag) <> ''),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, customer_id, tag)
);

COMMENT ON TABLE business_customer_tags IS
  '§15.1 owner labels per (business, customer); crm_level >= 2, enforced by the application. Tenant-owned annotation over the global customer identity.';

CREATE INDEX business_customer_tags_business_tag_idx ON business_customer_tags (business_id, tag);

-- Tenant isolation under the project's hardened RLS shape (bypass-clause +
-- FORCE), copied from 000110: the owner reads/writes only their own tags
-- under tenant scope; the business-delete cascade cleans up by business_id.
DO $$
DECLARE
  tenant_table text;
  policy_using text := '(current_setting(''xtiitch.bypass'', true) = ''on'''
    || ' OR business_id = NULLIF(current_setting(''xtiitch.current_business_id'', true), '''')::uuid)';
BEGIN
  FOREACH tenant_table IN ARRAY ARRAY['business_customer_tags'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING %s WITH CHECK %s',
      tenant_table || '_tenant_isolation', tenant_table, policy_using, policy_using
    );
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON business_customer_tags TO xtiitch_app;
