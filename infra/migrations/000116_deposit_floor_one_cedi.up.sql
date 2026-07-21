-- 000116_deposit_floor_one_cedi
--
-- The bespoke-order deposit floor drops from GHS 100 (10000 pesewas) to GHS 1
-- (100 pesewas), with no upper cap; an unset deposit now defaults to GHS 1.
-- Two CHECK constraints still enforce the old floor: businesses.default_deposit_minor
-- (000001) and designs.deposit_override_minor (000005). The column DEFAULT moves to
-- 100 too — app code never writes default_deposit_minor, so the DEFAULT is what a
-- store with no configured deposit resolves to. Existing rows keep their values
-- (a store already on GHS 100 stays there until it is changed).

alter table businesses
    alter column default_deposit_minor set default 100;

alter table businesses
    drop constraint if exists businesses_default_deposit_minor_check;

alter table businesses
    add constraint businesses_default_deposit_minor_check
    check (default_deposit_minor >= 100);

alter table designs
    drop constraint if exists designs_deposit_override_minor_check;

alter table designs
    add constraint designs_deposit_override_minor_check
    check (deposit_override_minor is null or deposit_override_minor >= 100);
