alter table affiliate_conversions
    drop constraint if exists affiliate_conversions_order_id_key,
    drop constraint if exists affiliate_conversions_order_id_business_id_fkey;

alter table affiliate_conversions
    alter column order_id drop not null,
    add column conversion_type text not null default 'purchase'
        check (conversion_type in ('purchase', 'paid_plan_signup')),
    add column subscription_id uuid
        references business_subscriptions (subscription_id) on delete cascade,
    add column subscription_invoice_id uuid
        references business_subscription_invoices (invoice_id)
        on delete set null,
    add column payment_reference text not null default '',
    add column affiliate_programme_id uuid not null
        default '00000000-0000-4000-8000-00000000a001'::uuid
        references affiliate_programmes (affiliate_programme_id),
    add column programme_owner_type text not null default 'platform'
        check (programme_owner_type in ('platform', 'business')),
    add column funding_source text not null default 'platform'
        check (funding_source in ('platform', 'business'));

update affiliate_conversions conversion
set affiliate_programme_id = affiliate.affiliate_programme_id,
    programme_owner_type = programme.owner_type,
    funding_source = programme.owner_type
from affiliates affiliate
join affiliate_programmes programme
    on programme.affiliate_programme_id = affiliate.affiliate_programme_id
where affiliate.affiliate_id = conversion.affiliate_id;

alter table affiliate_conversions
    add constraint affiliate_conversions_order_business_fkey
        foreign key (order_id, business_id)
        references orders (order_id, business_id)
        on delete cascade,
    add constraint affiliate_conversions_typed_reference_check
        check (
            (
                conversion_type = 'purchase'
                and order_id is not null
                and subscription_id is null
                and payment_reference = ''
            )
            or (
                conversion_type = 'paid_plan_signup'
                and order_id is null
                and subscription_id is not null
                and payment_reference <> ''
                and programme_owner_type = 'platform'
                and funding_source = 'platform'
            )
        );

create unique index affiliate_conversions_purchase_unique_idx
    on affiliate_conversions (order_id)
    where conversion_type = 'purchase';

create unique index affiliate_conversions_first_paid_plan_unique_idx
    on affiliate_conversions (subscription_id)
    where conversion_type = 'paid_plan_signup';

create unique index affiliate_conversions_payment_reference_unique_idx
    on affiliate_conversions (payment_reference)
    where conversion_type = 'paid_plan_signup';

create index affiliate_conversions_type_status_idx
    on affiliate_conversions (conversion_type, status, updated_at desc);

create table affiliate_plan_attribution_reservations (
    reservation_id uuid primary key,
    affiliate_id uuid not null
        references affiliates (affiliate_id) on delete cascade,
    affiliate_click_id uuid
        references affiliate_clicks (affiliate_click_id) on delete set null,
    affiliate_programme_id uuid not null
        references affiliate_programmes (affiliate_programme_id),
    business_id uuid not null
        references businesses (business_id) on delete cascade,
    subscription_id uuid not null
        references business_subscriptions (subscription_id) on delete cascade,
    payment_reference text not null,
    gross_minor bigint not null check (gross_minor > 0),
    commission_minor bigint not null
        check (commission_minor >= 0 and commission_minor <= gross_minor),
    commission_rate integer not null
        check (commission_rate between 1 and 10000),
    hold_days integer not null check (hold_days between 0 and 365),
    status text not null default 'pending'
        check (status in ('pending', 'converted', 'void')),
    metadata jsonb not null default '{}',
    converted_at timestamptz,
    voided_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (payment_reference),
    check (status <> 'converted' or converted_at is not null),
    check (status <> 'void' or voided_at is not null)
);

create index affiliate_plan_reservations_subscription_status_idx
    on affiliate_plan_attribution_reservations (
        subscription_id,
        status,
        created_at desc
    );

alter table affiliate_plan_attribution_reservations enable row level security;
alter table affiliate_plan_attribution_reservations force row level security;

create policy affiliate_plan_reservations_isolation
    on affiliate_plan_attribution_reservations
    using (
        current_setting('xtiitch.bypass', true) = 'on'
        or business_id =
            nullif(
                current_setting('xtiitch.current_business_id', true),
                ''
            )::uuid
    )
    with check (
        current_setting('xtiitch.bypass', true) = 'on'
        or business_id =
            nullif(
                current_setting('xtiitch.current_business_id', true),
                ''
            )::uuid
    );

grant select, insert, update on affiliate_plan_attribution_reservations
    to xtiitch_app;
