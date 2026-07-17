update plan_entitlement_features
set enforced = false, updated_at = now()
where feature_key in ('remove_powered_by_badge', 'orders_per_month');

-- Withdraw the badge key from the runtime projection: the code that reads it is
-- gone on the way down, and leaving it would have no effect but would confuse a
-- later mirror diff.
update plans
set features = coalesce(features, '{}'::jsonb) - 'remove_powered_by_badge',
    updated_at = now();

alter table plans drop column if exists order_review_threshold;

update plan_entitlement_features
set label = 'Orders per month',
    description = 'Maximum monthly order volume before upgrade review.',
    category = 'Limits',
    unit = 'orders',
    updated_at = now()
where feature_key = 'orders_per_month';

update plan_entitlement_features
set is_active = true, updated_at = now()
where feature_key = 'customer_records';

update plans set staff_limit = 1 where code = 'starter';
update plans set staff_limit = 3 where code = 'growth';

update plan_entitlement_values v
set limit_value = 1, updated_at = now()
from plans p
where p.plan_id = v.plan_id and v.feature_key = 'staff_accounts' and p.code = 'starter';

update plan_entitlement_values v
set limit_value = 3, updated_at = now()
from plans p
where p.plan_id = v.plan_id and v.feature_key = 'staff_accounts' and p.code = 'growth';
