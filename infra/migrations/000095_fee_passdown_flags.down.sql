alter table store_settings
    add column if not exists fee_pass_to_buyer boolean not null default false;

update store_settings set fee_pass_to_buyer = true where fee_pass_xtiitch_fee;

alter table store_settings
    drop column if exists fee_pass_xtiitch_fee,
    drop column if exists fee_pass_tax,
    drop column if exists fee_pass_paystack_fee;
