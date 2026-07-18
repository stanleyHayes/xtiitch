-- The admin console used to scale percentage discount values x100 on write --
-- "20%" was stored as discount_value 2000 -- while everything downstream reads
-- the column as whole percent (valid range 1-100; the column is discount_value,
-- not discount_value_bps). A stored 2000 percent off clamps to the full
-- renewal: every percentage code written that way gave the plan away free.
--
-- Divide every out-of-range percentage value back down. Integer division is
-- exact here: the old console only ever produced multiples of 100, so nothing
-- is rounded away. Values already in range (<= 100) and the fixed/free_period
-- types are untouched.
--
-- subscription_discount_codes carries no row-level security (000067 enables it
-- only on subscription_discount_redemptions), so no tenant bypass is needed.
--
-- Self-heal for a database that marked 000067 applied without its effects (a
-- forced version skip): recreate the discount schema as 000067 wrote it.
-- Idempotent everywhere -- tables, indexes, and grants already exist on a
-- healthy database, and the policy drop+create is a no-op rewrite -- so this
-- only repairs databases where 000067 was skipped. (The entitlements tables
-- from the same migration get the same treatment in 000088.)
create table if not exists subscription_discount_codes (
    discount_code_id uuid primary key default gen_random_uuid(),
    code text not null unique,
    discount_type text not null
        check (discount_type in ('free_period', 'percentage', 'fixed')),
    discount_value integer not null check (discount_value > 0),
    eligible_plans text[] not null default '{}'::text[],
    eligible_cadences text[] not null default '{}'::text[],
    first_purchase_only boolean not null default true,
    max_redemptions_total integer check (max_redemptions_total is null or max_redemptions_total > 0),
    max_per_account integer not null default 1 check (max_per_account > 0),
    valid_from timestamptz,
    valid_until timestamptz,
    active boolean not null default true,
    owner_name text not null default '',
    batch_label text not null default '',
    stackable boolean not null default false,
    created_by_admin_user_id uuid references admin_users(admin_user_id) on delete set null,
    updated_by_admin_user_id uuid references admin_users(admin_user_id) on delete set null,
    archived_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (code = upper(code)),
    check (code ~ '^[A-Z0-9][A-Z0-9_-]{1,30}[A-Z0-9]$'),
    check (valid_until is null or valid_from is null or valid_until > valid_from)
);

create index if not exists subscription_discount_codes_active_idx
    on subscription_discount_codes (active, valid_from, valid_until);

create index if not exists subscription_discount_codes_owner_idx
    on subscription_discount_codes (owner_name, batch_label, created_at desc);

create table if not exists subscription_discount_redemptions (
    redemption_id uuid primary key default gen_random_uuid(),
    discount_code_id uuid not null references subscription_discount_codes(discount_code_id) on delete cascade,
    business_id uuid not null references businesses(business_id) on delete cascade,
    subscription_id uuid references business_subscriptions(subscription_id) on delete set null,
    invoice_id uuid references business_subscription_invoices(invoice_id) on delete set null,
    account_key text not null default '',
    plan_code text not null default '',
    cadence text not null default '',
    discount_minor bigint not null default 0 check (discount_minor >= 0),
    status text not null default 'pending'
        check (status in ('pending', 'applied', 'void', 'expired')),
    created_at timestamptz not null default now(),
    applied_at timestamptz,
    updated_at timestamptz not null default now()
);

create index if not exists subscription_discount_redemptions_code_idx
    on subscription_discount_redemptions (discount_code_id, status, created_at desc);

create index if not exists subscription_discount_redemptions_business_idx
    on subscription_discount_redemptions (business_id, created_at desc);

create index if not exists subscription_discount_redemptions_account_idx
    on subscription_discount_redemptions (discount_code_id, account_key);

alter table subscription_discount_redemptions enable row level security;
alter table subscription_discount_redemptions force row level security;

drop policy if exists subscription_discount_redemptions_tenant_isolation on subscription_discount_redemptions;
create policy subscription_discount_redemptions_tenant_isolation
    on subscription_discount_redemptions
    using (
        current_setting('xtiitch.bypass', true) = 'on'
        or business_id = nullif(current_setting('xtiitch.current_business_id', true), '')::uuid
    )
    with check (
        current_setting('xtiitch.bypass', true) = 'on'
        or business_id = nullif(current_setting('xtiitch.current_business_id', true), '')::uuid
    );

grant select, insert, update on subscription_discount_codes, subscription_discount_redemptions to xtiitch_app;

update subscription_discount_codes
set discount_value = discount_value / 100, updated_at = now()
where discount_type = 'percentage' and discount_value > 100;
