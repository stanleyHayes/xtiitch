alter table business_users
    drop column if exists failed_login_attempts,
    drop column if exists login_locked_until;

alter table admin_users
    drop column if exists failed_login_attempts,
    drop column if exists login_locked_until;
