drop index if exists businesses_operational_status_idx;

alter table businesses
  drop column if exists suspended_by_admin_user_id,
  drop column if exists suspended_at,
  drop column if exists suspension_reason,
  drop column if exists operational_status;
