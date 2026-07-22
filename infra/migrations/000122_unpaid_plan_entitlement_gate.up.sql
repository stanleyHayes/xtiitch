-- 000122_unpaid_plan_entitlement_gate
--
-- A paid plan selected at signup used to be written directly to both
-- businesses.plan_id and business_subscriptions.plan_id before Paystack had
-- received anything. The activation banner was correct, but entitlement paths
-- that read businesses.plan_id could still grant paid analytics, CRM, staff
-- limits, exports, and other capabilities.
--
-- Park every never-paid paid plan as the payment-pending target introduced by
-- 000118, and make Free the effective plan. The selected paid plan still drives
-- activation display and checkout pricing through pending_plan_id. Only the
-- Paystack-verified callback moves it back onto the business/subscription.

select set_config('xtiitch.bypass', 'on', false);

with free_plan as (
    select plan_id
    from plans
    where code = 'free' and is_active = true
    limit 1
), parked as (
    update business_subscriptions s
    set pending_plan_id = s.plan_id,
        pending_plan_effective_at = null,
        plan_id = free_plan.plan_id,
        status = 'trialing',
        updated_at = now()
    from plans current_plan, free_plan
    where s.plan_id = current_plan.plan_id
        and current_plan.monthly_fee_minor > 0
        and not coalesce(s.first_purchase_consumed, false)
        and s.pending_plan_id is null
    returning s.business_id
)
update businesses b
set plan_id = free_plan.plan_id,
    updated_at = now()
from parked, free_plan
where b.business_id = parked.business_id;

select set_config('xtiitch.bypass', 'off', false);
