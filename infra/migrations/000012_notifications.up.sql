-- Transactional outbox for business→customer messages. A lifecycle event (an
-- order confirmed, an order fulfilled) writes a row here in the SAME transaction
-- as the state change, so the intent is durable and consistent with the change.
-- A separate transport drains the outbox and sends each message over its channel
-- (WhatsApp/SMS); that delivery state lives in `status`/`attempts`. The outbox
-- never moves money and is not on the request path of sending — it only records
-- what should be sent.

CREATE TABLE outbound_messages (
  message_id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses (business_id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'sms')),
  kind text NOT NULL,
  recipient text NOT NULL DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'dead')),
  attempts int NOT NULL DEFAULT 0,
  last_error text NOT NULL DEFAULT '',
  dedup_key text NOT NULL,
  available_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

-- Idempotent enqueue: a given kind fires at most once per reference, so a
-- redelivered webhook or a retried transaction enqueues nothing new (the
-- producer inserts ON CONFLICT DO NOTHING against this index).
CREATE UNIQUE INDEX outbound_messages_dedup_idx ON outbound_messages (business_id, dedup_key);

-- The transport claims due, not-yet-delivered messages oldest-first.
CREATE INDEX outbound_messages_due_idx ON outbound_messages (available_at)
  WHERE status IN ('pending', 'sending');

-- Tenant isolation under the project's hardened RLS shape (bypass-clause + FORCE).
-- A business reads its own message log under tenant scope; the platform transport
-- drains across tenants under the bypass, like the payment webhook.
DO $$
DECLARE
  tenant_table text;
  policy_using text := '(current_setting(''xtiitch.bypass'', true) = ''on'''
    || ' OR business_id = NULLIF(current_setting(''xtiitch.current_business_id'', true), '''')::uuid)';
BEGIN
  FOREACH tenant_table IN ARRAY ARRAY['outbound_messages'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING %s WITH CHECK %s',
      tenant_table || '_tenant_isolation', tenant_table, policy_using, policy_using
    );
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON outbound_messages TO xtiitch_app;
