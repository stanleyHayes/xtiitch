alter table promotions
    add column if not exists promotion_channel text not null default 'store_purchase'
        check (promotion_channel in ('store_purchase', 'paid_plan'));

alter table subscription_discount_codes
    add column if not exists promotion_channel text not null default 'paid_plan'
        check (promotion_channel = 'paid_plan'),
    add column if not exists funding_source text not null default 'platform'
        check (funding_source = 'platform');

alter table subscription_discount_redemptions
    add column if not exists payment_reference text not null default '';

create index if not exists promotions_channel_status_idx
    on promotions (promotion_channel, status, starts_at, ends_at);

create index if not exists subscription_discounts_channel_active_idx
    on subscription_discount_codes (
        promotion_channel,
        active,
        valid_from,
        valid_until
    );

create index if not exists subscription_redemptions_payment_reference_idx
    on subscription_discount_redemptions (payment_reference)
    where payment_reference <> '';
