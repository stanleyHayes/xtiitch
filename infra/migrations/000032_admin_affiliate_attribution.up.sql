create table affiliate_clicks (
    affiliate_click_id uuid primary key default gen_random_uuid(),
    affiliate_id uuid not null references affiliates (affiliate_id) on delete cascade,
    visitor_id text not null default '',
    landing_url text not null default '',
    referrer_url text not null default '',
    user_agent text not null default '',
    ip_hash text not null default '',
    metadata jsonb not null default '{}',
    clicked_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    check (visitor_id <> '' or ip_hash <> '')
);

create index affiliate_clicks_affiliate_time_idx
    on affiliate_clicks (affiliate_id, clicked_at desc);

create index affiliate_clicks_visitor_idx
    on affiliate_clicks (visitor_id, clicked_at desc)
    where visitor_id <> '';

create table affiliate_conversions (
    affiliate_conversion_id uuid primary key default gen_random_uuid(),
    affiliate_id uuid not null references affiliates (affiliate_id) on delete cascade,
    affiliate_click_id uuid,
    business_id uuid not null references businesses (business_id) on delete cascade,
    order_id uuid not null,
    gross_minor bigint not null check (gross_minor > 0),
    commission_minor bigint not null default 0 check (commission_minor >= 0),
    commission_model text not null
        check (commission_model in ('percentage', 'flat')),
    commission_rate bigint not null check (commission_rate > 0),
    attribution_model text not null default 'last_click'
        check (attribution_model in ('last_click', 'manual')),
    status text not null default 'pending'
        check (status in ('pending', 'approved', 'settled', 'reversed')),
    hold_until timestamptz,
    approved_at timestamptz,
    settled_at timestamptz,
    reversed_at timestamptz,
    reversal_reason text not null default '',
    metadata jsonb not null default '{}',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (order_id),
    foreign key (affiliate_click_id)
        references affiliate_clicks (affiliate_click_id)
        on delete set null,
    foreign key (order_id, business_id)
        references orders (order_id, business_id)
        on delete cascade,
    check (commission_minor <= gross_minor),
    check (status <> 'approved' or approved_at is not null),
    check (status <> 'settled' or settled_at is not null),
    check (status <> 'reversed' or reversed_at is not null)
);

create index affiliate_conversions_affiliate_status_idx
    on affiliate_conversions (affiliate_id, status, updated_at desc);

create index affiliate_conversions_business_status_idx
    on affiliate_conversions (business_id, status, updated_at desc);

create index affiliate_conversions_hold_idx
    on affiliate_conversions (status, hold_until)
    where hold_until is not null;

alter table affiliate_clicks enable row level security;
alter table affiliate_clicks force row level security;

create policy affiliate_clicks_admin_bypass on affiliate_clicks
    using (current_setting('xtiitch.bypass', true) = 'on')
    with check (current_setting('xtiitch.bypass', true) = 'on');

alter table affiliate_conversions enable row level security;
alter table affiliate_conversions force row level security;

create policy affiliate_conversions_tenant_isolation on affiliate_conversions
    using (
        current_setting('xtiitch.bypass', true) = 'on'
        or business_id = nullif(current_setting('xtiitch.current_business_id', true), '')::uuid
    )
    with check (
        current_setting('xtiitch.bypass', true) = 'on'
        or business_id = nullif(current_setting('xtiitch.current_business_id', true), '')::uuid
    );

grant select, insert, update, delete on affiliate_clicks, affiliate_conversions to xtiitch_app;
