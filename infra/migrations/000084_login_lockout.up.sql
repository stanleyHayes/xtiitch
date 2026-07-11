-- Failed-password-login throttling for business + admin accounts. Password login
-- previously had no per-account lockout (only a generous per-IP limiter), so a
-- distributed/proxied attacker was effectively unthrottled. These columns back a
-- lockout after N consecutive failures, mirroring the MFA verify lockout.
alter table business_users
    add column failed_login_attempts integer not null default 0,
    add column login_locked_until timestamptz;

alter table admin_users
    add column failed_login_attempts integer not null default 0,
    add column login_locked_until timestamptz;
