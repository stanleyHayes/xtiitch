-- Self-service password reset for business dashboard logins. A locked-out owner
-- or staff member requests a one-time code emailed to their address, then
-- redeems it to set a new password. Mirrors customer_otp_challenges: short-lived,
-- hashed, attempt-capped codes. This is a global credential store (resolved
-- without a tenant, since a locked-out user has no session), reached with the
-- RLS bypass; Xtiitch still never holds funds.
create table business_password_reset_challenges (
    challenge_id uuid primary key default gen_random_uuid(),
    business_user_id uuid not null references business_users(business_user_id) on delete cascade,
    email text not null,
    code_hash text not null,
    attempts integer not null default 0 check (attempts >= 0),
    consumed_at timestamptz,
    expires_at timestamptz not null,
    created_at timestamptz not null default now(),
    check (expires_at > created_at)
);

create index business_password_reset_challenges_email_idx
    on business_password_reset_challenges (lower(email), created_at desc);

alter table business_password_reset_challenges enable row level security;
alter table business_password_reset_challenges force row level security;

create policy business_password_reset_challenges_bypass on business_password_reset_challenges
    using (current_setting('xtiitch.bypass', true) = 'on')
    with check (current_setting('xtiitch.bypass', true) = 'on');

grant select, insert, update, delete on business_password_reset_challenges to xtiitch_app;
