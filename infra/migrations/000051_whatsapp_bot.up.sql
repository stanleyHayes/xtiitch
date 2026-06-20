-- Inbound WhatsApp ordering bot, Phase 0 foundations.
--
-- whatsapp_sessions holds the per-sender conversation state (which step, partial
-- order) keyed by the sender's WhatsApp id. One shared Xtiitch number routes to
-- many shops, so business_id is resolved during the conversation and may be null
-- until then. Sessions expire so abandoned chats restart cleanly.
--
-- whatsapp_inbound_messages is the dedupe ledger: Meta retries webhooks, so we
-- record each processed message id and ignore repeats.
--
-- Both are platform-global (the inbound webhook is not tenant-scoped — routing to
-- a business happens inside the engine), so they carry no row-level security and
-- are accessed under the application's RLS bypass, like customer_otp_challenges.

create table whatsapp_sessions (
    wa_id       text primary key,
    business_id uuid references businesses (business_id) on delete set null,
    state       jsonb not null default '{}'::jsonb,
    expires_at  timestamptz not null,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create index whatsapp_sessions_expires_idx on whatsapp_sessions (expires_at);

create table whatsapp_inbound_messages (
    message_id  text primary key,
    received_at timestamptz not null default now()
);

create index whatsapp_inbound_messages_received_idx on whatsapp_inbound_messages (received_at);

grant select, insert, update, delete on whatsapp_sessions to xtiitch_app;
grant select, insert, update, delete on whatsapp_inbound_messages to xtiitch_app;
