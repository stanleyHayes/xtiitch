-- §4.4: the single "pass the platform fee to the buyer" toggle becomes THREE
-- independent pass-down tick boxes on the store's settings — pass the Xtiitch
-- fee, pass the Tax (VAT on the Xtiitch fee), and pass the Paystack fee. All
-- default false (the owner absorbs every fee), the spec's mandated default.
-- The old fee_pass_to_buyer maps onto fee_pass_xtiitch_fee (that is the fee it
-- passed), so existing pass-down stores keep their behaviour; it is then
-- dropped. DDL on a FORCE-RLS table is unaffected by RLS, so no bypass needed.
alter table store_settings
    add column if not exists fee_pass_xtiitch_fee boolean not null default false,
    add column if not exists fee_pass_tax boolean not null default false,
    add column if not exists fee_pass_paystack_fee boolean not null default false;

update store_settings set fee_pass_xtiitch_fee = true where fee_pass_to_buyer;

alter table store_settings drop column if exists fee_pass_to_buyer;
