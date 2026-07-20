alter table business_signin_otp_challenges
    drop column if exists verified_at;

alter table business_signin_otp_challenges
    drop constraint if exists business_signin_otp_challenges_purpose_check;
alter table business_signin_otp_challenges
    add constraint business_signin_otp_challenges_purpose_check
    check (purpose in ('signin', 'register', 'payout'));
