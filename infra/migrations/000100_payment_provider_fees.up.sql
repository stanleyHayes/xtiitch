-- §3.2: the Money Desk must mirror Paystack, never derive fees locally. That
-- means the provider-REPORTED figures are persisted per transaction at the
-- moment they are known, and every later read sums the stored columns.
--
--   provider_fee_minor        the transaction fee Paystack reports it took on
--                             the charge ("fees" / fees_split on the webhook or
--                             verify payload), written once when the payment
--                             transitions out of 'initiated'. NULL on rows that
--                             predate this column or whose event carried no fee
--                             means "not reported" — reads coalesce it to 0 and
--                             NEVER recompute it.
--   provider_fee_captured_at  when that fee figure was captured.
--   xtiitch_tax_minor         the VAT on the Xtiitch fee from the §4.2/§4.3
--                             quote that was charged, written at charge time
--                             alongside commission_minor (which stays fee+tax —
--                             it is the split's transaction_charge). Persisting
--                             the tax part lets the Money Desk split the
--                             Xtiitch fee from its tax without recomputing.
--
-- All nullable: existing rows keep working with their current meaning
-- (commission_minor = fee+tax, no provider fee on file).
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS provider_fee_minor bigint,
  ADD COLUMN IF NOT EXISTS xtiitch_tax_minor bigint,
  ADD COLUMN IF NOT EXISTS provider_fee_captured_at timestamptz;
