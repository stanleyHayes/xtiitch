create table admin_audit_events (
    audit_event_id uuid primary key,
    actor_admin_user_id uuid references admin_users(admin_user_id) on delete set null,
    actor_email text not null default '',
    actor_role text not null default '',
    action text not null,
    target_type text not null default '',
    target_id text not null default '',
    target_label text not null default '',
    summary text not null,
    severity text not null check (severity in ('info', 'warning', 'critical')),
    metadata jsonb not null default '{}'::jsonb,
    ip_address text not null default '',
    user_agent text not null default '',
    created_at timestamptz not null default now(),
    check (action <> ''),
    check (summary <> '')
);

create index admin_audit_events_created_idx
    on admin_audit_events (created_at desc);

create index admin_audit_events_actor_idx
    on admin_audit_events (actor_admin_user_id, created_at desc);

create index admin_audit_events_severity_idx
    on admin_audit_events (severity, created_at desc);

create index admin_audit_events_target_idx
    on admin_audit_events (target_type, target_id, created_at desc);

grant select, insert on admin_audit_events to xtiitch_app;
