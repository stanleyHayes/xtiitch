-- A free period books a ZERO invoice, and the table refused it.
--
-- amount_minor was constrained `> 0` (000025), written when every invoice was a
-- paid one. A free-period discount code (Pricing Book §4: "A paid plan free for N
-- months, then converts to full renewal") books a zero, already-paid invoice for
-- the free window -- it is the receipt for that window, and its ref is what makes
-- the activation idempotent. So the insert violated the CHECK and EVERY
-- free-period redemption failed outright. §4's institutional onboarding ("Growth
-- free 3 months" for association members) could not work at all.
--
-- Zero, not negative: an invoice records money owed or paid, never money handed
-- back, and a refund would be its own record. Relaxing to >= 0 admits the free
-- window while still rejecting a negative invoice.
alter table business_subscription_invoices
    drop constraint if exists business_subscription_invoices_amount_minor_check;

alter table business_subscription_invoices
    add constraint business_subscription_invoices_amount_minor_check
    check (amount_minor >= 0);
