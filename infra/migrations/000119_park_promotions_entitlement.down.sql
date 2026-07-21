-- Reverts 000119: unpark Promotions — restore the matrix feature row, the
-- per-plan launch defaults (§13.4: paid plans only), and the runtime jsonb
-- projection, exactly as 000106 seeded them.

-- 1. The matrix feature row (same definition as 000106).
insert into plan_entitlement_features (
    feature_key, label, description, category, value_type, unit, sort_order, enforced
)
values
    ('promotions', 'Promotions', 'Run discount-code promotions on the storefront (§13.4: paid plans only; Free-plan stores cannot run promotions).', 'Sales', 'boolean', '', 85, true)
on conflict (feature_key) do nothing;

-- 2. The per-tier launch defaults, plus the conservative Free-tier default for
--    operator-created plans (000106's precedent). `on conflict do nothing`: a
--    matrix the admin has since edited must not be reverted by a roll-back.
insert into plan_entitlement_values (plan_id, feature_key, enabled, limit_value)
select
    p.plan_id,
    'promotions',
    p.code in ('starter', 'growth', 'studio'),
    null::integer
from plans p
on conflict (plan_id, feature_key) do nothing;

-- 3. Re-project the boolean key into plans.features for the runtime read path,
--    for every plan whose restored value row grants it.
update plans p
set features = coalesce(p.features, '{}'::jsonb) || jsonb_build_object('promotions', true),
    updated_at = now()
where exists (
    select 1 from plan_entitlement_values v
    where v.plan_id = p.plan_id
      and v.feature_key = 'promotions'
      and v.enabled
);
