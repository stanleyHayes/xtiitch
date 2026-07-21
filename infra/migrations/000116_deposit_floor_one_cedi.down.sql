-- Restores the GHS 100 deposit floor from 000001/000005. Fails if any row
-- holds a deposit below 10000 pesewas — lower them (or null the overrides)
-- before migrating down.

alter table businesses
    drop constraint if exists businesses_default_deposit_minor_check;

alter table businesses
    add constraint businesses_default_deposit_minor_check
    check (default_deposit_minor >= 10000);

alter table businesses
    alter column default_deposit_minor set default 10000;

alter table designs
    drop constraint if exists designs_deposit_override_minor_check;

alter table designs
    add constraint designs_deposit_override_minor_check
    check (deposit_override_minor is null or deposit_override_minor >= 10000);
