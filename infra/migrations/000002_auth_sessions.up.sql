CREATE TABLE auth_sessions (
  session_id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses (business_id) ON DELETE CASCADE,
  business_user_id uuid NOT NULL REFERENCES business_users (business_user_id) ON DELETE CASCADE,
  refresh_token_hash text NOT NULL UNIQUE,
  user_agent text NOT NULL DEFAULT '',
  ip_address text NOT NULL DEFAULT '',
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);

CREATE INDEX auth_sessions_business_user_idx ON auth_sessions (business_id, business_user_id);
CREATE INDEX auth_sessions_business_expiry_idx ON auth_sessions (business_id, expires_at);
CREATE INDEX auth_sessions_active_idx ON auth_sessions (business_id, business_user_id, expires_at)
  WHERE revoked_at IS NULL;

ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY auth_sessions_tenant_isolation ON auth_sessions
  USING (business_id = NULLIF(current_setting('xtiitch.current_business_id', true), '')::uuid)
  WITH CHECK (business_id = NULLIF(current_setting('xtiitch.current_business_id', true), '')::uuid);

