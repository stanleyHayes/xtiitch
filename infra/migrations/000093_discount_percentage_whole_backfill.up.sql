-- The admin console used to scale percentage discount values x100 on write --
-- "20%" was stored as discount_value 2000 -- while everything downstream reads
-- the column as whole percent (valid range 1-100; the column is discount_value,
-- not discount_value_bps). A stored 2000 percent off clamps to the full
-- renewal: every percentage code written that way gave the plan away free.
--
-- Divide every out-of-range percentage value back down. Integer division is
-- exact here: the old console only ever produced multiples of 100, so nothing
-- is rounded away. Values already in range (<= 100) and the fixed/free_period
-- types are untouched.
--
-- subscription_discount_codes carries no row-level security (000067 enables it
-- only on subscription_discount_redemptions), so no tenant bypass is needed.
update subscription_discount_codes
set discount_value = discount_value / 100, updated_at = now()
where discount_type = 'percentage' and discount_value > 100;
