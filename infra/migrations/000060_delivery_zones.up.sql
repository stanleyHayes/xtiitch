-- Delivery zones with a flat per-zone fee. A business that delivers
-- (store_settings.delivery_enabled) defines named zones (e.g. "Accra Central",
-- "Tema") each with a fee; at online checkout the customer picks a zone and its
-- fee is added to the charge. Xtiitch never escrows the fee — it rides the same
-- Paystack split as the garment payment and settles to the business subaccount.
CREATE TABLE IF NOT EXISTS delivery_zones (
  zone_id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses (business_id) ON DELETE CASCADE,
  name text NOT NULL,
  fee_minor bigint NOT NULL CHECK (fee_minor >= 0),
  sequence integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- A zone's name is unique within a business so the storefront list is clean
  -- and re-creating the same zone is idempotent on name.
  CONSTRAINT delivery_zones_business_name_unique UNIQUE (business_id, name),
  -- Same-tenant backstop for the orders FK below (mirror handovers/bookings).
  CONSTRAINT delivery_zones_id_business_unique UNIQUE (zone_id, business_id)
);

CREATE INDEX IF NOT EXISTS delivery_zones_business_seq_idx ON delivery_zones (business_id, sequence);

-- Snapshot the chosen delivery on the order: the method, the destination, the
-- fee charged (kept even if the zone's fee later changes or the zone is removed),
-- and a reference to the zone. The fee is additive to agreed_total_minor's
-- garment value, recorded separately so money reporting can split garment vs
-- delivery. Null/zero for pickup and for every pre-existing order.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_method text
    CHECK (delivery_method IS NULL OR delivery_method IN ('pickup', 'delivery')),
  ADD COLUMN IF NOT EXISTS delivery_address text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS delivery_fee_minor bigint NOT NULL DEFAULT 0
    CHECK (delivery_fee_minor >= 0),
  ADD COLUMN IF NOT EXISTS delivery_zone_id uuid;

-- Add the FK only if missing, so a re-run after a partial failure doesn't error
-- on "constraint already exists" (Postgres has no ADD CONSTRAINT IF NOT EXISTS).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_delivery_zone_fk'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_delivery_zone_fk
      FOREIGN KEY (delivery_zone_id) REFERENCES delivery_zones (zone_id) ON DELETE SET NULL;
  END IF;
END $$;

-- Tenant isolation under the project's hardened RLS shape (bypass-clause + FORCE).
-- DROP POLICY IF EXISTS before CREATE so the whole migration is re-runnable.
DO $$
DECLARE
  tenant_table text;
  policy_using text := '(current_setting(''xtiitch.bypass'', true) = ''on'''
    || ' OR business_id = NULLIF(current_setting(''xtiitch.current_business_id'', true), '''')::uuid)';
BEGIN
  FOREACH tenant_table IN ARRAY ARRAY['delivery_zones'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tenant_table || '_tenant_isolation', tenant_table);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING %s WITH CHECK %s',
      tenant_table || '_tenant_isolation', tenant_table, policy_using, policy_using
    );
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON delivery_zones TO xtiitch_app;
