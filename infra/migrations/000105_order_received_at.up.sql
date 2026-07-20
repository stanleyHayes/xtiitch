-- §5.3 customer "Received" marker. When the store owner moves an order to its
-- final stage (status = 'fulfilled'), the order lands in the customer's
-- Archived tab with a "Received" button; the customer hitting it stamps
-- received_at and the order disappears from the tab. NULL means "not yet
-- acknowledged by the customer" — every pre-existing order stays visible.

alter table orders
  add column if not exists received_at timestamptz;

comment on column orders.received_at is
  '§5.3: when the customer physically received the order and hit "Received"; NULL = not yet acknowledged. Settable only once the order reached its final stage (status = fulfilled).';
