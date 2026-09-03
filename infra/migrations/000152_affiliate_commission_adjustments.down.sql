delete from affiliate_conversions where conversion_type = 'adjustment';

drop index if exists affiliate_conversion_adjustment_source_idx;
drop index if exists affiliate_conversion_adjustment_event_unique_idx;

alter table affiliate_conversions
    drop constraint if exists affiliate_conversions_typed_reference_check,
    drop constraint if exists affiliate_conversions_amounts_check,
    drop constraint if exists affiliate_conversions_conversion_type_check;

alter table affiliate_conversions
    drop column if exists adjustment_event_signature,
    drop column if exists source_conversion_id;

alter table affiliate_conversions
    add constraint affiliate_conversions_conversion_type_check
        check (conversion_type in ('purchase', 'subscription_payment')),
    add constraint affiliate_conversions_gross_minor_check check (gross_minor > 0),
    add constraint affiliate_conversions_commission_minor_check check (commission_minor >= 0),
    add constraint affiliate_conversions_check check (commission_minor <= gross_minor),
    add constraint affiliate_conversions_typed_reference_check check (
        (conversion_type = 'purchase' and order_id is not null
            and subscription_id is null and payment_reference = '')
        or
        (conversion_type = 'subscription_payment' and order_id is null
            and subscription_id is not null and payment_reference <> ''
            and programme_owner_type = 'platform' and funding_source = 'platform')
    );
