create table affiliate_risk_events (
    risk_event_id uuid primary key default gen_random_uuid(),
    affiliate_id uuid references affiliates (affiliate_id) on delete cascade,
    event_type text not null check (event_type in (
        'click_velocity', 'self_referral', 'reversal_velocity'
    )),
    severity text not null default 'review'
        check (severity in ('review', 'high')),
    event_key text not null unique,
    metadata jsonb not null default '{}',
    reviewed_at timestamptz,
    created_at timestamptz not null default now()
);

create table affiliate_portal_audit_events (
    audit_event_id uuid primary key default gen_random_uuid(),
    affiliate_id uuid not null references affiliates (affiliate_id) on delete cascade,
    event_type text not null,
    source_id uuid,
    metadata jsonb not null default '{}',
    created_at timestamptz not null default now()
);

create index affiliate_risk_events_review_idx
    on affiliate_risk_events (reviewed_at, severity, created_at desc);
create index affiliate_portal_audit_affiliate_idx
    on affiliate_portal_audit_events (affiliate_id, created_at desc);

create function flag_affiliate_click_velocity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
    recent_clicks bigint;
    bucket text;
begin
    if new.ip_hash = '' then
        return new;
    end if;
    select count(*) into recent_clicks
    from affiliate_clicks
    where affiliate_id = new.affiliate_id
      and ip_hash = new.ip_hash
      and clicked_at >= now() - interval '1 hour';
    if recent_clicks >= 20 then
        bucket := date_trunc('hour', now())::text;
        insert into affiliate_risk_events (
            affiliate_id, event_type, event_key, metadata
        ) values (
            new.affiliate_id, 'click_velocity',
            'click:' || new.affiliate_id::text || ':' || new.ip_hash || ':' || bucket,
            jsonb_build_object('click_count', recent_clicks, 'window', '1 hour')
        ) on conflict (event_key) do nothing;
    end if;
    return new;
end;
$$;

create function flag_affiliate_self_referral()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
    affiliate_email text;
    subject_email text;
begin
    select lower(account.email) into affiliate_email
    from affiliate_accounts account
    where account.affiliate_id = new.affiliate_id;
    if new.subject_type = 'customer' then
        select lower(customer.email) into subject_email
        from customers customer where customer.customer_id = new.customer_id;
    else
        select lower(user_row.email) into subject_email
        from business_users user_row
        where user_row.business_id = new.business_id
          and user_row.role = 'owner'
        order by user_row.created_at
        limit 1;
    end if;
    if affiliate_email <> '' and affiliate_email = subject_email then
        insert into affiliate_risk_events (
            affiliate_id, event_type, severity, event_key, metadata
        ) values (
            new.affiliate_id, 'self_referral', 'high',
            'self:' || new.affiliate_signup_id::text,
            jsonb_build_object(
                'signup_id', new.affiliate_signup_id::text,
                'subject_type', new.subject_type
            )
        ) on conflict (event_key) do nothing;
    end if;
    return new;
end;
$$;

create function flag_affiliate_reversal_velocity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
    reversals bigint;
    bucket text;
begin
    if new.status <> 'reversed' or old.status = 'reversed' then
        return new;
    end if;
    select count(*) into reversals
    from affiliate_conversions
    where affiliate_id = new.affiliate_id
      and status = 'reversed'
      and reversed_at >= now() - interval '30 days';
    if reversals >= 3 then
        bucket := to_char(now(), 'YYYY-MM');
        insert into affiliate_risk_events (
            affiliate_id, event_type, severity, event_key, metadata
        ) values (
            new.affiliate_id, 'reversal_velocity', 'high',
            'reversal:' || new.affiliate_id::text || ':' || bucket,
            jsonb_build_object('reversal_count', reversals, 'window', '30 days')
        ) on conflict (event_key) do nothing;
    end if;
    return new;
end;
$$;

create function audit_affiliate_portal_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
    affiliate uuid;
    source uuid;
begin
    affiliate := (to_jsonb(new) ->> 'affiliate_id')::uuid;
    source := nullif(
        coalesce(
            to_jsonb(new) ->> 'campaign_link_id',
            to_jsonb(new) ->> 'affiliate_id'
        ),
        ''
    )::uuid;
    insert into affiliate_portal_audit_events (
        affiliate_id, event_type, source_id, metadata
    ) values (
        affiliate,
        tg_argv[0],
        source,
        jsonb_build_object('operation', tg_op)
    );
    return new;
end;
$$;

create trigger affiliate_click_velocity_risk
after insert on affiliate_clicks
for each row execute function flag_affiliate_click_velocity();
create trigger affiliate_signup_self_referral_risk
after insert on affiliate_signups
for each row execute function flag_affiliate_self_referral();
create trigger affiliate_conversion_reversal_risk
after update of status on affiliate_conversions
for each row execute function flag_affiliate_reversal_velocity();

create trigger affiliate_campaign_link_audit
after insert or update on affiliate_campaign_links
for each row execute function audit_affiliate_portal_mutation('campaign_link_changed');
create trigger affiliate_payout_profile_audit
after insert or update on affiliate_payout_profiles
for each row execute function audit_affiliate_portal_mutation('payout_profile_changed');
create trigger affiliate_notification_preferences_audit
after insert or update on affiliate_notification_preferences
for each row execute function audit_affiliate_portal_mutation('notification_preferences_changed');

alter table affiliate_risk_events enable row level security;
alter table affiliate_risk_events force row level security;
alter table affiliate_portal_audit_events enable row level security;
alter table affiliate_portal_audit_events force row level security;

create policy affiliate_risk_events_admin_bypass on affiliate_risk_events
    using (current_setting('xtiitch.bypass', true) = 'on')
    with check (current_setting('xtiitch.bypass', true) = 'on');
create policy affiliate_portal_audit_admin_bypass on affiliate_portal_audit_events
    using (current_setting('xtiitch.bypass', true) = 'on')
    with check (current_setting('xtiitch.bypass', true) = 'on');

grant select, insert, update on affiliate_risk_events to xtiitch_app;
grant select, insert on affiliate_portal_audit_events to xtiitch_app;
