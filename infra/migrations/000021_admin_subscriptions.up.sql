create table business_subscriptions (
    subscription_id uuid primary key default gen_random_uuid(),
    business_id uuid not null unique references businesses(business_id) on delete cascade,
    plan_id uuid not null references plans(plan_id),
    status text not null default 'active'
        check (status in ('active', 'trialing', 'past_due', 'grace_period', 'cancel_at_period_end', 'canceled')),
    billing_mode text not null default 'manual'
        check (billing_mode in ('manual', 'payment_link', 'recurring')),
    provider text not null default 'manual'
        check (provider in ('manual', 'paystack')),
    provider_customer_ref text not null default '',
    provider_subscription_ref text not null default '',
    current_period_start timestamptz not null default now(),
    current_period_end timestamptz not null default (now() + interval '1 month'),
    trial_ends_at timestamptz,
    grace_ends_at timestamptz,
    cancel_at_period_end boolean not null default false,
    canceled_at timestamptz,
    failed_payment_count integer not null default 0 check (failed_payment_count >= 0),
    last_invoice_ref text not null default '',
    last_payment_at timestamptz,
    next_billing_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (current_period_end > current_period_start),
    check (
        (status = 'canceled' and canceled_at is not null)
        or status <> 'canceled'
    )
);

create index business_subscriptions_status_idx
    on business_subscriptions (status, updated_at desc);

create index business_subscriptions_plan_idx
    on business_subscriptions (plan_id, updated_at desc);

create index business_subscriptions_next_billing_idx
    on business_subscriptions (next_billing_at)
    where next_billing_at is not null;

create table business_subscription_events (
    subscription_event_id uuid primary key default gen_random_uuid(),
    subscription_id uuid references business_subscriptions(subscription_id) on delete cascade,
    business_id uuid not null references businesses(business_id) on delete cascade,
    actor_admin_user_id uuid references admin_users(admin_user_id) on delete set null,
    event_type text not null,
    summary text not null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    check (event_type <> ''),
    check (summary <> '')
);

create index business_subscription_events_business_idx
    on business_subscription_events (business_id, created_at desc);

create index business_subscription_events_subscription_idx
    on business_subscription_events (subscription_id, created_at desc);

insert into business_subscriptions (
    business_id,
    plan_id,
    status,
    billing_mode,
    provider,
    current_period_start,
    current_period_end,
    trial_ends_at,
    next_billing_at
)
select
    b.business_id,
    b.plan_id,
    case when p.monthly_fee_minor = 0 then 'active' else 'trialing' end,
    'manual',
    'manual',
    b.created_at,
    greatest(b.created_at + interval '1 month', now() + interval '1 day'),
    case when p.monthly_fee_minor > 0 then now() + interval '14 days' end,
    case when p.monthly_fee_minor > 0 then now() + interval '14 days' end
from businesses b
join plans p on p.plan_id = b.plan_id
on conflict (business_id) do nothing;

do $$
declare
    tenant_table text;
    policy_using text := '(current_setting(''xtiitch.bypass'', true) = ''on'''
        || ' OR business_id = NULLIF(current_setting(''xtiitch.current_business_id'', true), '''')::uuid)';
begin
    foreach tenant_table in array array['business_subscriptions', 'business_subscription_events'] loop
        execute format('alter table %I enable row level security', tenant_table);
        execute format('alter table %I force row level security', tenant_table);
        execute format(
            'create policy %I on %I using %s with check %s',
            tenant_table || '_tenant_isolation', tenant_table, policy_using, policy_using
        );
    end loop;
end $$;

alter table admin_role_permissions
    drop constraint if exists admin_role_permissions_permission_check;

alter table admin_role_permissions
    add constraint admin_role_permissions_permission_check
    check (
        permission in (
            'manage_admin_users',
            'manage_roles',
            'manage_settings',
            'review_businesses',
            'manage_money_rails',
            'manage_subscriptions',
            'manage_risk',
            'manage_support',
            'view_audit'
        )
    );

insert into admin_role_permissions (role, permission)
values
    ('owner', 'manage_subscriptions'),
    ('operator', 'manage_subscriptions')
on conflict (role, permission) do nothing;

grant select, insert, update on business_subscriptions to xtiitch_app;
grant select, insert on business_subscription_events to xtiitch_app;
