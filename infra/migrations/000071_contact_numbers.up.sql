-- System Updates: distinct contact numbers.
--
-- Customers now provide a WhatsApp number (for the store owner to chat about the
-- order, incl. bespoke pricing) AND a direct phone (calls/SMS). The existing
-- customers.phone stays as the direct phone / SMS + OTP target; whatsapp_number
-- is the new WhatsApp chat number (may equal phone).
--
-- Store owners previously had only business_users.whatsapp_number; add a direct
-- phone so they can receive SMS notifications.
--
-- Both are nullable DDL additions with no backfill, so no RLS bypass is needed.
alter table customers add column if not exists whatsapp_number text;

alter table business_users add column if not exists phone text;
