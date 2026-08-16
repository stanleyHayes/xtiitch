-- Move applications created under the former manual-approval flow into the
-- default programme. Their portal accounts start as invited; the normal
-- forgot-password flow lets them securely choose a password.
with programme as (
    select *
    from affiliate_programmes
    where owner_type = 'platform' and is_default
    order by (status = 'active') desc, updated_at desc
    limit 1
), eligible as (
    select application.*, programme.affiliate_programme_id,
        programme.default_purchase_commission_bps,
        programme.default_first_paid_plan_commission_bps,
        programme.cookie_window_days, programme.payout_mode
    from affiliate_applications application
    cross join programme
    where application.status = 'pending_review'
      and not exists (
          select 1 from affiliates
          where lower(code) = lower(application.requested_code)
      )
      and not exists (
          select 1 from affiliate_accounts
          where lower(email) = lower(application.email)
      )
), inserted_affiliates as (
    insert into affiliates (
        affiliate_id, entity_type, code, display_name, contact_name, email,
        phone, website_url, commission_model, commission_rate,
        purchase_commission_bps, first_paid_plan_commission_bps,
        cookie_window_days, payout_mode, status, notes,
        affiliate_programme_id, source_application_id
    )
    select gen_random_uuid(), applicant_type, requested_code, display_name,
        contact_name, email, phone, website_url, 'percentage',
        default_purchase_commission_bps, default_purchase_commission_bps,
        default_first_paid_plan_commission_bps, cookie_window_days, payout_mode,
        'active', 'Legacy application enrolled by migration 000145.',
        affiliate_programme_id, affiliate_application_id
    from eligible
    returning affiliate_id, source_application_id, email
), inserted_accounts as (
    insert into affiliate_accounts (
        affiliate_account_id, affiliate_id, email, status, invite_sent_at
    )
    select gen_random_uuid(), affiliate_id, email, 'invited', now()
    from inserted_affiliates
    returning affiliate_id
)
update affiliate_applications application
set status = 'approved', affiliate_id = inserted_affiliates.affiliate_id,
    reviewed_at = now(),
    review_note = 'Automatically enrolled when Xtiitch moved to self-service affiliate signup.',
    metadata = metadata || jsonb_build_object(
        'approval_mode', 'self_service',
        'migration', '000145'
    ),
    updated_at = now()
from inserted_affiliates, inserted_accounts
where application.affiliate_application_id = inserted_affiliates.source_application_id;
