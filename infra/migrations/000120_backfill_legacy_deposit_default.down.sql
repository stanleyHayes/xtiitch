-- Restore the legacy seed when rolling back this targeted backfill.
update businesses
set default_deposit_minor = 10000
where default_deposit_minor = 100;
