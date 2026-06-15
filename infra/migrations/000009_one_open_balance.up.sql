-- At most one balance charge may be in flight per order. Without this, two
-- concurrent "collect balance" calls both read the same settled_minor, both
-- raise a full balance charge, and the customer is charged twice while the order
-- ledger's least(settled, agreed) cap silently absorbs only one credit — money
-- moves with no matching order obligation. This makes a second in-flight balance
-- payment impossible at the database, independent of application checks.

CREATE UNIQUE INDEX payments_one_open_balance_idx
  ON payments (order_id)
  WHERE purpose = 'balance' AND status = 'initiated' AND order_id IS NOT NULL;
