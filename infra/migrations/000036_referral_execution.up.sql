create table referral_codes (
    referral_code_id uuid primary key default gen_random_uuid(),
    referral_programme_id uuid not null references referral_programmes (referral_programme_id) on delete cascade,
    business_id uuid references businesses (business_id) on delete cascade,
    owner_type text not null default 'customer'
        check (owner_type in ('customer', 'business', 'platform')),
    owner_customer_id uuid references customers (customer_id) on delete cascade,
    owner_business_id uuid references businesses (business_id) on delete cascade,
    code text not null,
    status text not null default 'active'
        check (status in ('active', 'paused', 'archived')),
    metadata jsonb not null default '{}',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (code ~ '^[A-Z0-9][A-Z0-9_-]{1,30}[A-Z0-9]$'),
    check (
        (owner_type = 'platform' and owner_customer_id is null and owner_business_id is null)
        or (owner_type = 'customer' and owner_customer_id is not null and owner_business_id is null)
        or (owner_type = 'business' and owner_business_id is not null and owner_customer_id is null)
    )
);

create unique index referral_codes_code_unique_idx
    on referral_codes (lower(code));

create index referral_codes_programme_idx
    on referral_codes (referral_programme_id, status, updated_at desc);

create index referral_codes_business_idx
    on referral_codes (business_id, status, updated_at desc)
    where business_id is not null;

create table referrals (
    referral_id uuid primary key default gen_random_uuid(),
    referral_programme_id uuid not null references referral_programmes (referral_programme_id) on delete restrict,
    referral_code_id uuid not null references referral_codes (referral_code_id) on delete restrict,
    business_id uuid not null references businesses (business_id) on delete cascade,
    order_id uuid not null,
    referee_customer_id uuid not null references customers (customer_id) on delete cascade,
    referrer_customer_id uuid references customers (customer_id) on delete set null,
    referrer_business_id uuid references businesses (business_id) on delete set null,
    gross_minor bigint not null check (gross_minor > 0),
    status text not null default 'pending'
        check (status in ('pending', 'qualified', 'rewarded', 'void')),
    attributed_at timestamptz not null default now(),
    qualified_at timestamptz,
    rewarded_at timestamptz,
    metadata jsonb not null default '{}',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (order_id),
    foreign key (order_id, business_id)
        references orders (order_id, business_id)
        on delete cascade,
    check (
        (status in ('qualified', 'rewarded') and qualified_at is not null)
        or status not in ('qualified', 'rewarded')
    ),
    check (
        (status = 'rewarded' and rewarded_at is not null)
        or status <> 'rewarded'
    )
);

create unique index referrals_referee_once_idx
    on referrals (referee_customer_id)
    where status <> 'void';

create index referrals_business_status_idx
    on referrals (business_id, status, updated_at desc);

create index referrals_programme_status_idx
    on referrals (referral_programme_id, status, updated_at desc);

create table referral_rewards (
    referral_reward_id uuid primary key default gen_random_uuid(),
    referral_id uuid not null references referrals (referral_id) on delete cascade,
    business_id uuid not null references businesses (business_id) on delete cascade,
    beneficiary_type text not null
        check (beneficiary_type in ('referrer', 'referee')),
    beneficiary_customer_id uuid references customers (customer_id) on delete set null,
    beneficiary_business_id uuid references businesses (business_id) on delete set null,
    reward_kind text not null
        check (reward_kind in ('voucher', 'commission_rebate')),
    promotion_id uuid references promotions (promotion_id) on delete set null,
    status text not null default 'pending'
        check (status in ('pending', 'issued', 'void')),
    available_at timestamptz,
    issued_at timestamptz,
    metadata jsonb not null default '{}',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (referral_id, beneficiary_type),
    check (
        beneficiary_customer_id is not null
        or beneficiary_business_id is not null
    ),
    check (
        (status = 'issued' and issued_at is not null)
        or status <> 'issued'
    )
);

create index referral_rewards_business_status_idx
    on referral_rewards (business_id, status, updated_at desc);

alter table referral_codes enable row level security;
alter table referral_codes force row level security;

create policy referral_codes_select on referral_codes
    for select
    using (
        current_setting('xtiitch.bypass', true) = 'on'
        or business_id is null
        or business_id = nullif(current_setting('xtiitch.current_business_id', true), '')::uuid
    );

create policy referral_codes_write on referral_codes
    for all
    using (
        current_setting('xtiitch.bypass', true) = 'on'
        or business_id = nullif(current_setting('xtiitch.current_business_id', true), '')::uuid
    )
    with check (
        current_setting('xtiitch.bypass', true) = 'on'
        or business_id = nullif(current_setting('xtiitch.current_business_id', true), '')::uuid
    );

alter table referrals enable row level security;
alter table referrals force row level security;

create policy referrals_tenant_isolation on referrals
    using (
        current_setting('xtiitch.bypass', true) = 'on'
        or business_id = nullif(current_setting('xtiitch.current_business_id', true), '')::uuid
    )
    with check (
        current_setting('xtiitch.bypass', true) = 'on'
        or business_id = nullif(current_setting('xtiitch.current_business_id', true), '')::uuid
    );

alter table referral_rewards enable row level security;
alter table referral_rewards force row level security;

create policy referral_rewards_tenant_isolation on referral_rewards
    using (
        current_setting('xtiitch.bypass', true) = 'on'
        or business_id = nullif(current_setting('xtiitch.current_business_id', true), '')::uuid
    )
    with check (
        current_setting('xtiitch.bypass', true) = 'on'
        or business_id = nullif(current_setting('xtiitch.current_business_id', true), '')::uuid
    );

grant select, insert, update, delete on referral_codes, referrals, referral_rewards to xtiitch_app;
