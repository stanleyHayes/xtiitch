create table affiliates (
    affiliate_id uuid primary key default gen_random_uuid(),
    entity_type text not null default 'person'
        check (entity_type in ('person', 'business', 'agency')),
    code text not null,
    display_name text not null,
    contact_name text not null default '',
    email text not null default '',
    phone text not null default '',
    website_url text not null default '',
    commission_model text not null default 'percentage'
        check (commission_model in ('percentage', 'flat')),
    commission_rate bigint not null check (commission_rate > 0),
    cookie_window_days integer not null default 30
        check (cookie_window_days between 1 and 365),
    payout_mode text not null default 'voucher'
        check (payout_mode in ('paystack_split', 'paystack_transfer', 'voucher', 'manual')),
    payout_reference text not null default '',
    status text not null default 'pending_review'
        check (status in ('pending_review', 'active', 'paused', 'archived')),
    notes text not null default '',
    created_by_admin_user_id uuid references admin_users(admin_user_id) on delete set null,
    updated_by_admin_user_id uuid references admin_users(admin_user_id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (display_name <> ''),
    check (code ~ '^[A-Z0-9][A-Z0-9_-]{1,30}[A-Z0-9]$'),
    check (
        email = ''
        or (
            position('@' in email) > 1
            and position('.' in split_part(email, '@', 2)) > 1
        )
    ),
    check (
        (commission_model = 'percentage' and commission_rate <= 10000)
        or commission_model = 'flat'
    )
);

create unique index affiliates_code_unique_idx
    on affiliates (lower(code));

create index affiliates_status_idx
    on affiliates (status, updated_at desc);

alter table affiliates enable row level security;
alter table affiliates force row level security;

create policy affiliates_admin_bypass on affiliates
    using (current_setting('xtiitch.bypass', true) = 'on')
    with check (current_setting('xtiitch.bypass', true) = 'on');

grant select, insert, update on affiliates to xtiitch_app;
