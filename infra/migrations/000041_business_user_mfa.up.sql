-- Opt-in TOTP multi-factor auth for business users (authenticator apps such as
-- Google Authenticator / Authy). The shared secret is stored encrypted at rest
-- (AES-GCM, application layer); backup codes are stored as one-way hashes. A row
-- exists once a user begins enrolment; `enabled` flips true only after the first
-- code is verified.

create table business_user_mfa (
    business_user_id uuid primary key
        references business_users (business_user_id) on delete cascade,
    business_id uuid not null references businesses (business_id) on delete cascade,
    -- AES-GCM ciphertext of the base32 TOTP secret (nonce-prefixed).
    secret_encrypted bytea not null,
    enabled boolean not null default false,
    confirmed_at timestamptz,
    -- Array of {"hash": <sha256 hex>, "used_at": <ts|null>} backup codes.
    backup_codes jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index business_user_mfa_business_idx
    on business_user_mfa (business_id);

alter table business_user_mfa enable row level security;
alter table business_user_mfa force row level security;

create policy business_user_mfa_tenant_isolation on business_user_mfa
    using (
        current_setting('xtiitch.bypass', true) = 'on'
        or business_id = nullif(current_setting('xtiitch.current_business_id', true), '')::uuid
    )
    with check (
        current_setting('xtiitch.bypass', true) = 'on'
        or business_id = nullif(current_setting('xtiitch.current_business_id', true), '')::uuid
    );

grant select, insert, update, delete on business_user_mfa to xtiitch_app;
