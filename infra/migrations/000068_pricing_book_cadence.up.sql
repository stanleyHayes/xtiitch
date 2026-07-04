-- Pricing Book quarterly/yearly billing (Xtiitch-Pricing-Book.pdf §1-2).
--
-- Subscriptions are billed QUARTERLY (3 months) or YEARLY (12 months) only —
-- there is no monthly billing. The monthly rate remains the display/calculation
-- basis (plans.monthly_fee_minor), but the amount actually charged is one of the
-- fixed figures below: the FIRST paid subscription bills the INTRO figure and
-- every renewal bills the FULL figure. The figures are stored verbatim so the
-- charge path never computes a percentage live.
--
-- NOTE: this is migration 000068 rather than 000067 because the 000067 slot was
-- already taken by 000067_subscription_discounts_entitlements.

-- plans is a global, non-tenant table (no RLS), so plain ALTER/UPDATE apply.
alter table plans add column if not exists quarterly_first_minor integer not null default 0;
alter table plans add column if not exists quarterly_renewal_minor integer not null default 0;
alter table plans add column if not exists yearly_first_minor integer not null default 0;
alter table plans add column if not exists yearly_renewal_minor integer not null default 0;

-- Master price table (GHS minor units). Free stays 0 (no subscription billing).
update plans set
    quarterly_first_minor = 11800,
    quarterly_renewal_minor = 14700,
    yearly_first_minor = 44100,
    yearly_renewal_minor = 58800,
    updated_at = now()
where code = 'starter';

update plans set
    quarterly_first_minor = 23800,
    quarterly_renewal_minor = 29700,
    yearly_first_minor = 89100,
    yearly_renewal_minor = 118800,
    updated_at = now()
where code = 'growth';

update plans set
    quarterly_first_minor = 47800,
    quarterly_renewal_minor = 59700,
    yearly_first_minor = 179100,
    yearly_renewal_minor = 238800,
    updated_at = now()
where code = 'studio';

-- business_subscriptions is a tenant table under FORCE row level security.
-- The DDL ALTERs below need no RLS bypass, but the backfill UPDATE further down
-- does (it is a data-modifying statement run by the non-superuser migration
-- role against FORCE-RLS rows) — see the wrapped block below.
alter table business_subscriptions
    add column if not exists billing_cadence text not null default 'monthly'
        check (billing_cadence in ('monthly', 'quarterly', 'yearly'));

alter table business_subscriptions
    add column if not exists first_purchase_consumed boolean not null default false;

-- Backfill: any subscription that has ALREADY been charged has consumed its
-- one-time intro, so a later cancel+resubscribe must not re-grant it. New
-- (never-charged) subscriptions keep first_purchase_consumed = false.
--
-- This UPDATE touches FORCE-RLS tenant rows under the non-superuser migration
-- role, so it MUST run under the app's session-level RLS bypass (turned on
-- here, off at the end). This is the project's load-bearing RLS migration
-- lesson: DDL ALTERs above need no bypass, but this data UPDATE does.
select set_config('xtiitch.bypass', 'on', false);

update business_subscriptions
set first_purchase_consumed = true,
    updated_at = now()
where last_payment_at is not null
   or status in ('active', 'past_due', 'grace_period', 'canceled');

select set_config('xtiitch.bypass', 'off', false);
