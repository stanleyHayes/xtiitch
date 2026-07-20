-- Reverts 000106: restore the pre-§13.4 matrix shape.
--
-- 1. Drop the new launch keys (values cascade on the feature FK) and un-project
--    the new boolean keys from plans.features.
delete from plan_entitlement_features
where feature_key in (
    'promotions',
    'analytics_level',
    'analytics_lookback_days',
    'crm_level',
    'export_csv',
    'export_pdf',
    'export_docx',
    'export_xlsx',
    'scheduled_reports'
);

update plans p
set features = coalesce(p.features, '{}'::jsonb)
    - 'promotions' - 'export_csv' - 'export_pdf' - 'export_docx' - 'export_xlsx',
    updated_at = now();

-- 2. Restore the 000067/000088 staff-seat seeds (1/1/3/10).
update plan_entitlement_values v
set limit_value = case p.code
    when 'studio' then 10
    when 'growth' then 3
    else 1
end,
    updated_at = now()
from plans p
where p.plan_id = v.plan_id
  and v.feature_key = 'staff_accounts';

update plans p
set staff_limit = case p.code
    when 'studio' then 10
    when 'growth' then 3
    else 1
end,
    updated_at = now()
where p.code in ('free', 'starter', 'growth', 'studio');

-- 3. Restore the removed cap rows exactly as 000067 seeded them (values
--    included), so a roll-back leaves the matrix byte-identical to before.
insert into plan_entitlement_features (
    feature_key, label, description, category, value_type, unit, sort_order
)
values
    ('orders_per_month', 'Orders per month', 'Maximum monthly order volume before upgrade review.', 'Limits', 'limit', 'orders', 140),
    ('customer_records', 'Customer and measurement records', 'Maximum retained customer and measurement records.', 'Limits', 'limit', 'records', 150)
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
        ('free', 'orders_per_month', true, 30),
        ('free', 'customer_records', true, 25),
        ('starter', 'orders_per_month', true, 200),
        ('starter', 'customer_records', true, 250),
        ('growth', 'orders_per_month', true, null::integer),
        ('growth', 'customer_records', true, null::integer),
        ('studio', 'orders_per_month', true, null::integer),
        ('studio', 'customer_records', true, null::integer)
) as v(plan_code, feature_key, enabled, limit_value)
    on v.plan_code = p.code
on conflict (plan_id, feature_key) do nothing;
