create table affiliate_accounts (
    affiliate_account_id uuid primary key default gen_random_uuid(),
    affiliate_id uuid not null unique
        references affiliates (affiliate_id) on delete cascade,
    email text not null,
    password_hash text not null default '',
    status text not null default 'invited'
        check (status in ('invited', 'active', 'locked', 'disabled')),
    email_verified_at timestamptz,
    invite_sent_at timestamptz,
    activated_at timestamptz,
    last_login_at timestamptz,
    failed_login_count integer not null default 0
        check (failed_login_count between 0 and 1000),
    locked_until timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (
        position('@' in email) > 1
        and position('.' in split_part(email, '@', 2)) > 1
    ),
    check (
        status <> 'active'
        or (
            password_hash <> ''
            and email_verified_at is not null
            and activated_at is not null
        )
    ),
    check (
        status <> 'locked'
        or locked_until is not null
    )
);

create unique index affiliate_accounts_email_unique_idx
    on affiliate_accounts (lower(email));

create index affiliate_accounts_status_idx
    on affiliate_accounts (status, updated_at desc);

create table affiliate_activation_tokens (
    affiliate_activation_token_id uuid primary key default gen_random_uuid(),
    affiliate_account_id uuid not null
        references affiliate_accounts (affiliate_account_id) on delete cascade,
    token_hash text not null unique,
    expires_at timestamptz not null,
    consumed_at timestamptz,
    created_at timestamptz not null default now(),
    check (length(token_hash) = 64),
    check (expires_at > created_at),
    check (consumed_at is null or consumed_at >= created_at)
);

create index affiliate_activation_tokens_account_idx
    on affiliate_activation_tokens (affiliate_account_id, created_at desc);

create index affiliate_activation_tokens_valid_idx
    on affiliate_activation_tokens (expires_at)
    where consumed_at is null;

create table affiliate_refresh_sessions (
    affiliate_refresh_session_id uuid primary key default gen_random_uuid(),
    affiliate_account_id uuid not null
        references affiliate_accounts (affiliate_account_id) on delete cascade,
    refresh_token_hash text not null unique,
    user_agent text not null default '',
    ip_hash text not null default '',
    expires_at timestamptz not null,
    last_used_at timestamptz,
    revoked_at timestamptz,
    created_at timestamptz not null default now(),
    check (length(refresh_token_hash) = 64),
    check (expires_at > created_at),
    check (last_used_at is null or last_used_at >= created_at),
    check (revoked_at is null or revoked_at >= created_at)
);

create index affiliate_refresh_sessions_account_idx
    on affiliate_refresh_sessions (
        affiliate_account_id,
        created_at desc
    );

create index affiliate_refresh_sessions_valid_idx
    on affiliate_refresh_sessions (expires_at)
    where revoked_at is null;

alter table affiliate_accounts enable row level security;
alter table affiliate_accounts force row level security;
create policy affiliate_accounts_admin_bypass on affiliate_accounts
    using (current_setting('xtiitch.bypass', true) = 'on')
    with check (current_setting('xtiitch.bypass', true) = 'on');

alter table affiliate_activation_tokens enable row level security;
alter table affiliate_activation_tokens force row level security;
create policy affiliate_activation_tokens_admin_bypass
    on affiliate_activation_tokens
    using (current_setting('xtiitch.bypass', true) = 'on')
    with check (current_setting('xtiitch.bypass', true) = 'on');

alter table affiliate_refresh_sessions enable row level security;
alter table affiliate_refresh_sessions force row level security;
create policy affiliate_refresh_sessions_admin_bypass
    on affiliate_refresh_sessions
    using (current_setting('xtiitch.bypass', true) = 'on')
    with check (current_setting('xtiitch.bypass', true) = 'on');

grant select, insert, update on
    affiliate_accounts,
    affiliate_activation_tokens,
    affiliate_refresh_sessions
to xtiitch_app;
