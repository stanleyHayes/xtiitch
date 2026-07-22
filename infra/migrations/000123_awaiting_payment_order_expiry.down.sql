drop index if exists orders_active_draft_created_idx;

alter table orders
  drop column if exists closed_at;
