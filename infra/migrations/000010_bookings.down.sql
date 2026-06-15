ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_booking_same_business_fk;
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS availability_windows;
ALTER TABLE store_settings
  DROP COLUMN IF EXISTS business_timezone;
