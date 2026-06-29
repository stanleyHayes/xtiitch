-- Ghana Card identity verification for paid businesses. A business submits its
-- Ghana Card number + a photo of the card; this flips verification_status to
-- 'pending' and an operator reviews it in the admin console (the existing
-- business-verification decision flow approves -> 'verified' or rejects). One
-- row per business, upserted on resubmission. This is PII, so it lives in its
-- own tenant-isolated table rather than on businesses.
CREATE TABLE business_identity_documents (
  business_id uuid PRIMARY KEY REFERENCES businesses (business_id) ON DELETE CASCADE,
  card_number text NOT NULL,
  id_photo_url text NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tenant isolation under the project's hardened RLS shape (bypass-clause + FORCE).
-- The business reads/writes its own row under its scope; the admin console reads
-- across tenants under the RLS bypass (setTenantBypass), same as other admin reads.
DO $$
DECLARE
  tenant_table text;
  policy_using text := '(current_setting(''xtiitch.bypass'', true) = ''on'''
    || ' OR business_id = NULLIF(current_setting(''xtiitch.current_business_id'', true), '''')::uuid)';
BEGIN
  FOREACH tenant_table IN ARRAY ARRAY['business_identity_documents'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING %s WITH CHECK %s',
      tenant_table || '_tenant_isolation', tenant_table, policy_using, policy_using
    );
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON business_identity_documents TO xtiitch_app;
