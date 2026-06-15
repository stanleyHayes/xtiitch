-- Money records. Two distinct ledgers kept apart on purpose: payments that flow
-- through the platform (carry commission) and manual takings logged off-platform
-- (never carry commission). See Technical Specification section 4.16 and 10.

CREATE TABLE payments (
  payment_id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses (business_id) ON DELETE CASCADE,
  order_id uuid,
  booking_id uuid,
  purpose text NOT NULL
    CHECK (purpose IN ('standard_full', 'deposit', 'balance', 'booking_deposit')),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency text NOT NULL DEFAULT 'GHS',
  method text CHECK (method IS NULL OR method IN ('momo', 'card')),
  provider_reference text NOT NULL,
  status text NOT NULL DEFAULT 'initiated'
    CHECK (status IN ('initiated', 'succeeded', 'failed', 'reversed')),
  through_platform boolean NOT NULL DEFAULT true,
  commission_minor bigint NOT NULL DEFAULT 0 CHECK (commission_minor >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX payments_provider_reference_idx ON payments (provider_reference);
CREATE INDEX payments_business_created_idx ON payments (business_id, created_at DESC);
CREATE INDEX payments_business_status_idx ON payments (business_id, status);

CREATE TABLE manual_takings (
  taking_id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses (business_id) ON DELETE CASCADE,
  order_id uuid,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  method text NOT NULL CHECK (method IN ('cash', 'momo', 'other')),
  what_for text NOT NULL DEFAULT '',
  taken_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX manual_takings_business_taken_idx ON manual_takings (business_id, taken_at DESC);

-- Webhook idempotency ledger. Not tenant-scoped: it is payment-provider
-- infrastructure. The unique key makes a re-delivered confirmation a no-op.
CREATE TABLE payment_provider_events (
  event_id uuid PRIMARY KEY,
  provider text NOT NULL DEFAULT 'paystack',
  event_signature text NOT NULL,
  event_type text NOT NULL,
  provider_reference text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_provider_events_unique UNIQUE (provider, event_signature)
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_takings ENABLE ROW LEVEL SECURITY;

CREATE POLICY payments_tenant_isolation ON payments
  USING (business_id = NULLIF(current_setting('xtiitch.current_business_id', true), '')::uuid)
  WITH CHECK (business_id = NULLIF(current_setting('xtiitch.current_business_id', true), '')::uuid);

CREATE POLICY manual_takings_tenant_isolation ON manual_takings
  USING (business_id = NULLIF(current_setting('xtiitch.current_business_id', true), '')::uuid)
  WITH CHECK (business_id = NULLIF(current_setting('xtiitch.current_business_id', true), '')::uuid);
