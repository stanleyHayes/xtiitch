drop index if exists manual_takings_business_commission_idx;

alter table manual_takings
    drop column if exists commission_note,
    drop column if exists commission_status,
    drop column if exists commission_minor,
    drop column if exists commission_bps;
