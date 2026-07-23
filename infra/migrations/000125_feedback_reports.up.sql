create table feedback_reports (
    feedback_report_id uuid primary key,
    business_id uuid references businesses(business_id) on delete set null,
    reporter_type text not null
        check (reporter_type in ('business', 'customer', 'anonymous', 'system')),
    surface text not null
        check (surface in ('business', 'storefront', 'marketing', 'admin')),
    kind text not null default 'feedback'
        check (kind in ('feedback', 'crash')),
    priority text not null default 'normal'
        check (priority in ('normal', 'urgent')),
    subject text not null default '',
    message text not null default '',
    page_url text not null default '',
    user_agent text not null default '',
    contact text not null default '',
    context jsonb not null default '{}'::jsonb,
    stack text not null default '',
    created_at timestamptz not null default now(),
    check (subject <> '' or message <> '' or stack <> '')
);

create index feedback_reports_business_idx
    on feedback_reports (business_id, created_at desc);

create index feedback_reports_queue_idx
    on feedback_reports (kind, priority, created_at desc);

grant select, insert on feedback_reports to xtiitch_app;
