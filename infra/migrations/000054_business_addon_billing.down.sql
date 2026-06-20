drop index if exists business_addons_due_idx;

alter table business_addons
    drop column if exists authorization_ref,
    drop column if exists customer_ref,
    drop column if exists amount_minor,
    drop column if exists currency,
    drop column if exists billing_status,
    drop column if exists next_charge_at,
    drop column if exists last_charged_at,
    drop column if exists last_reference;
