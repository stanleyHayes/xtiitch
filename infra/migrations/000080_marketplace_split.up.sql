-- Marketplace multi-store split charge (Xtiitch-Updates §4 / P0.4).
--
-- The unified basket can hold pieces from several shops. "Pay once" raises ONE
-- Paystack transaction whose split settles each shop's net to its own subaccount
-- and the platform's summed commission to the main account. This is an ISOLATED
-- new path: the existing single-store payment/confirmation flow is untouched.
--
-- marketplace_charges is the parent (one per combined payment), keyed by the
-- Paystack provider reference. marketplace_charge_members is one row per shop in
-- the charge, carrying that shop's checkout group + settlement figures. Both are
-- PLATFORM-level infrastructure (a charge spans tenants), so — like
-- payment_provider_events — they are NOT under tenant row-level security; only
-- the RLS-bypass webhook and checkout paths touch them, and the per-shop ORDER
-- writes they drive are still tenant-scoped at confirmation time.

-- Allow the new payment purpose used for the per-shop money-tracker rows written
-- when a marketplace charge settles.
ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_purpose_check;
ALTER TABLE payments
  ADD CONSTRAINT payments_purpose_check
  CHECK (purpose = ANY (ARRAY['standard_full', 'deposit', 'balance', 'booking_deposit', 'cart_full', 'marketplace_split']));

CREATE TABLE IF NOT EXISTS marketplace_charges (
  charge_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_reference text NOT NULL,
  customer_email text NOT NULL DEFAULT '',
  total_minor bigint NOT NULL CHECK (total_minor > 0),
  status text NOT NULL DEFAULT 'initiated'
    CHECK (status IN ('initiated', 'succeeded', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_charges_provider_reference_unique UNIQUE (provider_reference)
);

CREATE TABLE IF NOT EXISTS marketplace_charge_members (
  member_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_id uuid NOT NULL REFERENCES marketplace_charges (charge_id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses (business_id) ON DELETE CASCADE,
  checkout_group_id uuid NOT NULL,
  anchor_order_id uuid NOT NULL,
  -- net_minor is the shop's flat split share (its order total minus its
  -- commission); commission_minor is the platform's cut for this shop.
  net_minor bigint NOT NULL CHECK (net_minor >= 0),
  commission_minor bigint NOT NULL DEFAULT 0 CHECK (commission_minor >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_charge_members_charge_business_unique UNIQUE (charge_id, business_id)
);

CREATE INDEX IF NOT EXISTS marketplace_charge_members_charge_idx
  ON marketplace_charge_members (charge_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON marketplace_charges TO xtiitch_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON marketplace_charge_members TO xtiitch_app;
