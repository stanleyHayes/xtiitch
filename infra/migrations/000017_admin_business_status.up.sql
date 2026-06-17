alter table businesses
  add column operational_status text not null default 'active'
    check (operational_status in ('active', 'suspended')),
  add column suspension_reason text not null default '',
  add column suspended_at timestamptz,
  add column suspended_by_admin_user_id uuid references admin_users(admin_user_id) on delete set null;

create index businesses_operational_status_idx on businesses (operational_status);
