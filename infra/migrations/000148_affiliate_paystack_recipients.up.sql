alter table affiliate_payout_profiles
    add column provider_recipient_ref text not null default '';

create unique index affiliate_payout_profiles_recipient_unique_idx
    on affiliate_payout_profiles (provider_recipient_ref)
    where provider_recipient_ref <> '';
