-- A through-platform payment's order must belong to the same business as the
-- payment. payments.order_id was a bare uuid, so a stray reference could point
-- at another tenant's order; this makes the database itself reject that, as a
-- backstop independent of the application checks and row-level security
-- (Technical Specification: tenant isolation is release-blocking).

ALTER TABLE orders
  ADD CONSTRAINT orders_id_business_unique UNIQUE (order_id, business_id);

-- MATCH SIMPLE (the default): a payment with no order_id (e.g. a standalone
-- authenticated charge) skips the check entirely, but one that carries an
-- order_id must reference an order of the very same business.
ALTER TABLE payments
  ADD CONSTRAINT payments_order_same_business_fk
  FOREIGN KEY (order_id, business_id) REFERENCES orders (order_id, business_id);
