-- §3.2/§3.3: Paystack's Settlements data is the ground truth for what actually
-- settled (paid out) to each store. This table MIRRORS it locally — synced from
-- the provider on the Money Desk read path (throttled), on transfer.* webhooks,
-- and on operator demand — so the Money Desk and the §11.5 payouts CRM render
-- payout history and amount-due from the provider's own records, near real time.
--
-- Idempotency: provider_reference (the Paystack settlement id, prefixed) is
-- UNIQUE, so a repeated sync upserts instead of duplicating — the same rule the
-- webhook ledger follows (README: webhook/payment idempotency tables must have
-- unique constraints). raw_payload keeps Paystack's record verbatim as dispute
-- evidence.
CREATE TABLE IF NOT EXISTS paystack_settlements (
  settlement_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses (business_id) ON DELETE CASCADE,
  provider_reference text NOT NULL,
  subaccount_code text NOT NULL DEFAULT '',
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  status text NOT NULL,
  settled_at timestamptz,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT paystack_settlements_provider_reference_unique UNIQUE (provider_reference)
);

CREATE INDEX IF NOT EXISTS paystack_settlements_business_created_idx
  ON paystack_settlements (business_id, created_at DESC);

-- Tenant isolation under the project's hardened RLS shape (bypass-clause +
-- FORCE), mirroring 000061: the business reads its own payout rows under its
-- scope; the webhook sync and the admin CRM work across tenants under the RLS
-- bypass (setTenantBypass).
DO $$
DECLARE
  tenant_table text;
  policy_using text := '(current_setting(''xtiitch.bypass'', true) = ''on'''
    || ' OR business_id = NULLIF(current_setting(''xtiitch.current_business_id'', true), '''')::uuid)';
BEGIN
  FOREACH tenant_table IN ARRAY ARRAY['paystack_settlements'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tenant_table || '_tenant_isolation', tenant_table);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING %s WITH CHECK %s',
      tenant_table || '_tenant_isolation', tenant_table, policy_using, policy_using
    );
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON paystack_settlements TO xtiitch_app;
