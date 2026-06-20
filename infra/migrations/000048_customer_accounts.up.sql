-- Lightweight customer accounts. A customer claims their global identity by
-- verifying a one-time code sent to their phone, and receives a customer
-- session. This unblocks paid customer features (AI search) and identified
-- WhatsApp/bot interactions. Customers remain a global identity (no business_id);
-- Xtiitch still never holds funds.

create table customer_otp_challenges (
    challenge_id uuid primary key default gen_random_uuid(),
    phone text not null,
    code_hash text not null,
    attempts integer not null default 0 check (attempts >= 0),
    consumed_at timestamptz,
    expires_at timestamptz not null,
    created_at timestamptz not null default now(),
    check (expires_at > created_at)
);

create index customer_otp_challenges_phone_idx
    on customer_otp_challenges (phone, created_at desc);

-- Records when a customer last proved control of their phone number.
alter table customers
    add column if not exists phone_verified_at timestamptz;

-- The OTP table is a global credential store (like `customers`), reached with
-- the RLS bypass; keep it bypass-gated and grant the app role.
alter table customer_otp_challenges enable row level security;
alter table customer_otp_challenges force row level security;

create policy customer_otp_challenges_bypass on customer_otp_challenges
    using (current_setting('xtiitch.bypass', true) = 'on')
    with check (current_setting('xtiitch.bypass', true) = 'on');

grant select, insert, update, delete on customer_otp_challenges to xtiitch_app;
