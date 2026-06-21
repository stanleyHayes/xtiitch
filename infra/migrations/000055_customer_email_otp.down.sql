drop index if exists customer_otp_challenges_channel_phone_idx;
drop index if exists customer_otp_challenges_channel_email_idx;

-- Restore phone as required. Any email-only challenges (no phone) are stale
-- one-time codes, so it is safe to drop them before re-adding the constraint.
delete from customer_otp_challenges where phone is null;

alter table customer_otp_challenges
    alter column phone set not null;

alter table customer_otp_challenges
    drop column if exists email,
    drop column if exists channel;
