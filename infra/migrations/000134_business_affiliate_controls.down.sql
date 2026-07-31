drop policy if exists affiliate_signups_business_read on affiliate_signups;
drop policy if exists affiliate_clicks_business_read on affiliate_clicks;
drop policy if exists affiliates_business_isolation on affiliates;

alter table affiliates
    drop column if exists updated_by_business_user_id,
    drop column if exists created_by_business_user_id;

alter table affiliate_programmes
    drop column if exists updated_by_business_user_id,
    drop column if exists created_by_business_user_id;
