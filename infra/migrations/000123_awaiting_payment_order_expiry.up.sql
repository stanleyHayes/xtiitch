-- Awaiting-payment orders remain auditable after a customer dismisses them.
-- A closed draft is hidden from both customer and business order lists; a
-- payment that was already in flight can still confirm it normally.
alter table orders
  add column if not exists closed_at timestamptz;

create index if not exists orders_active_draft_created_idx
  on orders (business_id, created_at desc)
  where status = 'draft' and closed_at is null;
