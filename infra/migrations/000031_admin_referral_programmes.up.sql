create table referral_programmes (
    referral_programme_id uuid primary key default gen_random_uuid(),
    title text not null,
    code_prefix text not null,
    audience text not null default 'customers'
        check (audience in ('customers', 'businesses', 'mixed')),
    referrer_reward_kind text not null default 'voucher'
        check (referrer_reward_kind in ('voucher', 'commission_rebate', 'none')),
    referee_reward_kind text not null default 'voucher'
        check (referee_reward_kind in ('voucher', 'none')),
    reward_type text not null default 'fixed'
        check (reward_type in ('percentage', 'fixed')),
    reward_value bigint not null check (reward_value > 0),
    max_reward_minor bigint check (max_reward_minor is null or max_reward_minor > 0),
    qualifying_order_min_minor bigint not null default 0
        check (qualifying_order_min_minor >= 0),
    reward_hold_days integer not null default 14
        check (reward_hold_days between 0 and 180),
    status text not null default 'draft'
        check (status in ('draft', 'active', 'paused', 'archived')),
    starts_at timestamptz,
    ends_at timestamptz,
    notes text not null default '',
    created_by_admin_user_id uuid references admin_users(admin_user_id) on delete set null,
    updated_by_admin_user_id uuid references admin_users(admin_user_id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (title <> ''),
    check (code_prefix ~ '^[A-Z0-9][A-Z0-9_-]{1,22}[A-Z0-9]$'),
    check (
        referrer_reward_kind <> 'none'
        or referee_reward_kind <> 'none'
    ),
    check (
        (reward_type = 'percentage' and reward_value <= 10000 and max_reward_minor is not null)
        or reward_type = 'fixed'
    ),
    check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create unique index referral_programmes_code_prefix_unique_idx
    on referral_programmes (lower(code_prefix));

create index referral_programmes_status_idx
    on referral_programmes (status, updated_at desc);

alter table referral_programmes enable row level security;
alter table referral_programmes force row level security;

create policy referral_programmes_admin_bypass on referral_programmes
    using (current_setting('xtiitch.bypass', true) = 'on')
    with check (current_setting('xtiitch.bypass', true) = 'on');

grant select, insert, update on referral_programmes to xtiitch_app;
