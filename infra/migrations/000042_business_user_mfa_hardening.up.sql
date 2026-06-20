-- MFA hardening: prevent TOTP code replay (RFC 6238 §5.2) by tracking the
-- highest accepted step, and add a per-account attempt lockout to bound
-- brute-force on the verify/activate endpoints.

alter table business_user_mfa
    add column if not exists last_used_step bigint not null default 0,
    add column if not exists failed_attempts integer not null default 0
        check (failed_attempts >= 0),
    add column if not exists locked_until timestamptz;
