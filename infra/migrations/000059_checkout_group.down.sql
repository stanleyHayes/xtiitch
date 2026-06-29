alter table payments
	drop constraint if exists payments_purpose_check;
alter table payments
	add constraint payments_purpose_check
	check (purpose = any (array['standard_full', 'deposit', 'balance', 'booking_deposit']));

drop index if exists orders_checkout_group_idx;

alter table orders
	drop column if exists checkout_group_id;
