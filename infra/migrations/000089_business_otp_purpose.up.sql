-- The challenge store is keyed on the number alone, so a code issued for one
-- flow satisfies any other flow for the same number: a code the owner requested
-- to sign in also authorises a change of payout destination, and vice versa.
-- That turns "read me the code you just got" into a payout-redirection attack,
-- because the code the caller is asked for is one they genuinely requested for a
-- reason they recognise.
--
-- purpose scopes each challenge to the flow that issued it.
--
-- Defaulting existing rows to 'signin' rather than backfilling per flow: a
-- challenge lives 5 minutes, so the only rows here at deploy are in-flight ones.
-- Mislabelling a handful of registration codes for that window fails CLOSED --
-- the owner is asked for a fresh code -- whereas a permissive default would
-- carry the collision forward forever.
--
-- Matches migration 000055's `channel` discriminator on customer_otp_challenges.
alter table business_signin_otp_challenges
    add column if not exists purpose text not null default 'signin'
    check (purpose in ('signin', 'register', 'payout'));

-- The lookup filters (whatsapp_number, purpose) and takes the newest live row.
create index if not exists business_signin_otp_challenges_number_purpose_idx
    on business_signin_otp_challenges (whatsapp_number, purpose, created_at desc);
