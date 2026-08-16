-- Affiliate signup is self-service. An approved application created without an
-- operator is identified by metadata.approval_mode = self_service.
do $$
declare
    review_constraint text;
begin
    select conname into review_constraint
    from pg_constraint
    where conrelid = 'affiliate_applications'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%reviewed_at%reviewed_by_admin_user_id%';
    if review_constraint is not null then
        execute format('alter table affiliate_applications drop constraint %I', review_constraint);
    end if;
end $$;

alter table affiliate_applications
    add constraint affiliate_applications_review_state_check check (
        status in ('pending_review', 'withdrawn')
        or (
            reviewed_at is not null
            and (
                reviewed_by_admin_user_id is not null
                or metadata ->> 'approval_mode' = 'self_service'
            )
        )
    );

alter table affiliates
    drop constraint if exists affiliates_commission_rate_check;

alter table affiliates
    add constraint affiliates_commission_rate_check
        check (commission_rate >= 0);
