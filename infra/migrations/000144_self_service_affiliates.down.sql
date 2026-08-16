alter table affiliates
    drop constraint if exists affiliates_commission_rate_check;

alter table affiliates
    add constraint affiliates_commission_rate_check
        check (commission_rate > 0);

alter table affiliate_applications
    drop constraint if exists affiliate_applications_review_state_check;

alter table affiliate_applications
    add constraint affiliate_applications_check check (
        status in ('pending_review', 'withdrawn')
        or (reviewed_at is not null and reviewed_by_admin_user_id is not null)
    );
