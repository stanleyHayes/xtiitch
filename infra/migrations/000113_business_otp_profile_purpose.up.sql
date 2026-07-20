-- Two §8/§9 additions to business_signin_otp_challenges:
--
-- 1. 'profile' purpose. The §9 owner self-service profile flow proves a NEW
--    phone number with an SMS code before it may replace the old one, exactly
--    as at account creation. That proof needs its own purpose: the challenge
--    store is keyed on the number alone, so reusing 'signin'/'payout' would let
--    a code requested for one flow authorise another (see migration 000089).
--    The CHECK is from 000089's inline column constraint, which Postgres named
--    business_signin_otp_challenges_purpose_check.
--
-- 2. verified_at. §8 verifies the phone mid-form ("Verify phone number" button)
--    and submits the registration LATER, without re-asking the code. Consuming
--    the challenge at verify time would make the subsequent register fail; a
--    verified-but-unconsumed marker lets register accept the earlier proof.
--    Register then consumes it, so one verification still creates exactly one
--    account. NULL means "code not yet proven" -- existing rows (5-minute TTL)
--    simply fail closed into a fresh-code request.

alter table business_signin_otp_challenges
    drop constraint if exists business_signin_otp_challenges_purpose_check;
alter table business_signin_otp_challenges
    add constraint business_signin_otp_challenges_purpose_check
    check (purpose in ('signin', 'register', 'payout', 'profile'));

alter table business_signin_otp_challenges
    add column if not exists verified_at timestamptz;
