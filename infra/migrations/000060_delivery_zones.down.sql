ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_delivery_zone_fk;

ALTER TABLE orders
  DROP COLUMN IF EXISTS delivery_zone_id,
  DROP COLUMN IF EXISTS delivery_fee_minor,
  DROP COLUMN IF EXISTS delivery_address,
  DROP COLUMN IF EXISTS delivery_method;

DROP TABLE IF EXISTS delivery_zones;
