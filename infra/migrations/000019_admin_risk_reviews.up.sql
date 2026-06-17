create table admin_risk_review_states (
    review_key text primary key,
    business_id uuid references businesses(business_id) on delete cascade,
    status text not null default 'open'
        check (status in ('open', 'closed')),
    reason text not null default '',
    updated_by_admin_user_id uuid references admin_users(admin_user_id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (review_key <> '')
);

create index admin_risk_review_states_status_idx
    on admin_risk_review_states (status, updated_at desc);

create index admin_risk_review_states_business_idx
    on admin_risk_review_states (business_id, updated_at desc);

grant select, insert, update on admin_risk_review_states to xtiitch_app;
