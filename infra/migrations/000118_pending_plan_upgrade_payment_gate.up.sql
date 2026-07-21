-- 000118_pending_plan_upgrade_payment_gate
--
-- Payment-gated plan upgrades (critical fix): a paid plan's features must unlock
-- ONLY when Paystack has verified the first payment. Before this migration the
-- activation flow switched the plan at checkout INITIALIZE (before any money
-- moved), instantly unlocking the target plan's entitlements for free.
--
-- The fix parks the upgrade target on the subscription as PAYMENT-PENDING:
-- pending_plan_id set with a NULL pending_plan_effective_at. Entitlements keep
-- resolving from the current paid-up plan (businesses.plan_id is untouched)
-- until the verified payment applies the switch and clears the pending fields.
--
-- This is a NEW state for the pair of columns 000069 added, which its CHECK
-- forbade (it required both-or-neither). The two pending shapes now are:
--   * pending_plan_id + pending_plan_effective_at  -> a SCHEDULED DOWNGRADE the
--     renewal sweep applies at period end (000069, unchanged); and
--   * pending_plan_id + NULL pending_plan_effective_at -> an UPGRADE AWAITING a
--     Paystack-verified payment. The renewal sweep never touches it (it requires
--     effective_at <= now()), and a NULL effective_at still forbids a NULL
--     pending_plan_id, so the only remaining illegal state is (NULL, set).
--
-- business_subscriptions is a tenant table under FORCE row level security. This
-- is a pure DDL constraint swap, so it needs no RLS bypass and no data backfill
-- (no existing row can be in the newly-admitted state — the old CHECK forbade
-- it).
alter table business_subscriptions
    drop constraint if exists business_subscriptions_pending_plan_pair_check;

alter table business_subscriptions
    add constraint business_subscriptions_pending_plan_pair_check
    check (
        pending_plan_effective_at is null
        or pending_plan_id is not null
    );
