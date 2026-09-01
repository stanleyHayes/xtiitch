drop index if exists affiliate_payout_profiles_recipient_unique_idx;

alter table affiliate_payout_profiles
    drop column if exists provider_recipient_ref;
