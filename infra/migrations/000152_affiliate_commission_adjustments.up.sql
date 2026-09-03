-- Auditable Affiliate commission debits for partial refunds and post-payout
-- reversals. Negative rows remain in the same ledger and are netted from a
-- later payout instead of rewriting settled financial history.

alter table affiliate_conversions
    add column source_conversion_id uuid
        references affiliate_conversions (affiliate_conversion_id) on delete restrict,
    add column adjustment_event_signature text not null default '';

alter table affiliate_conversions
    drop constraint if exists affiliate_conversions_conversion_type_check,
    drop constraint if exists affiliate_conversions_typed_reference_check,
    drop constraint if exists affiliate_conversions_gross_minor_check,
    drop constraint if exists affiliate_conversions_commission_minor_check,
    drop constraint if exists affiliate_conversions_check;

alter table affiliate_conversions
    add constraint affiliate_conversions_conversion_type_check
        check (conversion_type in ('purchase', 'subscription_payment', 'adjustment')),
    add constraint affiliate_conversions_amounts_check check (
        (conversion_type <> 'adjustment'
            and gross_minor > 0 and commission_minor >= 0
            and commission_minor <= gross_minor)
        or
        (conversion_type = 'adjustment'
            and gross_minor < 0 and commission_minor < 0
            and commission_minor >= gross_minor)
    ),
    add constraint affiliate_conversions_typed_reference_check check (
        (conversion_type = 'purchase' and order_id is not null
            and subscription_id is null and payment_reference = ''
            and source_conversion_id is null and adjustment_event_signature = '')
        or
        (conversion_type = 'subscription_payment' and order_id is null
            and subscription_id is not null and payment_reference <> ''
            and programme_owner_type = 'platform' and funding_source = 'platform'
            and source_conversion_id is null and adjustment_event_signature = '')
        or
        (conversion_type = 'adjustment' and order_id is null
            and subscription_id is null and payment_reference = ''
            and source_conversion_id is not null and adjustment_event_signature <> '')
    );

create unique index affiliate_conversion_adjustment_event_unique_idx
    on affiliate_conversions (adjustment_event_signature)
    where conversion_type = 'adjustment';

create index affiliate_conversion_adjustment_source_idx
    on affiliate_conversions (source_conversion_id, created_at)
    where conversion_type = 'adjustment';
