-- Subscription renewal reminders (Xtiitch-Pricing-Book.pdf §7 "CRITICAL — MoMo
-- & auto-renewal").
--
-- Mobile-money (MoMo) authorizations usually cannot be silently auto-debited the
-- way card authorizations can, so the recurring sweep reminds a business to
-- re-pay (one tap, via the existing business billing/onboarding flow) instead of
-- relying on a silent charge that would just fail and spam. Two pieces of state
-- support that:
--
--   1. business_subscriptions.provider_channel — the Paystack authorization
--      channel ('card', 'mobile_money', 'bank', …). '' means unknown/legacy and
--      is treated as card-like, so the existing silent auto-charge is preserved
--      for every row that predates this migration. 'mobile_money' flips the
--      subscription to reminder-driven.
--   2. subscription_reminders — an idempotency log so that each
--      (subscription, billing period, reminder kind) reminder is enqueued to the
--      outbox at most once. Repeated sweeps within the same period are a no-op;
--      a new period (new next_billing_at / grace window) re-arms the reminder.

-- business_subscriptions is a tenant table under FORCE row level security. This
-- is a DDL ALTER only (a new column with a constant default), so it needs no RLS
-- bypass and there is no data-modifying backfill here — every existing row keeps
-- the safe '' (card-like) default.
alter table business_subscriptions
    add column if not exists provider_channel text not null default '';

create table if not exists subscription_reminders (
    reminder_id uuid primary key default gen_random_uuid(),
    subscription_id uuid not null
        references business_subscriptions (subscription_id) on delete cascade,
    business_id uuid not null references businesses (business_id) on delete cascade,
    kind text not null check (kind <> ''),
    -- period_key pins a reminder to one billing cycle (the renewal timestamp for
    -- an upcoming reminder, the grace-window end for a past-due reminder) so
    -- repeated sweeps within the same cycle stay a no-op while a new cycle re-arms
    -- the reminder.
    period_key text not null check (period_key <> ''),
    sent_at timestamptz not null default now(),
    unique (subscription_id, kind, period_key)
);

create index subscription_reminders_business_idx
    on subscription_reminders (business_id, sent_at desc);

-- Tenant isolation under the project's hardened RLS shape (bypass-clause +
-- FORCE). The platform recurring sweep enqueues reminders under the cross-tenant
-- bypass; a business can read its own reminder log under tenant scope.
do $$
declare
    tenant_table text;
    policy_using text := '(current_setting(''xtiitch.bypass'', true) = ''on'''
        || ' OR business_id = NULLIF(current_setting(''xtiitch.current_business_id'', true), '''')::uuid)';
begin
    foreach tenant_table in array array['subscription_reminders'] loop
        execute format('alter table %I enable row level security', tenant_table);
        execute format('alter table %I force row level security', tenant_table);
        execute format(
            'create policy %I on %I using %s with check %s',
            tenant_table || '_tenant_isolation', tenant_table, policy_using, policy_using
        );
    end loop;
end $$;

grant select, insert on subscription_reminders to xtiitch_app;
