-- Orders, production stages, and stage history. An order moves through the
-- business's own ordered stages, each tied to one of three customer-facing
-- colours (red/yellow/green), which is the heart of the product's tracking view
-- (Technical Specification sections 4.10-4.13, 8). This slice supports the
-- walk-in / standard path; custom-order columns are nullable for forward use.

CREATE TABLE stage_templates (
  stage_id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses (business_id) ON DELETE CASCADE,
  name text NOT NULL,
  colour text NOT NULL CHECK (colour IN ('red', 'yellow', 'green')),
  flow text NOT NULL CHECK (flow IN ('ready_made', 'bespoke')),
  sequence integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX stage_templates_business_flow_seq_idx ON stage_templates (business_id, flow, sequence);

CREATE TABLE orders (
  order_id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses (business_id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers (customer_id),
  design_id uuid NOT NULL REFERENCES designs (design_id),
  size_band_id uuid REFERENCES size_bands (size_band_id),
  order_type text NOT NULL CHECK (order_type IN ('standard', 'custom')),
  size_mode text NOT NULL CHECK (size_mode IN ('band', 'self_measure', 'home_visit', 'come_to_shop')),
  flow text NOT NULL CHECK (flow IN ('ready_made', 'bespoke')),
  channel text NOT NULL DEFAULT 'online' CHECK (channel IN ('online', 'walk_in')),
  agreed_total_minor bigint,
  settled_minor bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'awaiting_deposit', 'confirmed', 'fulfilled', 'cancelled')),
  current_stage_id uuid REFERENCES stage_templates (stage_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX orders_business_created_idx ON orders (business_id, created_at DESC);
CREATE INDEX orders_business_status_idx ON orders (business_id, status);
CREATE INDEX orders_customer_idx ON orders (customer_id);

CREATE TABLE stage_events (
  event_id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses (business_id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES orders (order_id) ON DELETE CASCADE,
  stage_id uuid NOT NULL REFERENCES stage_templates (stage_id),
  entered_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX stage_events_order_idx ON stage_events (order_id, entered_at);

DO $$
DECLARE
  tenant_table text;
  policy_using text := '(current_setting(''xtiitch.bypass'', true) = ''on'''
    || ' OR business_id = NULLIF(current_setting(''xtiitch.current_business_id'', true), '''')::uuid)';
BEGIN
  FOREACH tenant_table IN ARRAY ARRAY['stage_templates', 'orders', 'stage_events'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING %s WITH CHECK %s',
      tenant_table || '_tenant_isolation', tenant_table, policy_using, policy_using
    );
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON stage_templates, orders, stage_events TO xtiitch_app;
