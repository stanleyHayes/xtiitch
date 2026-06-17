create table admin_money_replay_requests (
    replay_request_id uuid primary key,
    provider_reference text not null,
    payment_id uuid references payments(payment_id) on delete set null,
    requested_by_admin_user_id uuid references admin_users(admin_user_id) on delete set null,
    reason text not null default '',
    status text not null default 'queued'
        check (status in ('queued', 'reviewed', 'cancelled')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (provider_reference <> '')
);

create index admin_money_replay_requests_reference_idx
    on admin_money_replay_requests (provider_reference, created_at desc);

create index admin_money_replay_requests_status_idx
    on admin_money_replay_requests (status, created_at desc);

create table admin_settlement_review_holds (
    business_id uuid primary key references businesses(business_id) on delete cascade,
    is_active boolean not null default true,
    reason text not null default '',
    placed_by_admin_user_id uuid references admin_users(admin_user_id) on delete set null,
    placed_at timestamptz not null default now(),
    released_by_admin_user_id uuid references admin_users(admin_user_id) on delete set null,
    released_at timestamptz,
    updated_at timestamptz not null default now(),
    check (reason <> ''),
    check (
        (is_active = true and released_at is null)
        or (is_active = false and released_at is not null)
    )
);

create index admin_settlement_review_holds_active_idx
    on admin_settlement_review_holds (is_active, updated_at desc);

grant select, insert, update on admin_money_replay_requests to xtiitch_app;
grant select, insert, update on admin_settlement_review_holds to xtiitch_app;
