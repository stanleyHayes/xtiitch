DROP TABLE IF EXISTS marketplace_charge_members;
DROP TABLE IF EXISTS marketplace_charges;

ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_purpose_check;
ALTER TABLE payments
  ADD CONSTRAINT payments_purpose_check
  CHECK (purpose = ANY (ARRAY['standard_full', 'deposit', 'balance', 'booking_deposit', 'cart_full']));
