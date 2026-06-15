-- Home-visit bookings. A business publishes recurring weekly availability
-- windows; bookable slots are derived at query time (never stored). A booking
-- row IS the reservation of one slot, so the atomic "never double-book"
-- guarantee is a partial unique index over the held/booked rows — the same
-- concurrency pattern proven in 000009 (one open balance). A home-visit booking
-- links to the existing draft home_visit order and is confirmed, with that
-- order, by a single booking-deposit payment (Technical Specification 4.12).

ALTER TABLE store_settings
  ADD COLUMN home_visit_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN business_timezone text NOT NULL DEFAULT 'Africa/Accra';

CREATE TABLE availability_windows (
  window_id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses (business_id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_minute smallint NOT NULL CHECK (start_minute BETWEEN 0 AND 1439),
  end_minute smallint NOT NULL CHECK (end_minute BETWEEN 1 AND 1440),
  slot_minutes smallint NOT NULL DEFAULT 60 CHECK (slot_minutes BETWEEN 15 AND 480),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_minute > start_minute)
);

CREATE INDEX availability_windows_business_idx ON availability_windows (business_id, weekday);

CREATE TABLE bookings (
  booking_id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses (business_id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers (customer_id),
  order_id uuid NOT NULL,
  slot_start timestamptz NOT NULL,
  slot_end timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'held'
    CHECK (status IN ('held', 'booked', 'completed', 'cancelled', 'rescheduled')),
  address text NOT NULL DEFAULT '',
  deposit_payment_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (slot_end > slot_start),
  CONSTRAINT bookings_id_business_unique UNIQUE (booking_id, business_id)
);

CREATE INDEX bookings_business_slot_idx ON bookings (business_id, slot_start);

-- The atomic no-double-book guarantee: at most one held/booked booking per
-- (business, slot). A second concurrent hold fails with a unique violation.
CREATE UNIQUE INDEX bookings_active_slot_idx
  ON bookings (business_id, slot_start)
  WHERE status IN ('held', 'booked');

-- Same-tenant backstops, independent of RLS (mirror 000007). A booking's order
-- must belong to the same business; a payment's booking (now that booking_id is
-- a real reference) must too. MATCH SIMPLE: a null booking_id skips the check,
-- so every non-booking payment is unaffected.
ALTER TABLE bookings
  ADD CONSTRAINT bookings_order_same_business_fk
  FOREIGN KEY (order_id, business_id) REFERENCES orders (order_id, business_id);

ALTER TABLE payments
  ADD CONSTRAINT payments_booking_same_business_fk
  FOREIGN KEY (booking_id, business_id) REFERENCES bookings (booking_id, business_id);

-- Tenant isolation under the project's hardened RLS shape (bypass-clause + FORCE)
-- because the booking-deposit webhook confirms a booking cross-tenant by
-- provider reference, then scopes to the resolved business before any write.
DO $$
DECLARE
  tenant_table text;
  policy_using text := '(current_setting(''xtiitch.bypass'', true) = ''on'''
    || ' OR business_id = NULLIF(current_setting(''xtiitch.current_business_id'', true), '''')::uuid)';
BEGIN
  FOREACH tenant_table IN ARRAY ARRAY['availability_windows', 'bookings'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING %s WITH CHECK %s',
      tenant_table || '_tenant_isolation', tenant_table, policy_using, policy_using
    );
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON availability_windows, bookings TO xtiitch_app;
