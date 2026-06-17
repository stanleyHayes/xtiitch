create table promotions (
    promotion_id uuid primary key default gen_random_uuid(),
    business_id uuid references businesses(business_id) on delete cascade,
    code text,
    title text not null,
    description text not null default '',
    discount_type text not null
        check (discount_type in ('percentage', 'fixed')),
    discount_value bigint not null check (discount_value > 0),
    max_discount_minor bigint check (max_discount_minor is null or max_discount_minor >= 0),
    min_spend_minor bigint not null default 0 check (min_spend_minor >= 0),
    usage_limit_global integer check (usage_limit_global is null or usage_limit_global > 0),
    usage_limit_per_customer integer check (usage_limit_per_customer is null or usage_limit_per_customer > 0),
    funding_source text not null default 'business'
        check (funding_source in ('business', 'platform', 'split')),
    scope text not null default 'store'
        check (scope in ('store', 'collection', 'design')),
    status text not null default 'active'
        check (status in ('active', 'paused', 'archived')),
    starts_at timestamptz,
    ends_at timestamptz,
    created_by_admin_user_id uuid references admin_users(admin_user_id) on delete set null,
    updated_by_admin_user_id uuid references admin_users(admin_user_id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (title <> ''),
    check (code is null or code ~ '^[A-Z0-9][A-Z0-9_-]{1,30}[A-Z0-9]$'),
    check (
        (discount_type = 'percentage' and discount_value <= 10000 and max_discount_minor is not null and max_discount_minor > 0)
        or discount_type = 'fixed'
    ),
    check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create unique index promotions_active_code_unique_idx
    on promotions (coalesce(business_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(code))
    where code is not null and status <> 'archived';

create index promotions_business_status_idx
    on promotions (business_id, status, updated_at desc);

create index promotions_status_window_idx
    on promotions (status, starts_at, ends_at);

create table promotion_redemptions (
    promotion_redemption_id uuid primary key default gen_random_uuid(),
    promotion_id uuid not null references promotions(promotion_id) on delete cascade,
    business_id uuid not null references businesses(business_id) on delete cascade,
    order_id uuid references orders(order_id) on delete set null,
    customer_id uuid references customers(customer_id) on delete set null,
    discount_minor bigint not null check (discount_minor >= 0),
    status text not null default 'pending'
        check (status in ('pending', 'applied', 'void')),
    redeemed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (promotion_id, order_id),
    check (
        (status = 'applied' and redeemed_at is not null)
        or status <> 'applied'
    )
);

create index promotion_redemptions_promotion_idx
    on promotion_redemptions (promotion_id, status, created_at desc);

create index promotion_redemptions_business_idx
    on promotion_redemptions (business_id, created_at desc);

alter table promotions enable row level security;
alter table promotions force row level security;

create policy promotions_read_isolation on promotions
    for select
    using (
        business_id is null
        or current_setting('xtiitch.bypass', true) = 'on'
        or business_id = nullif(current_setting('xtiitch.current_business_id', true), '')::uuid
    );

create policy promotions_write_isolation on promotions
    for all
    using (
        current_setting('xtiitch.bypass', true) = 'on'
        or business_id = nullif(current_setting('xtiitch.current_business_id', true), '')::uuid
    )
    with check (
        current_setting('xtiitch.bypass', true) = 'on'
        or business_id = nullif(current_setting('xtiitch.current_business_id', true), '')::uuid
    );

alter table promotion_redemptions enable row level security;
alter table promotion_redemptions force row level security;

create policy promotion_redemptions_tenant_isolation on promotion_redemptions
    using (
        current_setting('xtiitch.bypass', true) = 'on'
        or business_id = nullif(current_setting('xtiitch.current_business_id', true), '')::uuid
    )
    with check (
        current_setting('xtiitch.bypass', true) = 'on'
        or business_id = nullif(current_setting('xtiitch.current_business_id', true), '')::uuid
    );

alter table admin_role_permissions
    drop constraint if exists admin_role_permissions_permission_check;

alter table admin_role_permissions
    add constraint admin_role_permissions_permission_check
    check (
        permission in (
            'manage_admin_users',
            'manage_roles',
            'manage_settings',
            'review_businesses',
            'manage_money_rails',
            'manage_subscriptions',
            'manage_plans',
            'manage_promotions',
            'manage_risk',
            'manage_support',
            'view_audit'
        )
    );

insert into admin_role_permissions (role, permission)
values
    ('owner', 'manage_promotions'),
    ('operator', 'manage_promotions')
on conflict (role, permission) do nothing;

grant select, insert, update on promotions to xtiitch_app;
grant select, insert, update on promotion_redemptions to xtiitch_app;
