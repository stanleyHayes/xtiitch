create table affiliate_signups (
    affiliate_signup_id uuid primary key default gen_random_uuid(),
    affiliate_id uuid not null
        references affiliates (affiliate_id) on delete cascade,
    affiliate_click_id uuid
        references affiliate_clicks (affiliate_click_id) on delete set null,
    subject_type text not null
        check (subject_type in ('customer', 'business')),
    customer_id uuid
        references customers (customer_id) on delete cascade,
    business_id uuid
        references businesses (business_id) on delete cascade,
    code text not null,
    attribution_model text not null default 'last_click'
        check (attribution_model in ('last_click', 'manual')),
    status text not null default 'qualified'
        check (status in ('qualified', 'disqualified')),
    qualified_at timestamptz not null default now(),
    disqualified_at timestamptz,
    disqualification_reason text not null default '',
    metadata jsonb not null default '{}',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (code ~ '^[A-Z0-9][A-Z0-9_-]{1,30}[A-Z0-9]$'),
    check (
        (
            subject_type = 'customer'
            and customer_id is not null
            and business_id is null
        )
        or (
            subject_type = 'business'
            and business_id is not null
            and customer_id is null
        )
    ),
    check (
        status <> 'disqualified'
        or (
            disqualified_at is not null
            and disqualification_reason <> ''
        )
    )
);

create unique index affiliate_signups_customer_unique_idx
    on affiliate_signups (customer_id)
    where customer_id is not null;

create unique index affiliate_signups_business_unique_idx
    on affiliate_signups (business_id)
    where business_id is not null;

create index affiliate_signups_affiliate_type_status_idx
    on affiliate_signups (
        affiliate_id,
        subject_type,
        status,
        qualified_at desc
    );

create index affiliate_signups_click_idx
    on affiliate_signups (affiliate_click_id)
    where affiliate_click_id is not null;

alter table affiliate_signups enable row level security;
alter table affiliate_signups force row level security;

create policy affiliate_signups_admin_bypass
    on affiliate_signups
    using (current_setting('xtiitch.bypass', true) = 'on')
    with check (current_setting('xtiitch.bypass', true) = 'on');

grant select, insert, update on affiliate_signups to xtiitch_app;
