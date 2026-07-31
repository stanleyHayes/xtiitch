drop trigger if exists affiliate_notification_preferences_audit
    on affiliate_notification_preferences;
drop trigger if exists affiliate_payout_profile_audit
    on affiliate_payout_profiles;
drop trigger if exists affiliate_campaign_link_audit
    on affiliate_campaign_links;
drop trigger if exists affiliate_conversion_reversal_risk
    on affiliate_conversions;
drop trigger if exists affiliate_signup_self_referral_risk
    on affiliate_signups;
drop trigger if exists affiliate_click_velocity_risk
    on affiliate_clicks;

drop function if exists audit_affiliate_portal_mutation();
drop function if exists flag_affiliate_reversal_velocity();
drop function if exists flag_affiliate_self_referral();
drop function if exists flag_affiliate_click_velocity();

drop table if exists affiliate_portal_audit_events;
drop table if exists affiliate_risk_events;
