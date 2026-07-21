-- Reverts 000118: restore the 000069 both-or-neither pair CHECK.
--
-- Rows parked as payment-pending (pending_plan_id set, effective_at NULL) would
-- violate the restored CHECK, so they are cleared first. Clearing one simply
-- abandons that unpaid upgrade attempt — it never moved entitlements, so there
-- is nothing else to undo; the owner re-checks-out to retry.
update business_subscriptions
set pending_plan_id = null,
    updated_at = now()
where pending_plan_id is not null
    and pending_plan_effective_at is null;

alter table business_subscriptions
    drop constraint if exists business_subscriptions_pending_plan_pair_check;

alter table business_subscriptions
    add constraint business_subscriptions_pending_plan_pair_check
    check (
        (pending_plan_id is null and pending_plan_effective_at is null)
        or (pending_plan_id is not null and pending_plan_effective_at is not null)
    );
