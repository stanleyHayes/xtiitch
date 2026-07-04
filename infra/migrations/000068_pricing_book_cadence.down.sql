-- Reverse 000068_pricing_book_cadence: drop the cadence columns. Dropping the
-- billing_cadence column also drops its inline CHECK constraint.
alter table business_subscriptions drop column if exists first_purchase_consumed;
alter table business_subscriptions drop column if exists billing_cadence;

alter table plans drop column if exists yearly_renewal_minor;
alter table plans drop column if exists yearly_first_minor;
alter table plans drop column if exists quarterly_renewal_minor;
alter table plans drop column if exists quarterly_first_minor;
