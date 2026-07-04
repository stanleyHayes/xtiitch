create table plan_entitlement_features (
    feature_key text primary key,
    label text not null,
    description text not null default '',
    category text not null default 'General',
    value_type text not null default 'boolean'
        check (value_type in ('boolean', 'limit')),
    unit text not null default '',
    sort_order integer not null default 0,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (feature_key ~ '^[a-z0-9][a-z0-9_]*[a-z0-9]$')
);

create table plan_entitlement_values (
    plan_id uuid not null references plans(plan_id) on delete cascade,
    feature_key text not null references plan_entitlement_features(feature_key) on delete cascade,
    enabled boolean not null default false,
    limit_value integer check (limit_value is null or limit_value >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (plan_id, feature_key)
);

create index plan_entitlement_values_feature_idx
    on plan_entitlement_values (feature_key, enabled);

insert into plan_entitlement_features (
    feature_key, label, description, category, value_type, unit, sort_order
)
values
    ('branded_store_link', 'Branded store link', 'Business receives a public Xtiitch store URL.', 'Storefront', 'boolean', '', 10),
    ('online_ordering', 'Online ordering and checkout', 'Customers can place and pay for orders from the storefront.', 'Storefront', 'boolean', '', 20),
    ('remove_powered_by_badge', 'Remove Xtiitch badge', 'Hide the powered-by badge on the public storefront.', 'Storefront', 'boolean', '', 30),
    ('custom_brand_color', 'Storefront accent colour', 'Set the storefront accent colour instead of the Xtiitch default.', 'Storefront', 'boolean', '', 40),
    ('custom_logo', 'Custom storefront logo', 'Show a business logo on the storefront.', 'Storefront', 'boolean', '', 50),
    ('custom_banner', 'Custom hero banner image', 'Replace the default storefront hero with a business banner.', 'Storefront', 'boolean', '', 60),
    ('custom_layout', 'Storefront layout variants', 'Choose between approved storefront layout variants.', 'Storefront', 'boolean', '', 70),
    ('design_waitlist', 'Design waiting lists', 'Collect waitlist interest for unavailable or made-to-order pieces.', 'Storefront', 'boolean', '', 80),
    ('analytics_standard', 'Standard analytics', 'Access core storefront and sales analytics.', 'Insights', 'boolean', '', 90),
    ('analytics_advanced_reports', 'Advanced analytics exports', 'Access deeper package, catalogue, and CRM analytics.', 'Insights', 'boolean', '', 100),
    ('priority_support', 'Priority support', 'Prioritised support handling for subscription and storefront issues.', 'Support', 'boolean', '', 110),
    ('dedicated_success', 'Dedicated success support', 'Assigned success support for larger studios and institutions.', 'Support', 'boolean', '', 120),
    ('designs', 'Active designs', 'Maximum active catalogue designs; blank limit means unlimited.', 'Limits', 'limit', 'designs', 130),
    ('orders_per_month', 'Orders per month', 'Maximum monthly order volume before upgrade review.', 'Limits', 'limit', 'orders', 140),
    ('customer_records', 'Customer and measurement records', 'Maximum retained customer and measurement records.', 'Limits', 'limit', 'records', 150),
    ('staff_accounts', 'Staff accounts', 'Maximum dashboard users for the business.', 'Limits', 'limit', 'users', 160)
on conflict (feature_key) do update set
    label = excluded.label,
    description = excluded.description,
    category = excluded.category,
    value_type = excluded.value_type,
    unit = excluded.unit,
    sort_order = excluded.sort_order,
    is_active = true,
    updated_at = now();

insert into plan_entitlement_values (plan_id, feature_key, enabled, limit_value)
select
    p.plan_id,
    v.feature_key,
    v.enabled,
    v.limit_value
from plans p
join (
    values
        ('free', 'branded_store_link', true, null::integer),
        ('free', 'online_ordering', true, null::integer),
        ('free', 'remove_powered_by_badge', false, null::integer),
        ('free', 'custom_brand_color', false, null::integer),
        ('free', 'custom_logo', false, null::integer),
        ('free', 'custom_banner', false, null::integer),
        ('free', 'custom_layout', false, null::integer),
        ('free', 'design_waitlist', false, null::integer),
        ('free', 'analytics_standard', true, null::integer),
        ('free', 'analytics_advanced_reports', false, null::integer),
        ('free', 'priority_support', false, null::integer),
        ('free', 'dedicated_success', false, null::integer),
        ('free', 'designs', true, 10),
        ('free', 'orders_per_month', true, 30),
        ('free', 'customer_records', true, 25),
        ('free', 'staff_accounts', true, 1),

        ('starter', 'branded_store_link', true, null::integer),
        ('starter', 'online_ordering', true, null::integer),
        ('starter', 'remove_powered_by_badge', true, null::integer),
        ('starter', 'custom_brand_color', true, null::integer),
        ('starter', 'custom_logo', true, null::integer),
        ('starter', 'custom_banner', false, null::integer),
        ('starter', 'custom_layout', false, null::integer),
        ('starter', 'design_waitlist', false, null::integer),
        ('starter', 'analytics_standard', true, null::integer),
        ('starter', 'analytics_advanced_reports', false, null::integer),
        ('starter', 'priority_support', false, null::integer),
        ('starter', 'dedicated_success', false, null::integer),
        ('starter', 'designs', true, 50),
        ('starter', 'orders_per_month', true, 200),
        ('starter', 'customer_records', true, 250),
        ('starter', 'staff_accounts', true, 1),

        ('growth', 'branded_store_link', true, null::integer),
        ('growth', 'online_ordering', true, null::integer),
        ('growth', 'remove_powered_by_badge', true, null::integer),
        ('growth', 'custom_brand_color', true, null::integer),
        ('growth', 'custom_logo', true, null::integer),
        ('growth', 'custom_banner', true, null::integer),
        ('growth', 'custom_layout', true, null::integer),
        ('growth', 'design_waitlist', true, null::integer),
        ('growth', 'analytics_standard', true, null::integer),
        ('growth', 'analytics_advanced_reports', true, null::integer),
        ('growth', 'priority_support', true, null::integer),
        ('growth', 'dedicated_success', false, null::integer),
        ('growth', 'designs', true, null::integer),
        ('growth', 'orders_per_month', true, null::integer),
        ('growth', 'customer_records', true, null::integer),
        ('growth', 'staff_accounts', true, 3),

        ('studio', 'branded_store_link', true, null::integer),
        ('studio', 'online_ordering', true, null::integer),
        ('studio', 'remove_powered_by_badge', true, null::integer),
        ('studio', 'custom_brand_color', true, null::integer),
        ('studio', 'custom_logo', true, null::integer),
        ('studio', 'custom_banner', true, null::integer),
        ('studio', 'custom_layout', true, null::integer),
        ('studio', 'design_waitlist', true, null::integer),
        ('studio', 'analytics_standard', true, null::integer),
        ('studio', 'analytics_advanced_reports', true, null::integer),
        ('studio', 'priority_support', true, null::integer),
        ('studio', 'dedicated_success', true, null::integer),
        ('studio', 'designs', true, null::integer),
        ('studio', 'orders_per_month', true, null::integer),
        ('studio', 'customer_records', true, null::integer),
        ('studio', 'staff_accounts', true, 10)
) as v(plan_code, feature_key, enabled, limit_value)
    on v.plan_code = p.code
on conflict (plan_id, feature_key) do update set
    enabled = excluded.enabled,
    limit_value = excluded.limit_value,
    updated_at = now();

update plans p
set features = coalesce(runtime.features, '{}'::jsonb),
    design_limit = designs.limit_value,
    updated_at = now()
from (
    select
        v.plan_id,
        coalesce(
            jsonb_object_agg(v.feature_key, true) filter (
                where v.enabled
                  and v.feature_key in (
                      'custom_brand_color',
                      'custom_logo',
                      'custom_banner',
                      'custom_layout',
                      'design_waitlist',
                      'online_ordering'
                  )
            ),
            '{}'::jsonb
        ) as features
    from plan_entitlement_values v
    group by v.plan_id
) runtime
left join plan_entitlement_values designs
    on designs.plan_id = runtime.plan_id
   and designs.feature_key = 'designs'
where p.plan_id = runtime.plan_id;

create table subscription_discount_codes (
    discount_code_id uuid primary key default gen_random_uuid(),
    code text not null unique,
    discount_type text not null
        check (discount_type in ('free_period', 'percentage', 'fixed')),
    discount_value integer not null check (discount_value > 0),
    eligible_plans text[] not null default '{}'::text[],
    eligible_cadences text[] not null default '{}'::text[],
    first_purchase_only boolean not null default true,
    max_redemptions_total integer check (max_redemptions_total is null or max_redemptions_total > 0),
    max_per_account integer not null default 1 check (max_per_account > 0),
    valid_from timestamptz,
    valid_until timestamptz,
    active boolean not null default true,
    owner_name text not null default '',
    batch_label text not null default '',
    stackable boolean not null default false,
    created_by_admin_user_id uuid references admin_users(admin_user_id) on delete set null,
    updated_by_admin_user_id uuid references admin_users(admin_user_id) on delete set null,
    archived_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (code = upper(code)),
    check (code ~ '^[A-Z0-9][A-Z0-9_-]{1,30}[A-Z0-9]$'),
    check (valid_until is null or valid_from is null or valid_until > valid_from)
);

create index subscription_discount_codes_active_idx
    on subscription_discount_codes (active, valid_from, valid_until);

create index subscription_discount_codes_owner_idx
    on subscription_discount_codes (owner_name, batch_label, created_at desc);

create table subscription_discount_redemptions (
    redemption_id uuid primary key default gen_random_uuid(),
    discount_code_id uuid not null references subscription_discount_codes(discount_code_id) on delete cascade,
    business_id uuid not null references businesses(business_id) on delete cascade,
    subscription_id uuid references business_subscriptions(subscription_id) on delete set null,
    invoice_id uuid references business_subscription_invoices(invoice_id) on delete set null,
    account_key text not null default '',
    plan_code text not null default '',
    cadence text not null default '',
    discount_minor bigint not null default 0 check (discount_minor >= 0),
    status text not null default 'pending'
        check (status in ('pending', 'applied', 'void', 'expired')),
    created_at timestamptz not null default now(),
    applied_at timestamptz,
    updated_at timestamptz not null default now()
);

create index subscription_discount_redemptions_code_idx
    on subscription_discount_redemptions (discount_code_id, status, created_at desc);

create index subscription_discount_redemptions_business_idx
    on subscription_discount_redemptions (business_id, created_at desc);

create index subscription_discount_redemptions_account_idx
    on subscription_discount_redemptions (discount_code_id, account_key);

alter table subscription_discount_redemptions enable row level security;
alter table subscription_discount_redemptions force row level security;

create policy subscription_discount_redemptions_tenant_isolation
    on subscription_discount_redemptions
    using (
        current_setting('xtiitch.bypass', true) = 'on'
        or business_id = nullif(current_setting('xtiitch.current_business_id', true), '')::uuid
    )
    with check (
        current_setting('xtiitch.bypass', true) = 'on'
        or business_id = nullif(current_setting('xtiitch.current_business_id', true), '')::uuid
    );

grant select, insert, update on plan_entitlement_features, plan_entitlement_values to xtiitch_app;
grant select, insert, update on subscription_discount_codes, subscription_discount_redemptions to xtiitch_app;
