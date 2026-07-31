create table affiliate_campaign_links (
    campaign_link_id uuid primary key default gen_random_uuid(),
    affiliate_id uuid not null references affiliates (affiliate_id) on delete cascade,
    name text not null,
    slug text not null,
    destination_url text not null,
    utm_source text not null default 'affiliate',
    utm_medium text not null default 'referral',
    utm_campaign text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (affiliate_id, slug),
    check (length(name) between 1 and 100),
    check (slug ~ '^[a-z0-9][a-z0-9-]{0,62}$'),
    check (destination_url ~ '^https://')
);

create table affiliate_payout_profiles (
    affiliate_id uuid primary key references affiliates (affiliate_id) on delete cascade,
    payout_method text not null default 'mobile_money'
        check (payout_method in ('mobile_money', 'bank', 'manual')),
    account_name text not null default '',
    provider_name text not null default '',
    account_identifier_encrypted text not null default '',
    account_identifier_last4 text not null default '',
    status text not null default 'unverified'
        check (status in ('unverified', 'pending_review', 'verified', 'rejected')),
    submitted_at timestamptz,
    verified_at timestamptz,
    updated_at timestamptz not null default now(),
    check (account_identifier_last4 = '' or account_identifier_last4 ~ '^[0-9A-Za-z]{4}$')
);

create table affiliate_notification_preferences (
    affiliate_id uuid primary key references affiliates (affiliate_id) on delete cascade,
    conversion_emails boolean not null default true,
    approval_emails boolean not null default true,
    reversal_emails boolean not null default true,
    payout_emails boolean not null default true,
    updated_at timestamptz not null default now()
);

alter table affiliate_campaign_links enable row level security;
alter table affiliate_campaign_links force row level security;
alter table affiliate_payout_profiles enable row level security;
alter table affiliate_payout_profiles force row level security;
alter table affiliate_notification_preferences enable row level security;
alter table affiliate_notification_preferences force row level security;

create policy affiliate_campaign_links_admin_bypass on affiliate_campaign_links
    using (current_setting('xtiitch.bypass', true) = 'on')
    with check (current_setting('xtiitch.bypass', true) = 'on');
create policy affiliate_payout_profiles_admin_bypass on affiliate_payout_profiles
    using (current_setting('xtiitch.bypass', true) = 'on')
    with check (current_setting('xtiitch.bypass', true) = 'on');
create policy affiliate_notification_preferences_admin_bypass
    on affiliate_notification_preferences
    using (current_setting('xtiitch.bypass', true) = 'on')
    with check (current_setting('xtiitch.bypass', true) = 'on');

grant select, insert, update, delete on affiliate_campaign_links to xtiitch_app;
grant select, insert, update on affiliate_payout_profiles to xtiitch_app;
grant select, insert, update on affiliate_notification_preferences to xtiitch_app;
