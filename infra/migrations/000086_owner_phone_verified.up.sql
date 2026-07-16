-- The store owner's PHONE is the OTP-verified number used for SMS notifications;
-- the WhatsApp number is for owner<->customer chat and is not an identity we
-- prove at signup. Signup previously verified the WhatsApp number instead, so
-- there was nowhere to record that the phone had been proven.
--
-- Nullable: existing owners were never phone-verified, and the phone stays
-- optional at signup, so NULL simply means "not proven".
alter table business_users
  add column if not exists phone_verified_at timestamptz;
