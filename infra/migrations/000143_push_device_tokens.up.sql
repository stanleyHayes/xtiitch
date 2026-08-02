-- Push notifications to the mobile app.
--
-- The owner already learns about a new order by SMS (and, since 000142, by
-- email). Both reach her away from the app but neither reaches the phone she
-- actually works on: the mobile app can only tell her about an order while it
-- is open and she is looking at it. A push notification is the channel that
-- wakes a closed app.
--
-- Push rides the existing outbox rather than being sent from the API. The
-- worker already claims outbound_messages and dispatches by channel
-- (ChannelRoutedSender), so a 'push' row inherits the retry, exponential
-- backoff and dead-lettering that SMS has had all along. This is the opposite
-- of the decision taken for email in 000142, and for a concrete reason: the
-- worker has no email transport, but it is exactly where a push transport
-- belongs.

-- The outbox constraint is an allowlist, so the database rejects a 'push' row
-- until this runs. Dropping and re-adding is the only way to widen a CHECK.
alter table outbound_messages
	drop constraint outbound_messages_channel_check;

alter table outbound_messages
	add constraint outbound_messages_channel_check
	check (channel in ('whatsapp', 'sms', 'push'));

-- One row per device that may receive notifications for a business.
--
-- The token comes from Expo and identifies an app installation, not a person.
-- That distinction drives the schema below.
create table push_device_tokens (
	token_id uuid primary key default gen_random_uuid(),
	business_id uuid not null
		references businesses (business_id) on delete cascade,
	-- Whose device it is. Cascading on delete means removing an operator stops
	-- their phone receiving the business's orders in the same statement, with no
	-- cleanup step that could be forgotten.
	business_user_id uuid not null
		references business_users (business_user_id) on delete cascade,
	token text not null,
	-- Reported by the client for the settings list ("iPhone — last used
	-- Tuesday"). Never trusted for delivery decisions; Expo routes by token.
	platform text not null default ''
		check (platform in ('', 'ios', 'android', 'web')),
	device_name text not null default '',
	-- Refreshed every time the app re-registers, which it does on each launch.
	-- A token that has not been seen in months is a device that has not opened
	-- the app in months, which is useful for pruning later.
	last_seen_at timestamptz not null default now(),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

-- Globally unique, NOT unique per (business, user).
--
-- A phone can be handed over, or an operator can sign out and a colleague sign
-- in on the same device. Expo issues that device the same token either way. If
-- the token could exist under two owners, the previous operator's alerts would
-- keep arriving on a phone that now belongs to someone else — a real
-- confidentiality leak, since order alerts name the customer and the amount.
-- One row per token forces re-registration to MOVE the device to the new
-- operator instead of adding a second claim on it.
create unique index push_device_tokens_token_idx
	on push_device_tokens (token);

-- The enqueue path fans out over every device belonging to a business.
create index push_device_tokens_business_idx
	on push_device_tokens (business_id);

alter table push_device_tokens enable row level security;
alter table push_device_tokens force row level security;

-- Matches outbound_messages_tenant_isolation exactly: same setting name, same
-- NULLIF guard (an unset setting is '' and must not cast to uuid), and the
-- comparison in uuid rather than text.
create policy push_device_tokens_tenant_isolation
	on push_device_tokens
	using (
		current_setting('xtiitch.bypass', true) = 'on'
		or business_id = (nullif(current_setting('xtiitch.current_business_id', true), ''))::uuid
	)
	with check (
		current_setting('xtiitch.bypass', true) = 'on'
		or business_id = (nullif(current_setting('xtiitch.current_business_id', true), ''))::uuid
	);

grant select, insert, update, delete on push_device_tokens to xtiitch_app;
