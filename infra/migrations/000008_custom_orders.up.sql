-- Custom-order measurement capture. A custom (bespoke) order can take its
-- measurements one of three ways (self-measure now, home visit or come-to-shop
-- later); when the customer self-measures, their values are stored against the
-- order. Fields are business-defined (no platform-wide sizing), so values are a
-- jsonb map keyed by the business's own measurement field ids (Spec 8.2-8.3).

CREATE TABLE measurement_fields (
  field_id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses (business_id) ON DELETE CASCADE,
  label text NOT NULL,
  unit text NOT NULL CHECK (unit IN ('cm', 'in')),
  sequence integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX measurement_fields_business_seq_idx ON measurement_fields (business_id, sequence);

CREATE TABLE order_measurements (
  measurement_id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses (business_id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES orders (order_id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers (customer_id),
  source text NOT NULL CHECK (source IN ('self', 'visit', 'shop')),
  values jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX order_measurements_order_idx ON order_measurements (order_id);
CREATE INDEX order_measurements_business_idx ON order_measurements (business_id);

-- Same-tenant binding, independent of the application and RLS: a measurement
-- can never reference an order belonging to another business (mirrors the
-- payments composite FK in 000007; relies on orders' (order_id, business_id)
-- unique constraint added there).
ALTER TABLE order_measurements
  ADD CONSTRAINT order_measurements_order_same_business_fk
  FOREIGN KEY (order_id, business_id) REFERENCES orders (order_id, business_id);

-- Tenant isolation under the project's hardened RLS shape: a forgotten scope
-- fails closed, with an explicit bypass escape reserved for cross-tenant lookups.
DO $$
DECLARE
  tenant_table text;
  policy_using text := '(current_setting(''xtiitch.bypass'', true) = ''on'''
    || ' OR business_id = NULLIF(current_setting(''xtiitch.current_business_id'', true), '''')::uuid)';
BEGIN
  FOREACH tenant_table IN ARRAY ARRAY['measurement_fields', 'order_measurements'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING %s WITH CHECK %s',
      tenant_table || '_tenant_isolation', tenant_table, policy_using, policy_using
    );
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON measurement_fields, order_measurements TO xtiitch_app;
