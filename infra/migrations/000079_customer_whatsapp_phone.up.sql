-- Second contact number for a customer (Xtiitch-Updates §3c "two phones").
--
-- A customer's `phone` is their OTP-verified LOGIN number (SMS). This adds a
-- separate WhatsApp contact number the shopper can set on their profile, which
-- the store owner uses to chat about an order — distinct from the login phone so
-- verifying identity and being reachable on WhatsApp are decoupled. Stored on the
-- global customers identity, defaulting to '' (unset). Pure DDL ALTER — a new
-- column with a constant default needs no RLS bypass and no backfill.
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS whatsapp_phone text NOT NULL DEFAULT '';
