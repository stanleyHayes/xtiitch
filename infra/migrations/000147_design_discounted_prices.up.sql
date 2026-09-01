alter table design_prices
    add column discounted_price_minor bigint;

alter table design_prices
    add constraint design_prices_discounted_price_valid
    check (
        discounted_price_minor is null
        or (discounted_price_minor >= 0 and discounted_price_minor < price_minor)
    );
