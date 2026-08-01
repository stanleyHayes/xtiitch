-- Email the store owner when an order lands, alongside the SMS she already
-- gets.
--
-- The SMS is enqueued into outbound_messages and delivered by the worker. Email
-- cannot ride the same rails: the worker claims outbox rows WITHOUT filtering
-- on channel, so an 'email' row would be picked up by a process that has no
-- email transport and retried until it exhausted its attempts. Email lives in
-- the API (Resend), so the API sends it.
--
-- That leaves idempotency. A Paystack webhook is redelivered freely, and the
-- owner must not get an email per delivery. This column is the claim: sending
-- stamps it inside a transaction, and the claim query only ever selects rows
-- where it is still null, so a redelivery finds nothing to send.
--
-- It also self-heals. A send that fails leaves the stamp null, so the next
-- settlement for that business picks the row up again rather than losing the
-- notification silently.
alter table outbound_messages
	add column if not exists owner_email_sent_at timestamptz;

-- The claim query filters on exactly this shape: owner alerts still awaiting an
-- email. Partial, so it stays small — it indexes only the unsent tail rather
-- than every message the platform has ever queued.
create index if not exists outbound_messages_owner_email_pending_idx
	on outbound_messages (business_id, created_at)
	where kind = 'new_order_owner' and owner_email_sent_at is null;
