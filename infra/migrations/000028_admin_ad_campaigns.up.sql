create table ad_campaigns (
    campaign_id uuid primary key default gen_random_uuid(),
    advertiser_business_id uuid not null references businesses (business_id) on delete cascade,
    placement_type text not null
        check (placement_type in ('featured_business', 'promoted_design', 'homepage_hero')),
    target_ref_id text not null default '',
    headline text not null,
    description text not null default '',
    status text not null default 'pending_review'
        check (status in ('pending_review', 'active', 'paused', 'completed', 'archived')),
    pricing_model text not null default 'flat_time'
        check (pricing_model in ('flat_time', 'cpm', 'cpc')),
    budget_minor bigint not null check (budget_minor > 0),
    spend_to_date_minor bigint not null default 0 check (spend_to_date_minor >= 0),
    daily_cap_minor bigint check (daily_cap_minor is null or daily_cap_minor > 0),
    starts_at timestamptz not null,
    ends_at timestamptz not null,
    reviewed_by_admin_user_id uuid references admin_users(admin_user_id) on delete set null,
    review_note text not null default '',
    created_by_admin_user_id uuid references admin_users(admin_user_id) on delete set null,
    updated_by_admin_user_id uuid references admin_users(admin_user_id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (campaign_id, advertiser_business_id),
    check (headline <> ''),
    check (ends_at > starts_at),
    check (placement_type <> 'promoted_design' or target_ref_id <> '')
);

create index ad_campaigns_business_status_idx
    on ad_campaigns (advertiser_business_id, status, updated_at desc);

create index ad_campaigns_active_window_idx
    on ad_campaigns (placement_type, status, starts_at, ends_at);

create table ad_events (
    ad_event_id uuid primary key default gen_random_uuid(),
    campaign_id uuid not null,
    advertiser_business_id uuid not null references businesses (business_id) on delete cascade,
    event_type text not null check (event_type in ('impression', 'click')),
    visitor_id text not null default '',
    occurred_at timestamptz not null default now(),
    metadata jsonb not null default '{}',
    created_at timestamptz not null default now(),
    foreign key (campaign_id, advertiser_business_id)
        references ad_campaigns (campaign_id, advertiser_business_id)
        on delete cascade
);

create index ad_events_campaign_type_idx
    on ad_events (campaign_id, event_type, occurred_at desc);

create index ad_events_visitor_idx
    on ad_events (campaign_id, event_type, visitor_id, occurred_at desc)
    where visitor_id <> '';

alter table ad_campaigns enable row level security;
alter table ad_campaigns force row level security;

create policy ad_campaigns_tenant_isolation on ad_campaigns
    using (
        current_setting('xtiitch.bypass', true) = 'on'
        or advertiser_business_id = nullif(current_setting('xtiitch.current_business_id', true), '')::uuid
    )
    with check (
        current_setting('xtiitch.bypass', true) = 'on'
        or advertiser_business_id = nullif(current_setting('xtiitch.current_business_id', true), '')::uuid
    );

alter table ad_events enable row level security;
alter table ad_events force row level security;

create policy ad_events_tenant_isolation on ad_events
    using (
        current_setting('xtiitch.bypass', true) = 'on'
        or advertiser_business_id = nullif(current_setting('xtiitch.current_business_id', true), '')::uuid
    )
    with check (
        current_setting('xtiitch.bypass', true) = 'on'
        or advertiser_business_id = nullif(current_setting('xtiitch.current_business_id', true), '')::uuid
    );

grant select, insert, update, delete on ad_campaigns, ad_events to xtiitch_app;
