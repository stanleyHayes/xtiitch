-- Xtiitch Partner Program v1.5: platform subscription promotion only.
-- Existing affiliate identifiers and financial history remain intact; customer-
-- purchase functionality is parked, not deleted.

alter table affiliate_conversions
	drop constraint if exists affiliate_conversions_conversion_type_check,
	drop constraint if exists affiliate_conversions_typed_reference_check;

update affiliate_conversions
set conversion_type = 'subscription_payment',
    metadata = metadata || jsonb_build_object('legacy_conversion_type', 'paid_plan_signup')
where conversion_type = 'paid_plan_signup';

alter table affiliate_conversions
    add constraint affiliate_conversions_conversion_type_check
        check (conversion_type in ('purchase', 'subscription_payment'));

drop index if exists affiliate_conversions_first_paid_plan_unique_idx;
drop index if exists affiliate_conversions_payment_reference_unique_idx;
create index affiliate_conversions_subscription_idx
    on affiliate_conversions (subscription_id, created_at desc)
    where conversion_type = 'subscription_payment';
create unique index affiliate_conversions_payment_reference_unique_idx
    on affiliate_conversions (payment_reference)
    where conversion_type = 'subscription_payment';

alter table affiliate_conversions
    add constraint affiliate_conversions_typed_reference_check check (
        (conversion_type = 'purchase' and order_id is not null
            and subscription_id is null and payment_reference = '')
        or
        (conversion_type = 'subscription_payment' and order_id is null
            and subscription_id is not null and payment_reference <> ''
            and programme_owner_type = 'platform' and funding_source = 'platform')
    );

-- The current programme is single-purpose and recurring. Product-affiliate
-- programmes and their partners remain queryable history but cannot transact.
update affiliate_programmes
set status = 'paused', updated_at = now()
where owner_type = 'business' and status in ('draft', 'active');

update affiliates
set status = 'paused', updated_at = now()
where owner_business_id is not null and status = 'active';

create function park_merchant_affiliate_programme()
returns trigger
language plpgsql
as $$
begin
    if new.owner_type = 'business' then
        new.status := 'paused';
        new.default_purchase_commission_bps := 0;
        new.default_first_paid_plan_commission_bps := 0;
    end if;
    return new;
end;
$$;
create function park_merchant_affiliate()
returns trigger
language plpgsql
as $$
begin
    if new.owner_business_id is not null then
        new.status := 'paused';
        new.purchase_commission_bps := 0;
        new.first_paid_plan_commission_bps := 0;
        new.commission_rate := 0;
    end if;
    return new;
end;
$$;
create trigger park_business_affiliate_programmes
before insert or update on affiliate_programmes
for each row execute function park_merchant_affiliate_programme();
create trigger park_business_affiliates
before insert or update on affiliates
for each row execute function park_merchant_affiliate();

update affiliate_programmes
set name = 'Xtiitch Partner Program',
    description = 'Partners earn recurring commission on eligible Xtiitch subscription payments.',
    default_purchase_commission_bps = 0,
    default_first_paid_plan_commission_bps = 2000,
    hold_days = 14,
    allowed_target_scope = 'platform',
    status = 'active',
    updated_at = now()
where owner_type = 'platform' and is_default;

update affiliates affiliate
set commission_model = 'percentage', commission_rate = 2000,
    purchase_commission_bps = 0, first_paid_plan_commission_bps = 2000,
    target_scope = 'platform', updated_at = now()
from affiliate_programmes programme
where programme.affiliate_programme_id = affiliate.affiliate_programme_id
  and programme.owner_type = 'platform'
  and affiliate.status <> 'archived';

create table partner_programme_settings (
    settings_id boolean primary key default true check (settings_id),
    registration_open boolean not null default true,
    commission_bps integer not null default 2000 check (commission_bps between 0 and 10000),
    maturity_days integer not null default 14 check (maturity_days between 0 and 365),
    recurring_effective_at timestamptz not null default now(),
    updated_by_admin_user_id uuid references admin_users (admin_user_id) on delete set null,
    updated_at timestamptz not null default now()
);
insert into partner_programme_settings (settings_id) values (true);

create function sync_partner_programme_settings()
returns trigger
language plpgsql
as $$
begin
    if new.owner_type = 'platform' and new.is_default then
        update partner_programme_settings
        set commission_bps = new.default_first_paid_plan_commission_bps,
            maturity_days = new.hold_days,
            updated_by_admin_user_id = new.updated_by_admin_user_id,
            updated_at = now()
        where settings_id;
        update affiliates
        set commission_rate = new.default_first_paid_plan_commission_bps,
            first_paid_plan_commission_bps = new.default_first_paid_plan_commission_bps,
            purchase_commission_bps = 0,
            updated_at = now()
        where affiliate_programme_id = new.affiliate_programme_id
          and owner_business_id is null and status <> 'archived';
    end if;
    return new;
end;
$$;
create trigger sync_partner_programme_admin_settings
after update of default_first_paid_plan_commission_bps, hold_days
on affiliate_programmes
for each row execute function sync_partner_programme_settings();

create function sync_partner_registration_setting()
returns trigger
language plpgsql
as $$
begin
    update partner_programme_settings
    set registration_open = new.marketing_show_affiliate_signup,
        updated_at = now()
    where settings_id;
    return new;
end;
$$;
create trigger sync_partner_registration_admin_setting
after update of marketing_show_affiliate_signup on admin_platform_settings
for each row execute function sync_partner_registration_setting();

