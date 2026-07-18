-- Testing Report §7.3 names three limits an admin must control without a
-- deploy: images per design, colour variations, and orders. Images and
-- variations were enforced from constants compiled into the API (free=2/paid=5
-- images; Free 2 / Starter 3 / Growth 5 / Studio 10 variations), so the admin
-- matrix could not touch them. These columns give them the same shape
-- design_limit already has: a plan column the entitlements matrix mirrors into.
--
-- staff_accounts was sold per plan (Free 1 / Starter 1 / Growth 3 / Studio 10)
-- and enforced NOWHERE -- every plan, including Free, had unlimited dashboard
-- seats. It gets a column here so the sold limit becomes the real one.
--
-- NULL means unlimited in all three, matching design_limit.
alter table plans add column if not exists image_limit integer
    check (image_limit is null or image_limit >= 0);
alter table plans add column if not exists variation_limit integer
    check (variation_limit is null or variation_limit >= 0);
alter table plans add column if not exists staff_limit integer
    check (staff_limit is null or staff_limit >= 0);

-- Backfill from the constants being replaced, so this migration is a behaviour
-- no-op on day one: every plan keeps exactly the caps it had. Matching on code
-- rather than assuming plan rows exist -- an operator may have added plans.
update plans set image_limit = case when code = 'free' then 2 else 5 end
where image_limit is null;

update plans set variation_limit = case code
    when 'starter' then 3
    when 'growth' then 5
    when 'studio' then 10
    else 2
end
where variation_limit is null;

update plans set staff_limit = case code
    when 'growth' then 3
    when 'studio' then 10
    when 'starter' then 1
    when 'free' then 1
    -- An operator-created plan gets no seat cap rather than the most
    -- restrictive one: inventing a cap of 1 here would lock existing teams out
    -- of a plan that never promised a limit.
    else null
end
where staff_limit is null;

-- Self-heal for a database that marked 000067 applied without its effects (a
-- forced version skip, which is exactly how a production database can reach
-- version 86+ with these tables missing): recreate the entitlements schema and
-- seeds as 000067 wrote them. Every statement is a no-op on a healthy
-- database -- the tables exist and every seed row conflicts -- so this only
-- repairs databases where 000067 was skipped. `do nothing`, never `do update`:
-- a matrix the admin has since edited must not be reverted by a repair.
create table if not exists plan_entitlement_features (
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

create table if not exists plan_entitlement_values (
    plan_id uuid not null references plans(plan_id) on delete cascade,
    feature_key text not null references plan_entitlement_features(feature_key) on delete cascade,
    enabled boolean not null default false,
    limit_value integer check (limit_value is null or limit_value >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (plan_id, feature_key)
);

create index if not exists plan_entitlement_values_feature_idx
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
on conflict (feature_key) do nothing;

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
on conflict (plan_id, feature_key) do nothing;

grant select, insert, update on plan_entitlement_features, plan_entitlement_values to xtiitch_app;

-- An admin editing a row that changes nothing is worse than a missing row: it
-- reads as control that exists. Record which keys the code actually enforces so
-- the matrix can say so, rather than presenting nine dead toggles as live ones.
alter table plan_entitlement_features
    add column if not exists enforced boolean not null default false;

insert into plan_entitlement_features (
    feature_key, label, description, category, value_type, unit, sort_order
)
values
    ('images_per_design', 'Images per design', 'Maximum images on a single catalogue design, including each colour variation.', 'Limits', 'limit', 'images', 132),
    ('variations_per_design', 'Colour variations per design', 'Maximum colour variations on a single design, counting the default.', 'Limits', 'limit', 'variations', 134)
on conflict (feature_key) do update set
    label = excluded.label,
    description = excluded.description,
    category = excluded.category,
    value_type = excluded.value_type,
    unit = excluded.unit,
    sort_order = excluded.sort_order;

-- Seed the new keys from the same constants, per plan, so the matrix opens
-- showing the caps that are actually in force rather than blanks that would
-- read as "unlimited".
insert into plan_entitlement_values (plan_id, feature_key, enabled, limit_value)
select p.plan_id, 'images_per_design', true,
    case when p.code = 'free' then 2 else 5 end
from plans p
on conflict (plan_id, feature_key) do nothing;

insert into plan_entitlement_values (plan_id, feature_key, enabled, limit_value)
select p.plan_id, 'variations_per_design', true,
    case p.code
        when 'starter' then 3
        when 'growth' then 5
        when 'studio' then 10
        else 2
    end
from plans p
on conflict (plan_id, feature_key) do nothing;

-- The keys the code genuinely gates on after this release. Everything else stays
-- enforced = false and the matrix labels it as not yet enforced -- including
-- remove_powered_by_badge (paid plans are sold the removal of a badge that is
-- rendered nowhere), orders_per_month and customer_records (no counter exists),
-- and analytics_advanced_reports (no advanced surface exists to withhold).
-- priority_support and dedicated_success are human commitments, not code gates,
-- and are honestly unenforceable by software.
update plan_entitlement_features
set enforced = true
where feature_key in (
    'custom_brand_color',
    'custom_logo',
    'custom_banner',
    'custom_layout',
    'design_waitlist',
    'online_ordering',
    'designs',
    'images_per_design',
    'variations_per_design',
    'staff_accounts'
);
