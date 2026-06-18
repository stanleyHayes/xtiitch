create table affiliate_attribution_reservations (
    reservation_id uuid primary key default gen_random_uuid(),
    affiliate_id uuid not null references affiliates (affiliate_id) on delete cascade,
    affiliate_click_id uuid references affiliate_clicks (affiliate_click_id) on delete set null,
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
        check (status in ('pending', 'converted', 'void')),
    metadata jsonb not null default '{}',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (order_id),
    foreign key (order_id, business_id)
        references orders (order_id, business_id)
        on delete cascade,
    check (commission_minor <= gross_minor)
);

create index affiliate_attribution_reservations_affiliate_idx
    on affiliate_attribution_reservations (affiliate_id, status, updated_at desc);

create index affiliate_attribution_reservations_business_idx
    on affiliate_attribution_reservations (business_id, status, updated_at desc);

alter table affiliate_attribution_reservations enable row level security;
alter table affiliate_attribution_reservations force row level security;

create policy affiliate_attribution_reservations_tenant_isolation on affiliate_attribution_reservations
    using (
        current_setting('xtiitch.bypass', true) = 'on'
        or business_id = nullif(current_setting('xtiitch.current_business_id', true), '')::uuid
    )
    with check (
        current_setting('xtiitch.bypass', true) = 'on'
        or business_id = nullif(current_setting('xtiitch.current_business_id', true), '')::uuid
    );

grant select, insert, update, delete on affiliate_attribution_reservations to xtiitch_app;
