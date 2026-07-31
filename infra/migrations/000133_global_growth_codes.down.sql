drop trigger if exists subscription_discounts_growth_code_registry
    on subscription_discount_codes;
drop trigger if exists referral_codes_growth_code_registry on referral_codes;
drop trigger if exists promotions_growth_code_registry on promotions;
drop trigger if exists affiliates_growth_code_registry on affiliates;
drop function if exists sync_growth_code_registry();
drop table if exists growth_codes;
