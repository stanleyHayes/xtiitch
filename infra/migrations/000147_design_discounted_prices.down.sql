alter table design_prices
    drop constraint if exists design_prices_discounted_price_valid;

alter table design_prices
    drop column if exists discounted_price_minor;
