select set_config('xtiitch.bypass', 'on', false);

update businesses
set default_deposit_minor = 10000
where default_deposit_minor = 100;

select set_config('xtiitch.bypass', 'off', false);