create table partner_milestones (
    partner_milestone_id uuid primary key default gen_random_uuid(),
    threshold integer not null unique check (threshold > 0),
    title text not null check (title <> ''),
    reward_description text not null default '',
    status text not null default 'active' check (status in ('active', 'paused', 'archived')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
insert into partner_milestones (threshold, title, reward_description) values
    (10, 'First major win', 'Configured reward and achievement recognition.'),
    (50, 'Established Partner', 'Configured reward and stronger recognition.'),
    (100, 'High performer', 'Configured reward and prominent recognition.'),
    (500, 'Major growth contributor', 'Configured major reward and recognition.'),
    (1000, 'Exceptional Partner', 'Configured premium reward and recognition.');

create table partner_milestone_achievements (
    partner_milestone_achievement_id uuid primary key default gen_random_uuid(),
    affiliate_id uuid not null references affiliates (affiliate_id) on delete restrict,
    partner_milestone_id uuid not null references partner_milestones (partner_milestone_id) on delete restrict,
    achieved_at timestamptz not null default now(),
    reward_status text not null default 'unfulfilled'
        check (reward_status in ('unfulfilled', 'processing', 'fulfilled', 'declined')),
    fulfilled_at timestamptz,
    fulfilment_note text not null default '',
    unique (affiliate_id, partner_milestone_id)
);

create table partner_invitations (
    partner_invitation_id uuid primary key default gen_random_uuid(),
    inviter_affiliate_id uuid not null references affiliates (affiliate_id) on delete restrict,
    invite_code text not null unique,
    invitee_email text not null default '',
    accepted_affiliate_id uuid references affiliates (affiliate_id) on delete set null,
    accepted_at timestamptz,
    created_at timestamptz not null default now(),
    check (accepted_at is null or accepted_affiliate_id is not null)
);

alter table partner_programme_settings enable row level security;
alter table partner_programme_settings force row level security;
alter table partner_milestones enable row level security;
alter table partner_milestones force row level security;
alter table partner_milestone_achievements enable row level security;
alter table partner_milestone_achievements force row level security;
alter table partner_invitations enable row level security;
alter table partner_invitations force row level security;

create policy partner_settings_admin_bypass on partner_programme_settings
    using (current_setting('xtiitch.bypass', true) = 'on')
    with check (current_setting('xtiitch.bypass', true) = 'on');
create policy partner_milestones_admin_bypass on partner_milestones
    using (current_setting('xtiitch.bypass', true) = 'on')
    with check (current_setting('xtiitch.bypass', true) = 'on');
create policy partner_achievements_admin_bypass on partner_milestone_achievements
    using (current_setting('xtiitch.bypass', true) = 'on')
    with check (current_setting('xtiitch.bypass', true) = 'on');
create policy partner_invitations_admin_bypass on partner_invitations
    using (current_setting('xtiitch.bypass', true) = 'on')
    with check (current_setting('xtiitch.bypass', true) = 'on');

grant select, insert, update on partner_programme_settings, partner_milestones,
    partner_milestone_achievements, partner_invitations to xtiitch_app;

-- Materialise one commission per successful subscription invoice. This catches
-- card renewals, MoMo reactivations and first payments through the same idempotent
-- payment-reference key. Attribution deliberately has no expiry after signup.
create function record_partner_subscription_commission()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
    attribution record;
    settings record;
begin
    if new.status <> 'paid' or (tg_op = 'UPDATE' and old.status = 'paid') then
        return new;
    end if;
    select * into settings from partner_programme_settings where settings_id;
    if now() < settings.recurring_effective_at or settings.commission_bps <= 0 then
        return new;
    end if;
    select signup.affiliate_id, signup.affiliate_click_id,
        affiliate.affiliate_programme_id
    into attribution
    from affiliate_signups signup
    join affiliates affiliate on affiliate.affiliate_id = signup.affiliate_id
    join affiliate_programmes programme
        on programme.affiliate_programme_id = affiliate.affiliate_programme_id
    where signup.subject_type = 'business'
      and signup.business_id = new.business_id
      and signup.status = 'qualified'
      and affiliate.status = 'active'
      and affiliate.owner_business_id is null
      and programme.owner_type = 'platform'
      and programme.status = 'active'
    order by signup.qualified_at
    limit 1;
    if attribution.affiliate_id is null then return new; end if;

    insert into affiliate_conversions (
        affiliate_conversion_id, affiliate_id, affiliate_click_id,
        affiliate_programme_id, programme_owner_type, funding_source,
        business_id, conversion_type, subscription_id,
        subscription_invoice_id, payment_reference, gross_minor,
        commission_minor, commission_model, commission_rate,
        attribution_model, status, hold_until, metadata
    ) values (
        gen_random_uuid(), attribution.affiliate_id,
        attribution.affiliate_click_id, attribution.affiliate_programme_id,
        'platform', 'platform', new.business_id, 'subscription_payment',
        new.subscription_id, new.invoice_id,
        coalesce(nullif(new.provider_invoice_ref, ''), new.invoice_ref),
        new.amount_minor,
        least(new.amount_minor,
            (new.amount_minor * settings.commission_bps::bigint) / 10000),
        'percentage', settings.commission_bps, 'last_click', 'pending',
        now() + make_interval(days => settings.maturity_days),
        jsonb_build_object('source', 'paid_subscription_invoice')
    ) on conflict (payment_reference)
        where conversion_type = 'subscription_payment' do nothing;
    return new;
end;
$$;

create trigger partner_subscription_commission
after insert or update of status on business_subscription_invoices
for each row execute function record_partner_subscription_commission();
