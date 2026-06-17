drop index if exists outbound_messages_provider_message_idx;

alter table outbound_messages
  drop column if exists provider_response,
  drop column if exists provider_message_id;
