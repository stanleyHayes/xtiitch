drop index if exists subscription_redemptions_payment_reference_idx;
drop index if exists subscription_discounts_channel_active_idx;
drop index if exists promotions_channel_status_idx;

alter table subscription_discount_redemptions
    drop column if exists payment_reference;

alter table subscription_discount_codes
    drop column if exists funding_source,
    drop column if exists promotion_channel;

alter table promotions
    drop column if exists promotion_channel;
