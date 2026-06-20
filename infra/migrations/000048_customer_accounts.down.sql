drop table if exists customer_otp_challenges;

alter table customers
    drop column if exists phone_verified_at;
