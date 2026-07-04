-- WhatsApp one-time-code auth for the business dashboard. Store owners can sign
-- in with their store handle + WhatsApp number + a code, and verify their
-- number at registration. This mirrors the customer OTP flow: a global,
-- bypass-gated challenge store keyed on the WhatsApp number (no FK, so the same
-- table serves both sign-in and pre-registration verification), plus the owner's
-- WhatsApp number on business_users as an alternative login identity that sits
-- alongside the existing email + password (this is additive, not a replacement).

alter table business_users
    add column if not exists whatsapp_number text;
alter table business_users
    add column if not exists whatsapp_verified_at timestamptz;

-- Global uniqueness so a (handle, WhatsApp number) pair resolves exactly one
-- owner at sign-in. Partial (only non-null), so existing rows are unaffected.
create unique index if not exists business_users_whatsapp_unique_idx
    on business_users (whatsapp_number)
    where whatsapp_number is not null;

create table if not exists business_signin_otp_challenges (
    challenge_id uuid primary key default gen_random_uuid(),
    whatsapp_number text not null,
    code_hash text not null,
    attempts integer not null default 0 check (attempts >= 0),
    consumed_at timestamptz,
    expires_at timestamptz not null,
    created_at timestamptz not null default now(),
    check (expires_at > created_at)
);

create index if not exists business_signin_otp_challenges_number_idx
    on business_signin_otp_challenges (whatsapp_number, created_at desc);

-- Global credential store reached with the RLS bypass (sign-in resolves the
-- tenant FROM the handle, so it is inherently cross-tenant), same shape as
-- customer_otp_challenges.
alter table business_signin_otp_challenges enable row level security;
alter table business_signin_otp_challenges force row level security;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where tablename = 'business_signin_otp_challenges'
          and policyname = 'business_signin_otp_challenges_bypass'
    ) then
        create policy business_signin_otp_challenges_bypass on business_signin_otp_challenges
            using (current_setting('xtiitch.bypass', true) = 'on')
            with check (current_setting('xtiitch.bypass', true) = 'on');
    end if;
end $$;

grant select, insert, update, delete on business_signin_otp_challenges to xtiitch_app;
