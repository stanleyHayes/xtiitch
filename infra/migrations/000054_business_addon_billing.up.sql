-- Recurring billing state for paid add-ons (the AI Assistant). A business_addons
-- row can be activated two ways: manually by an admin (billing_status 'manual',
-- no money changes hands) or by the business paying via Paystack (billing_status
-- 'active', with a stored reusable authorization the renewal sweep charges each
-- month). Mirrors the business_subscriptions recurring-billing columns. Xtiitch
-- never holds funds — Paystack charges the customer directly.
alter table business_addons
    add column authorization_ref text,
    add column customer_ref      text,
    add column amount_minor      bigint      not null default 0,
    add column currency          text        not null default 'GHS',
    add column billing_status    text        not null default 'manual',
    add column next_charge_at    timestamptz,
    add column last_charged_at   timestamptz,
    add column last_reference    text;

-- The renewal sweep scans for paid, active add-ons whose next charge is due.
create index business_addons_due_idx
    on business_addons (next_charge_at)
    where active = true and billing_status = 'active';
