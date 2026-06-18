create table ad_campaign_payments (
    payment_id uuid primary key,
    campaign_id uuid not null,
    advertiser_business_id uuid not null references businesses(business_id) on delete cascade,
    provider text not null default 'paystack'
        check (provider in ('paystack')),
    provider_reference text not null,
    payment_url text not null default '',
    amount_minor bigint not null check (amount_minor > 0),
    currency text not null default 'GHS',
    status text not null default 'initiated'
        check (status in ('initiated', 'paid', 'failed', 'void')),
    requested_by_admin_user_id uuid references admin_users(admin_user_id) on delete set null,
    paid_at timestamptz,
    failed_at timestamptz,
    failure_reason text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    foreign key (campaign_id, advertiser_business_id)
        references ad_campaigns(campaign_id, advertiser_business_id)
        on delete cascade,
    check (
        (status = 'paid' and paid_at is not null)
        or status <> 'paid'
    ),
    check (
        (status = 'failed' and failed_at is not null)
        or status <> 'failed'
    )
);

create unique index ad_campaign_payments_provider_reference_idx
    on ad_campaign_payments (provider, provider_reference);

create unique index ad_campaign_payments_one_open_idx
    on ad_campaign_payments (campaign_id)
    where status = 'initiated';

create index ad_campaign_payments_campaign_idx
    on ad_campaign_payments (campaign_id, created_at desc);

create index ad_campaign_payments_status_idx
    on ad_campaign_payments (status, updated_at desc);

alter table ad_campaign_payments enable row level security;
alter table ad_campaign_payments force row level security;

create policy ad_campaign_payments_tenant_isolation
    on ad_campaign_payments
    using (
        current_setting('xtiitch.bypass', true) = 'on'
        or advertiser_business_id = nullif(current_setting('xtiitch.current_business_id', true), '')::uuid
    )
    with check (
        current_setting('xtiitch.bypass', true) = 'on'
        or advertiser_business_id = nullif(current_setting('xtiitch.current_business_id', true), '')::uuid
    );

grant select, insert, update on ad_campaign_payments to xtiitch_app;
