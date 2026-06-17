create table admin_support_ticket_states (
    ticket_key text primary key,
    business_id uuid references businesses(business_id) on delete cascade,
    status text not null default 'open'
        check (status in ('open', 'resolved')),
    assigned_admin_user_id uuid references admin_users(admin_user_id) on delete set null,
    note text not null default '',
    updated_by_admin_user_id uuid references admin_users(admin_user_id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (ticket_key <> '')
);

create index admin_support_ticket_states_status_idx
    on admin_support_ticket_states (status, updated_at desc);

create index admin_support_ticket_states_assignee_idx
    on admin_support_ticket_states (assigned_admin_user_id, updated_at desc);

create index admin_support_ticket_states_business_idx
    on admin_support_ticket_states (business_id, updated_at desc);

grant select, insert, update on admin_support_ticket_states to xtiitch_app;
