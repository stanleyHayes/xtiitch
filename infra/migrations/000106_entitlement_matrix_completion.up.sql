-- Spec §11.1 / §13.4 / §14.1 / §15.1: complete the admin feature matrix so every
-- launch entitlement is a matrix row, editable without a deploy.
--
-- 1. Remove the order/customer caps. §13.4 is a standing decision: "No cap on
--    orders or customers -- on any tier" and §11.1: "the matrix holds no order
--    limit". orders_per_month / customer_records were seeded in 000067 against
--    that decision and enforced nowhere, so they read as control that does not
--    exist. The values rows go with them (FK cascade).
--    plans.order_review_threshold stays: it is NOT a cap and not a matrix row --
--    it feeds only the internal, monitoring-only volume alert in the risk queue
--    (§13.4's optional "volume alert to the Xtiitch team ... never merchant-
--    facing"), which throttles nothing.
delete from plan_entitlement_features
where feature_key in ('orders_per_month', 'customer_records');

-- 2. Correct the staff-seat seeds to the sold tiers (§13.4: Free owner only /
--    Starter 2 / Growth 5 / Studio 10). 000067/000088 seeded 1/1/3/10, which is
--    not what is sold. plan_entitlement_values is the source of truth;
--    plans.staff_limit is its runtime projection, so both move together (the
--    mirror only runs on matrix saves, not on migrations).
update plan_entitlement_values v
set limit_value = case p.code
    when 'starter' then 2
    when 'growth' then 5
    when 'studio' then 10
    else 1
end,
    updated_at = now()
from plans p
where p.plan_id = v.plan_id
  and v.feature_key = 'staff_accounts';

update plans p
set staff_limit = case p.code
    when 'starter' then 2
    when 'growth' then 5
    when 'studio' then 10
    else 1
end,
    updated_at = now()
where p.code in ('free', 'starter', 'growth', 'studio');

-- 3. The new launch keys (§13.4/§14.1/§15.1). Encoding notes for the matrix UI:
--    booleans render as checkboxes, limits as numeric inputs. Level features are
--    limits 0..3 (0=basic, 1=standard, 2=full, 3=advanced); a NULL limit on
--    analytics_lookback_days means FULL history (the schema check forbids
--    negatives, so NULL carries "unlimited" exactly as it does for designs).
--    Only `promotions` is enforced by code in this release; the rest are stored,
--    matrix-editable launch defaults the app reads (honest enforced=false, same
--    convention as 000088).
insert into plan_entitlement_features (
    feature_key, label, description, category, value_type, unit, sort_order, enforced
)
values
    ('promotions', 'Promotions', 'Run discount-code promotions on the storefront (§13.4: paid plans only; Free-plan stores cannot run promotions).', 'Sales', 'boolean', '', 85, true),
    ('analytics_level', 'Analytics level', 'Analytics depth (§14.1): 0 = basic (money desk + totals), 1 = standard (+ trends, top sellers), 2 = full (+ breakdowns, customer analytics), 3 = advanced (+ team analytics, custom report builder).', 'Insights', 'limit', 'level 0-3', 91, false),
    ('analytics_lookback_days', 'Analytics history lookback', 'How far back analytics history reaches (§14.1): Free 30 days, Starter 365, Growth/Studio full. Blank limit means full history.', 'Insights', 'limit', 'days', 92, false),
    ('crm_level', 'Customer CRM level', 'Customer CRM depth (§15.1): 0 = basic (list + profile), 1 = standard (+ search, spend, notes), 2 = full (+ tags, segments, CSV export), 3 = advanced (any-format export).', 'CRM', 'limit', 'level 0-3', 105, false),
    ('export_csv', 'CSV export', 'Export reports and records as CSV (§14.4: Starter and above).', 'Insights', 'boolean', '', 115, false),
    ('export_pdf', 'PDF export', 'Export reports and records as PDF (§14.4: Growth and above).', 'Insights', 'boolean', '', 116, false),
    ('export_docx', 'DOCX export', 'Export reports and records as DOCX (§14.4: Studio any-format).', 'Insights', 'boolean', '', 117, false),
    ('export_xlsx', 'XLSX export', 'Export reports and records as Excel (§14.4: Studio any-format).', 'Insights', 'boolean', '', 118, false),
    ('scheduled_reports', 'Scheduled reports', 'Auto-generated emailed reports (§14.1): 0 = off, 1 = monthly, 2 = any cadence.', 'Insights', 'limit', '0=off 1=monthly 2=any', 125, false)
on conflict (feature_key) do update set
    label = excluded.label,
    description = excluded.description,
    category = excluded.category,
    value_type = excluded.value_type,
    unit = excluded.unit,
    sort_order = excluded.sort_order,
    enforced = excluded.enforced;

-- 4. Seed the launch defaults per tier. Unknown/operator-created plans get the
--    conservative Free-tier default (000088's precedent: never invent a grant a
--    plan never promised). `on conflict do nothing`: a matrix the admin has
--    since edited must not be reverted by a re-run.
insert into plan_entitlement_values (plan_id, feature_key, enabled, limit_value)
select
    p.plan_id,
    v.feature_key,
    v.enabled,
    v.limit_value
from plans p
join (
    values
        -- Promotions: paid plans only (§13.4 "Free-plan stores cannot run promotions").
        ('free', 'promotions', false, null::integer),
        ('starter', 'promotions', true, null::integer),
        ('growth', 'promotions', true, null::integer),
        ('studio', 'promotions', true, null::integer),
        -- Analytics level (§14.1): basic / standard / full / advanced as 0..3.
        ('free', 'analytics_level', true, 0),
        ('starter', 'analytics_level', true, 1),
        ('growth', 'analytics_level', true, 2),
        ('studio', 'analytics_level', true, 3),
        -- Lookback (§14.1): 30 days / 12 months / full / full (NULL = full).
        ('free', 'analytics_lookback_days', true, 30),
        ('starter', 'analytics_lookback_days', true, 365),
        ('growth', 'analytics_lookback_days', true, null::integer),
        ('studio', 'analytics_lookback_days', true, null::integer),
        -- CRM level (§15.1): basic / standard / full / advanced as 0..3.
        ('free', 'crm_level', true, 0),
        ('starter', 'crm_level', true, 1),
        ('growth', 'crm_level', true, 2),
        ('studio', 'crm_level', true, 3),
        -- Export formats (§14.4): Free none; Starter CSV; Growth CSV+PDF; Studio all.
        ('free', 'export_csv', false, null::integer),
        ('starter', 'export_csv', true, null::integer),
        ('growth', 'export_csv', true, null::integer),
        ('studio', 'export_csv', true, null::integer),
        ('free', 'export_pdf', false, null::integer),
        ('starter', 'export_pdf', false, null::integer),
        ('growth', 'export_pdf', true, null::integer),
        ('studio', 'export_pdf', true, null::integer),
        ('free', 'export_docx', false, null::integer),
        ('starter', 'export_docx', false, null::integer),
        ('growth', 'export_docx', false, null::integer),
        ('studio', 'export_docx', true, null::integer),
        ('free', 'export_xlsx', false, null::integer),
        ('starter', 'export_xlsx', false, null::integer),
        ('growth', 'export_xlsx', false, null::integer),
        ('studio', 'export_xlsx', true, null::integer),
        -- Scheduled reports (§14.1): Growth monthly, Studio any cadence.
        ('free', 'scheduled_reports', true, 0),
        ('starter', 'scheduled_reports', true, 0),
        ('growth', 'scheduled_reports', true, 1),
        ('studio', 'scheduled_reports', true, 2)
) as v(plan_code, feature_key, enabled, limit_value)
    on v.plan_code = p.code
on conflict (plan_id, feature_key) do nothing;

-- Free-tier defaults for operator-created plans (codes outside the four).
insert into plan_entitlement_values (plan_id, feature_key, enabled, limit_value)
select
    p.plan_id,
    d.feature_key,
    d.enabled,
    d.limit_value
from plans p
join (
    values
        ('promotions', false, null::integer),
        ('analytics_level', true, 0),
        ('analytics_lookback_days', true, 30),
        ('crm_level', true, 0),
        ('export_csv', false, null::integer),
        ('export_pdf', false, null::integer),
        ('export_docx', false, null::integer),
        ('export_xlsx', false, null::integer),
        ('scheduled_reports', true, 0)
) as d(feature_key, enabled, limit_value) on true
where p.code not in ('free', 'starter', 'growth', 'studio')
on conflict (plan_id, feature_key) do nothing;

-- 5. Project the new boolean keys into plans.features for the runtime read path
--    (same projection the matrix mirror maintains on every save), so gating and
--    the owner dashboard see the seeded values without waiting for a matrix edit.
update plans p
set features = coalesce(p.features, '{}'::jsonb) || coalesce((
        select jsonb_object_agg(v.feature_key, true)
        from plan_entitlement_values v
        where v.plan_id = p.plan_id
          and v.enabled
          and v.feature_key in ('promotions', 'export_csv', 'export_pdf', 'export_docx', 'export_xlsx')
    ), '{}'::jsonb),
    updated_at = now()
where p.code in ('free', 'starter', 'growth', 'studio');
