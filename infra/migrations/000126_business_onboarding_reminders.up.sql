-- Business onboarding reminders: after registration we email owners to finish
-- Ghana Card verification + payout setup, then nudge again if they stall.
-- Idempotency log so each (business, kind) reminder is sent at most once.
create table if not exists business_onboarding_reminders (
    reminder_id uuid primary key default gen_random_uuid(),
    business_id uuid not null references businesses (business_id) on delete cascade,
    kind text not null check (kind <> ''),
    sent_at timestamptz not null default now(),
    unique (business_id, kind)
);

create index business_onboarding_reminders_sent_idx
    on business_onboarding_reminders (sent_at desc);

-- Platform-operated under the bypass (same shape as subscription_reminders).
do $$
declare
    tenant_table text;
    policy_using text := '(current_setting(''xtiitch.bypass'', true) = ''on'''
        || ' OR business_id = NULLIF(current_setting(''xtiitch.current_business_id'', true), '''')::uuid)';
begin
    foreach tenant_table in array array['business_onboarding_reminders'] loop
        execute format('alter table %I enable row level security', tenant_table);
        execute format('alter table %I force row level security', tenant_table);
        execute format(
            'create policy %I on %I using %s with check %s',
            tenant_table || '_tenant_isolation', tenant_table, policy_using, policy_using
        );
    end loop;
end $$;

grant select, insert on business_onboarding_reminders to xtiitch_app;
