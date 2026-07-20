ALTER TABLE payments
  DROP COLUMN IF EXISTS provider_fee_captured_at,
  DROP COLUMN IF EXISTS xtiitch_tax_minor,
  DROP COLUMN IF EXISTS provider_fee_minor;
