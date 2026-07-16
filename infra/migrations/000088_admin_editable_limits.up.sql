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
