drop index if exists business_signin_otp_challenges_number_purpose_idx;

alter table business_signin_otp_challenges
    drop column if exists purpose;
