alter table outbound_messages
  add column provider_message_id text not null default '',
  add column provider_response jsonb not null default '{}'::jsonb;

create index outbound_messages_provider_message_idx
  on outbound_messages (provider_message_id)
  where provider_message_id <> '';
