-- Combined cart checkout: several online orders paid in one Paystack
-- transaction share a checkout_group_id. The group's anchor order carries the
-- single payment; its webhook confirmation fans out to every sibling in the
-- group (see confirmOrderGroupOnPayment). Null for every order placed outside a
-- cart (walk-in, single online order, bespoke), so existing flows are untouched.
alter table orders
	add column if not exists checkout_group_id uuid;

create index if not exists orders_checkout_group_idx
	on orders (business_id, checkout_group_id)
	where checkout_group_id is not null;

-- A combined cart charge records one payment with the new 'cart_full' purpose, so
-- the purpose CHECK must allow it.
alter table payments
	drop constraint if exists payments_purpose_check;
alter table payments
	add constraint payments_purpose_check
	check (purpose = any (array['standard_full', 'deposit', 'balance', 'booking_deposit', 'cart_full']));
