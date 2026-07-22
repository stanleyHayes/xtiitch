-- Restore the pre-000122 shape: an unpaid selected plan is effective directly.
-- This intentionally removes the pending target before 000118 can be rolled
-- back and restore its stricter both-or-neither constraint.

select set_config('xtiitch.bypass', 'on', false);

with restored as (
    update business_subscriptions s
    set plan_id = s.pending_plan_id,
        pending_plan_id = null,
        pending_plan_effective_at = null,
        updated_at = now()
    from plans current_plan, plans pending_plan
    where s.plan_id = current_plan.plan_id
        and current_plan.code = 'free'
        and s.pending_plan_id = pending_plan.plan_id
        and pending_plan.monthly_fee_minor > 0
        and s.pending_plan_effective_at is null
        and not coalesce(s.first_purchase_consumed, false)
    returning s.business_id, s.plan_id
)
update businesses b
set plan_id = restored.plan_id,
    updated_at = now()
from restored
where b.business_id = restored.business_id;

select set_config('xtiitch.bypass', 'off', false);
