drop table if exists push_device_tokens;

-- Queued push messages have to go before the allowlist narrows again, or
-- re-adding the constraint fails against its own table.
delete from outbound_messages where channel = 'push';

alter table outbound_messages
	drop constraint outbound_messages_channel_check;

alter table outbound_messages
	add constraint outbound_messages_channel_check
	check (channel in ('whatsapp', 'sms'));
