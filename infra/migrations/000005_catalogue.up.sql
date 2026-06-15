-- Catalogue: collections, designs, business-defined size bands, and per-band
-- pricing. All tenant-scoped. Designs and collections carry an unguessable
-- handle for shareable public links and a three-state lifecycle
-- (active | retired | deleted) per Technical Specification sections 4.6-4.9.

CREATE TABLE collections (
  collection_id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses (business_id) ON DELETE CASCADE,
  name text NOT NULL,
  theme text NOT NULL DEFAULT '',
  handle text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'retired', 'deleted')),
  sequence integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX collections_business_handle_idx ON collections (business_id, handle);
CREATE INDEX collections_business_status_idx ON collections (business_id, status, sequence);

CREATE TABLE designs (
  design_id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses (business_id) ON DELETE CASCADE,
  collection_id uuid REFERENCES collections (collection_id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  images text[] NOT NULL DEFAULT '{}',
  customisation_allowed boolean NOT NULL DEFAULT false,
  deposit_override_minor bigint CHECK (deposit_override_minor IS NULL OR deposit_override_minor >= 10000),
  handle text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'retired', 'deleted')),
  sequence integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX designs_business_handle_idx ON designs (business_id, handle);
CREATE INDEX designs_business_status_idx ON designs (business_id, status, sequence);
CREATE INDEX designs_collection_idx ON designs (collection_id) WHERE collection_id IS NOT NULL;

CREATE TABLE size_bands (
  size_band_id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses (business_id) ON DELETE CASCADE,
  label text NOT NULL,
  chart jsonb NOT NULL DEFAULT '{}',
  sequence integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX size_bands_business_idx ON size_bands (business_id, sequence);

CREATE TABLE design_prices (
  design_id uuid NOT NULL REFERENCES designs (design_id) ON DELETE CASCADE,
  size_band_id uuid NOT NULL REFERENCES size_bands (size_band_id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses (business_id) ON DELETE CASCADE,
  price_minor bigint NOT NULL CHECK (price_minor >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (design_id, size_band_id)
);

CREATE INDEX design_prices_business_idx ON design_prices (business_id);

-- Row-level security, matching the hardened policy shape from migration 000004:
-- a tenant scope is required, with an explicit bypass escape reserved for the
-- public storefront's handle resolution (which is intentionally cross-tenant).
DO $$
DECLARE
  tenant_table text;
  policy_using text := '(current_setting(''xtiitch.bypass'', true) = ''on'''
    || ' OR business_id = NULLIF(current_setting(''xtiitch.current_business_id'', true), '''')::uuid)';
BEGIN
  FOREACH tenant_table IN ARRAY ARRAY['collections', 'designs', 'size_bands', 'design_prices'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING %s WITH CHECK %s',
      tenant_table || '_tenant_isolation', tenant_table, policy_using, policy_using
    );
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON collections, designs, size_bands, design_prices TO xtiitch_app;
