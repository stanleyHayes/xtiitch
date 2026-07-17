-- Zero-amount invoices booked while the relaxed check was in force would violate
-- the restored one, so clear them first: they are free-window receipts, and the
-- code that reads them is gone on the way down.
select set_config('xtiitch.bypass', 'on', false);

delete from business_subscription_invoices where amount_minor = 0;

select set_config('xtiitch.bypass', 'off', false);

alter table business_subscription_invoices
    drop constraint if exists business_subscription_invoices_amount_minor_check;

alter table business_subscription_invoices
    add constraint business_subscription_invoices_amount_minor_check
    check (amount_minor > 0);
