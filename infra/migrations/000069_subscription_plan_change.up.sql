-- Self-serve subscription plan change with proration (Xtiitch-Pricing-Book.pdf §7).
--
-- An UPGRADE (new plan costs more) switches immediately: the tenant's plan_id
-- changes now (subscription + business, so entitlements take effect at once) and
-- the prorated difference for the remainder of the current period is charged. That
-- switch is not recorded here — it mutates existing columns.
--
-- A DOWNGRADE (new plan costs less) is deferred to the next renewal: no refund and
-- no entitlement change mid-cycle. The pending change is parked on the subscription
-- in the two columns below and applied by the recurring renewal sweep when the
-- current paid period ends.
--
-- business_subscriptions is a tenant table under FORCE row level security. These
-- are pure DDL ALTERs adding NULLABLE columns, so they need no RLS bypass, and no
-- data backfill is required (existing rows default both columns to NULL, meaning
-- "no pending change"). The table-level grant from 000021 already covers new
-- columns, so no re-grant is needed.
alter table business_subscriptions
    add column if not exists pending_plan_id uuid references plans(plan_id);

alter table business_subscriptions
    add column if not exists pending_plan_effective_at timestamptz;

-- A pending change is meaningful only when both fields are set together: guard
-- against a half-written row where one is null and the other is not.
alter table business_subscriptions
    drop constraint if exists business_subscriptions_pending_plan_pair_check;

alter table business_subscriptions
    add constraint business_subscriptions_pending_plan_pair_check
    check (
        (pending_plan_id is null and pending_plan_effective_at is null)
        or (pending_plan_id is not null and pending_plan_effective_at is not null)
    );

-- Partial index so the renewal sweep can find rows with a due pending change
-- cheaply without scanning the whole table.
create index if not exists business_subscriptions_pending_plan_idx
    on business_subscriptions (pending_plan_effective_at)
    where pending_plan_id is not null;
