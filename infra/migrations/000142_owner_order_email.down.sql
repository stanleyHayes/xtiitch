drop index if exists outbound_messages_owner_email_pending_idx;
alter table outbound_messages drop column if exists owner_email_sent_at;
