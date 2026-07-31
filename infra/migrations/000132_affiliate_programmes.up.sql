create table affiliate_programmes (
    affiliate_programme_id uuid primary key,
    owner_type text not null
        check (owner_type in ('platform', 'business')),
    business_id uuid references businesses (business_id) on delete cascade,
    is_default boolean not null default false,
    name text not null,
    description text not null default '',
    status text not null default 'active'
        check (status in ('draft', 'active', 'paused', 'archived')),
    default_purchase_commission_bps integer not null default 0
        check (default_purchase_commission_bps between 0 and 10000),
    default_first_paid_plan_commission_bps integer not null default 0
        check (default_first_paid_plan_commission_bps between 0 and 10000),
    cookie_window_days integer not null default 30
        check (cookie_window_days between 1 and 365),
    hold_days integer not null default 14
        check (hold_days between 0 and 365),
    payout_mode text not null default 'manual'
        check (
            payout_mode in (
                'paystack_split',
                'paystack_transfer',
                'voucher',
                'manual'
            )
        ),
    minimum_payout_minor bigint not null default 0
        check (minimum_payout_minor >= 0),
    allowed_target_scope text not null default 'platform'
        check (
            allowed_target_scope in (
                'platform',
                'store',
                'collection',
                'design',
                'product'
            )
        ),
    created_by_admin_user_id uuid
        references admin_users (admin_user_id) on delete set null,
    updated_by_admin_user_id uuid
        references admin_users (admin_user_id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (name <> ''),
    check (
        (owner_type = 'platform' and business_id is null)
        or (owner_type = 'business' and business_id is not null)
    ),
    check (not is_default or owner_type = 'platform')
);

create unique index affiliate_programmes_active_platform_default_idx
    on affiliate_programmes (is_default)
    where owner_type = 'platform'
        and is_default
        and status = 'active';

create index affiliate_programmes_business_status_idx
    on affiliate_programmes (business_id, status, updated_at desc)
    where business_id is not null;

insert into affiliate_programmes (
    affiliate_programme_id,
    owner_type,
    is_default,
    name,
    description,
    status,
    default_purchase_commission_bps,
    default_first_paid_plan_commission_bps,
    cookie_window_days,
    hold_days,
    payout_mode,
    minimum_payout_minor,
    allowed_target_scope
)
values (
    '00000000-0000-4000-8000-00000000a001'::uuid,
    'platform',
    true,
    'Xtiitch Platform Affiliates',
    'Default platform-funded affiliate programme.',
    'active',
    0,
    0,
    30,
    14,
    'manual',
    0,
    'platform'
);

alter table affiliates
    add column affiliate_programme_id uuid not null
        default '00000000-0000-4000-8000-00000000a001'::uuid
        references affiliate_programmes (affiliate_programme_id),
    add column owner_business_id uuid
        references businesses (business_id) on delete cascade,
    add column target_scope text not null default 'platform'
        check (
            target_scope in (
                'platform',
                'store',
                'collection',
                'design',
                'product'
            )
        ),
    add column target_ref_id uuid,
    add column source_application_id uuid
        references affiliate_applications (affiliate_application_id)
        on delete set null;

update affiliates a
set source_application_id = application.affiliate_application_id
from affiliate_applications application
where application.affiliate_id = a.affiliate_id;

create index affiliates_programme_status_idx
    on affiliates (affiliate_programme_id, status, updated_at desc);

create index affiliates_owner_business_status_idx
    on affiliates (owner_business_id, status, updated_at desc)
    where owner_business_id is not null;

alter table affiliate_programmes enable row level security;
alter table affiliate_programmes force row level security;

create policy affiliate_programmes_isolation on affiliate_programmes
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
        or (
            owner_type = 'business'
            and business_id =
                nullif(
                    current_setting('xtiitch.current_business_id', true),
                    ''
                )::uuid
        )
    );

grant select, insert, update on affiliate_programmes to xtiitch_app;
