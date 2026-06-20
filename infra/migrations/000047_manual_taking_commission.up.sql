-- Offline/manual payments cannot be split by Paystack because the provider does
-- not process that money. From this migration forward, manual takings snapshot
-- the business plan's commission at log time so Xtiitch can invoice or reconcile
-- the platform fee later without claiming to have moved funds.
alter table manual_takings
    add column commission_bps integer not null default 0
        check (commission_bps >= 0 and commission_bps <= 10000),
    add column commission_minor bigint not null default 0
        check (commission_minor >= 0),
    add column commission_status text not null default 'not_applicable'
        check (commission_status in ('not_applicable', 'due', 'invoiced', 'settled', 'waived')),
    add column commission_note text not null default '';

create index manual_takings_business_commission_idx
    on manual_takings (business_id, commission_status, taken_at desc)
    where commission_minor > 0;
