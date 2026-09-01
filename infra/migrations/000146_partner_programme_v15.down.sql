drop trigger if exists partner_subscription_commission on business_subscription_invoices;
drop function if exists record_partner_subscription_commission();
drop trigger if exists sync_partner_programme_admin_settings on affiliate_programmes;
drop function if exists sync_partner_programme_settings();
drop trigger if exists sync_partner_registration_admin_setting on admin_platform_settings;
drop function if exists sync_partner_registration_setting();
drop trigger if exists park_business_affiliate_programmes on affiliate_programmes;
drop trigger if exists park_business_affiliates on affiliates;
drop function if exists park_merchant_affiliate_programme();
drop function if exists park_merchant_affiliate();

drop table if exists partner_invitations;
drop table if exists partner_milestone_achievements;
drop table if exists partner_milestones;
drop table if exists partner_programme_settings;

drop index if exists affiliate_conversions_subscription_idx;
drop index if exists affiliate_conversions_payment_reference_unique_idx;
alter table affiliate_conversions
    drop constraint if exists affiliate_conversions_conversion_type_check,
    drop constraint if exists affiliate_conversions_typed_reference_check;
update affiliate_conversions
set conversion_type = 'paid_plan_signup'
where conversion_type = 'subscription_payment';
alter table affiliate_conversions
    add constraint affiliate_conversions_conversion_type_check
        check (conversion_type in ('purchase', 'paid_plan_signup'));
alter table affiliate_conversions
    add constraint affiliate_conversions_typed_reference_check check (
        (conversion_type = 'purchase' and order_id is not null
            and subscription_id is null and payment_reference = '')
        or
        (conversion_type = 'paid_plan_signup' and order_id is null
            and subscription_id is not null and payment_reference <> ''
            and programme_owner_type = 'platform' and funding_source = 'platform')
    );
create unique index affiliate_conversions_first_paid_plan_unique_idx
    on affiliate_conversions (subscription_id)
    where conversion_type = 'paid_plan_signup';
create unique index affiliate_conversions_payment_reference_unique_idx
    on affiliate_conversions (payment_reference)
    where conversion_type = 'paid_plan_signup';
