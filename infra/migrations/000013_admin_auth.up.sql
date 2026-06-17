create table admin_users (
    admin_user_id uuid primary key,
    email text not null,
    display_name text not null,
    password_hash text not null,
    role text not null check (role in ('owner', 'operator', 'support')),
    is_active boolean not null default true,
    last_login_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index admin_users_email_unique_idx on admin_users (lower(email));
create index admin_users_role_idx on admin_users (role);

create table admin_sessions (
    session_id uuid primary key,
    admin_user_id uuid not null references admin_users(admin_user_id) on delete cascade,
    refresh_token_hash text not null unique,
    user_agent text not null default '',
    ip_address text not null default '',
    expires_at timestamptz not null,
    revoked_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (expires_at > created_at)
);

create index admin_sessions_user_idx on admin_sessions (admin_user_id, created_at desc);
create index admin_sessions_active_idx on admin_sessions (expires_at)
    where revoked_at is null;

grant select, insert, update, delete on admin_users, admin_sessions to xtiitch_app;
