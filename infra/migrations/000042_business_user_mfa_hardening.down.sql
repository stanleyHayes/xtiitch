alter table business_user_mfa
    drop column if exists last_used_step,
    drop column if exists failed_attempts,
    drop column if exists locked_until;
