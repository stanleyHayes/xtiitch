drop table if exists affiliate_plan_attribution_reservations;

drop index if exists affiliate_conversions_type_status_idx;
drop index if exists affiliate_conversions_payment_reference_unique_idx;
drop index if exists affiliate_conversions_first_paid_plan_unique_idx;
drop index if exists affiliate_conversions_purchase_unique_idx;

alter table affiliate_conversions
    drop constraint if exists affiliate_conversions_typed_reference_check,
    drop constraint if exists affiliate_conversions_order_business_fkey;

delete from affiliate_conversions
where conversion_type = 'paid_plan_signup';

alter table affiliate_conversions
    drop column if exists funding_source,
    drop column if exists programme_owner_type,
    drop column if exists affiliate_programme_id,
    drop column if exists payment_reference,
    drop column if exists subscription_invoice_id,
    drop column if exists subscription_id,
    drop column if exists conversion_type,
    alter column order_id set not null;

alter table affiliate_conversions
    add constraint affiliate_conversions_order_id_key unique (order_id),
    add constraint affiliate_conversions_order_id_business_id_fkey
        foreign key (order_id, business_id)
        references orders (order_id, business_id)
        on delete cascade;
