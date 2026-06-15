ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_order_same_business_fk;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_id_business_unique;
