CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE plans (
  plan_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  monthly_fee_minor integer NOT NULL CHECK (monthly_fee_minor >= 0),
  yearly_fee_minor integer NOT NULL DEFAULT 0 CHECK (yearly_fee_minor >= 0),
  commission_bps integer NOT NULL CHECK (commission_bps >= 0),
  design_limit integer CHECK (design_limit IS NULL OR design_limit >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO plans (code, name, monthly_fee_minor, yearly_fee_minor, commission_bps, design_limit)
VALUES
  ('free', 'Free - Get Online', 0, 0, 300, 10),
  ('standard', 'Standard', 5000, 60000, 100, NULL),
  ('growth', 'Growth', 12000, 144000, 50, NULL)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE businesses (
  business_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES plans (plan_id),
  name text NOT NULL,
  handle text NOT NULL,
  verification_status text NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected')),
  settlement_provider text,
  settlement_provider_subaccount text,
  settlement_mobile_money_number text,
  default_deposit_minor integer NOT NULL DEFAULT 10000 CHECK (default_deposit_minor >= 10000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT businesses_handle_format CHECK (handle ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$')
);

CREATE UNIQUE INDEX businesses_handle_unique_idx ON businesses (lower(handle));
CREATE INDEX businesses_plan_id_idx ON businesses (plan_id);
CREATE INDEX businesses_verification_status_idx ON businesses (verification_status);

CREATE TABLE store_settings (
  business_id uuid PRIMARY KEY REFERENCES businesses (business_id) ON DELETE CASCADE,
  bespoke_enabled boolean NOT NULL DEFAULT true,
  measurements_enabled boolean NOT NULL DEFAULT true,
  customisation_enabled boolean NOT NULL DEFAULT true,
  collections_enabled boolean NOT NULL DEFAULT true,
  delivery_enabled boolean NOT NULL DEFAULT false,
  dispatch_enabled boolean NOT NULL DEFAULT false,
  brand_color text NOT NULL DEFAULT '#800020',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE business_users (
  business_user_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses (business_id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'staff')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX business_users_business_email_unique_idx ON business_users (business_id, lower(email));
CREATE INDEX business_users_business_id_idx ON business_users (business_id);

CREATE TABLE customers (
  customer_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_ref text UNIQUE,
  email text,
  phone text,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE customer_businesses (
  business_id uuid NOT NULL REFERENCES businesses (business_id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers (customer_id) ON DELETE CASCADE,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, customer_id)
);

CREATE INDEX customer_businesses_customer_id_idx ON customer_businesses (customer_id);

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_businesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY businesses_tenant_isolation ON businesses
  USING (business_id = NULLIF(current_setting('xtiitch.current_business_id', true), '')::uuid)
  WITH CHECK (business_id = NULLIF(current_setting('xtiitch.current_business_id', true), '')::uuid);

CREATE POLICY store_settings_tenant_isolation ON store_settings
  USING (business_id = NULLIF(current_setting('xtiitch.current_business_id', true), '')::uuid)
  WITH CHECK (business_id = NULLIF(current_setting('xtiitch.current_business_id', true), '')::uuid);

CREATE POLICY business_users_tenant_isolation ON business_users
  USING (business_id = NULLIF(current_setting('xtiitch.current_business_id', true), '')::uuid)
  WITH CHECK (business_id = NULLIF(current_setting('xtiitch.current_business_id', true), '')::uuid);

CREATE POLICY customer_businesses_tenant_isolation ON customer_businesses
  USING (business_id = NULLIF(current_setting('xtiitch.current_business_id', true), '')::uuid)
  WITH CHECK (business_id = NULLIF(current_setting('xtiitch.current_business_id', true), '')::uuid);
