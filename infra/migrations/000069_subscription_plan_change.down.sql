drop index if exists business_subscriptions_pending_plan_idx;

alter table business_subscriptions
    drop constraint if exists business_subscriptions_pending_plan_pair_check;

alter table business_subscriptions
    drop column if exists pending_plan_effective_at;

alter table business_subscriptions
    drop column if exists pending_plan_id;
