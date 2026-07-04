drop table if exists business_signin_otp_challenges;
drop index if exists business_users_whatsapp_unique_idx;
alter table business_users drop column if exists whatsapp_verified_at;
alter table business_users drop column if exists whatsapp_number;
