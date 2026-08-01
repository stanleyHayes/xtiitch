-- In-dashboard alerting for store owners.
--
-- A new order already enqueues an SMS to the owner (new_order_owner), and the
-- dashboard already lists outbound messages under Messages. What was missing is
-- the part that makes it an ALERT rather than an archive: nothing told the owner
-- a new order had arrived unless she happened to open that page, and nothing
-- distinguished what she had already seen.
--
-- One row per business user holding the moment they last opened the messages
-- view. Unread is derived — count(outbound_messages created after last_read_at)
-- — rather than stored per message, so a new order never has to fan out a row
-- per operator, and adding an operator does not need a backfill.
create table business_notification_reads (
	business_user_id uuid primary key
		references business_users (business_user_id) on delete cascade,
	business_id uuid not null
		references businesses (business_id) on delete cascade,
	-- Reads start at row creation, so a brand-new operator is not greeted by a
	-- badge counting every message the business ever sent.
	last_read_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index business_notification_reads_business_idx
	on business_notification_reads (business_id);

-- Row-level security, matching every other tenant table: an operator may only
-- ever see or write their own business's read state.
alter table business_notification_reads enable row level security;
alter table business_notification_reads force row level security;

-- Matches outbound_messages_tenant_isolation exactly: same setting name, same
-- NULLIF guard (an unset setting is '' and must not cast to uuid), and the
-- comparison in uuid rather than text.
create policy business_notification_reads_tenant_isolation
	on business_notification_reads
	using (
		current_setting('xtiitch.bypass', true) = 'on'
		or business_id = (nullif(current_setting('xtiitch.current_business_id', true), ''))::uuid
	)
	with check (
		current_setting('xtiitch.bypass', true) = 'on'
		or business_id = (nullif(current_setting('xtiitch.current_business_id', true), ''))::uuid
	);
