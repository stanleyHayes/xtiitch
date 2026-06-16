-- Fulfilment handovers. Once an order's production stages are complete (status
-- 'fulfilled'), the finished garment still has to reach the customer: either the
-- customer collects it (pickup) or the business sends it to an address
-- (delivery). A handover row tracks that last operational leg. Xtiitch never
-- holds funds, so this records logistics state only — any delivery fee is the
-- business's own charge through the existing payment rails, never escrowed here.

CREATE TABLE handovers (
  handover_id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses (business_id) ON DELETE CASCADE,
  order_id uuid NOT NULL,
  method text NOT NULL CHECK (method IN ('pickup', 'delivery')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'dispatched', 'completed', 'cancelled')),
  recipient_name text NOT NULL DEFAULT '',
  recipient_phone text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  courier text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- A delivery must have a destination; a pickup needs none.
  CHECK (method <> 'delivery' OR length(address) > 0),
  -- Only a delivery is ever 'dispatched' (out for delivery); a pickup goes
  -- straight from pending to completed when the customer collects it.
  CHECK (status <> 'dispatched' OR method = 'delivery'),
  CONSTRAINT handovers_id_business_unique UNIQUE (handover_id, business_id)
);

CREATE INDEX handovers_business_created_idx ON handovers (business_id, created_at DESC);

-- One open handover per order: an order is out for fulfilment at most once at a
-- time. A second arrange while one is still pending/dispatched fails with a
-- unique violation — the same race-proof pattern as 000009 (one open balance)
-- and 000010 (one active booking per slot). Cancelled/completed rows drop out of
-- the index, so a fresh handover can be arranged after one ends.
CREATE UNIQUE INDEX handovers_one_open_idx
  ON handovers (order_id)
  WHERE status IN ('pending', 'dispatched');

-- Same-tenant backstop, independent of RLS (mirror 000007/000010): a handover's
-- order must belong to the same business. It relies on orders'
-- (order_id, business_id) unique key from 000007.
ALTER TABLE handovers
  ADD CONSTRAINT handovers_order_same_business_fk
  FOREIGN KEY (order_id, business_id) REFERENCES orders (order_id, business_id);

-- Tenant isolation under the project's hardened RLS shape (bypass-clause + FORCE).
DO $$
DECLARE
  tenant_table text;
  policy_using text := '(current_setting(''xtiitch.bypass'', true) = ''on'''
    || ' OR business_id = NULLIF(current_setting(''xtiitch.current_business_id'', true), '''')::uuid)';
BEGIN
  FOREACH tenant_table IN ARRAY ARRAY['handovers'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING %s WITH CHECK %s',
      tenant_table || '_tenant_isolation', tenant_table, policy_using, policy_using
    );
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON handovers TO xtiitch_app;
