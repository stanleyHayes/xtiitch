drop index if exists affiliates_owner_business_status_idx;
drop index if exists affiliates_programme_status_idx;

alter table affiliates
    drop column if exists source_application_id,
    drop column if exists target_ref_id,
    drop column if exists target_scope,
    drop column if exists owner_business_id,
    drop column if exists affiliate_programme_id;

drop table if exists affiliate_programmes;
