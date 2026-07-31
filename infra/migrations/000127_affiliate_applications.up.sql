create table affiliate_applications (
    affiliate_application_id uuid primary key default gen_random_uuid(),
    applicant_type text not null default 'person'
        check (applicant_type in ('person', 'business', 'agency')),
    display_name text not null,
    contact_name text not null,
    email text not null,
    phone text not null default '',
    website_url text not null default '',
    requested_code text not null,
    audience_summary text not null default '',
    promotion_channels text[] not null default '{}',
    consent_at timestamptz not null,
    status text not null default 'pending_review'
        check (status in ('pending_review', 'approved', 'rejected', 'withdrawn')),
    affiliate_id uuid references affiliates (affiliate_id) on delete set null,
    reviewed_by_admin_user_id uuid references admin_users (admin_user_id) on delete set null,
    reviewed_at timestamptz,
    review_note text not null default '',
    metadata jsonb not null default '{}',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (display_name <> ''),
    check (contact_name <> ''),
    check (
        position('@' in email) > 1
        and position('.' in split_part(email, '@', 2)) > 1
    ),
    check (requested_code ~ '^[A-Z0-9][A-Z0-9_-]{1,30}[A-Z0-9]$'),
    check (cardinality(promotion_channels) <= 8),
    check (
        status in ('pending_review', 'withdrawn')
        or (reviewed_at is not null and reviewed_by_admin_user_id is not null)
    ),
    check (status <> 'approved' or affiliate_id is not null)
);

create unique index affiliate_applications_pending_email_unique_idx
    on affiliate_applications (lower(email))
    where status = 'pending_review';

create unique index affiliate_applications_pending_code_unique_idx
    on affiliate_applications (lower(requested_code))
    where status = 'pending_review';

create index affiliate_applications_status_created_idx
    on affiliate_applications (status, created_at desc);

alter table affiliate_applications enable row level security;
alter table affiliate_applications force row level security;

create policy affiliate_applications_admin_bypass on affiliate_applications
    using (current_setting('xtiitch.bypass', true) = 'on')
    with check (current_setting('xtiitch.bypass', true) = 'on');

grant select, insert, update on affiliate_applications to xtiitch_app;
