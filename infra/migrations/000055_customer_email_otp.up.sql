-- Add a second customer sign-in channel: email OTP. WhatsApp phone tokens
-- aren't always available, so a customer can instead claim their global
-- identity by verifying a one-time code emailed to them.
--
-- The OTP-challenge row gains a channel discriminator and an email identifier;
-- phone becomes nullable (email challenges have no phone, and vice versa).

alter table customer_otp_challenges
    add column if not exists channel text not null default 'whatsapp',
    add column if not exists email text;

alter table customer_otp_challenges
    alter column phone drop not null;

-- Lookups resolve the newest active challenge by (channel, identifier). The
-- identifier is phone for whatsapp and email for email, so index both paths.
create index if not exists customer_otp_challenges_channel_email_idx
    on customer_otp_challenges (channel, email, created_at desc);

create index if not exists customer_otp_challenges_channel_phone_idx
    on customer_otp_challenges (channel, phone, created_at desc);
