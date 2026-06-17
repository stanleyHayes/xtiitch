create table business_subscription_invoices (
    invoice_id uuid primary key default gen_random_uuid(),
    subscription_id uuid not null references business_subscriptions(subscription_id) on delete cascade,
    business_id uuid not null references businesses(business_id) on delete cascade,
    plan_id uuid not null references plans(plan_id),
    invoice_ref text not null unique,
    status text not null default 'issued'
        check (status in ('issued', 'paid', 'failed', 'void')),
    billing_mode text not null
        check (billing_mode in ('manual', 'payment_link', 'recurring')),
    provider text not null default 'manual'
        check (provider in ('manual', 'paystack')),
    provider_invoice_ref text not null default '',
    payment_url text not null default '',
    amount_minor bigint not null check (amount_minor > 0),
    currency text not null default 'GHS',
    period_start timestamptz not null,
    period_end timestamptz not null,
    due_at timestamptz not null,
    issued_by_admin_user_id uuid references admin_users(admin_user_id) on delete set null,
    paid_at timestamptz,
    failed_at timestamptz,
    voided_at timestamptz,
    failure_reason text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (period_end > period_start),
    check (
        (status = 'paid' and paid_at is not null)
        or status <> 'paid'
    ),
    check (
        (status = 'failed' and failed_at is not null)
        or status <> 'failed'
    )
);

create unique index business_subscription_invoices_one_open_idx
    on business_subscription_invoices (subscription_id)
    where status = 'issued';

create index business_subscription_invoices_business_idx
    on business_subscription_invoices (business_id, created_at desc);

create index business_subscription_invoices_status_idx
    on business_subscription_invoices (status, due_at);

alter table business_subscription_invoices enable row level security;
alter table business_subscription_invoices force row level security;

create policy business_subscription_invoices_tenant_isolation
    on business_subscription_invoices
    using (
        current_setting('xtiitch.bypass', true) = 'on'
        or business_id = nullif(current_setting('xtiitch.current_business_id', true), '')::uuid
    )
    with check (
        current_setting('xtiitch.bypass', true) = 'on'
        or business_id = nullif(current_setting('xtiitch.current_business_id', true), '')::uuid
    );

grant select, insert, update on business_subscription_invoices to xtiitch_app;
