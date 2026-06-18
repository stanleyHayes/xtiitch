create table affiliate_payout_batches (
    payout_batch_id uuid primary key default gen_random_uuid(),
    affiliate_id uuid not null references affiliates (affiliate_id) on delete cascade,
    payout_mode text not null
        check (payout_mode in ('paystack_split', 'paystack_transfer', 'voucher', 'manual')),
    payout_reference text not null default '',
    conversion_count integer not null check (conversion_count > 0),
    gross_minor bigint not null default 0 check (gross_minor > 0),
    commission_minor bigint not null default 0 check (commission_minor > 0),
    status text not null default 'settled'
        check (status in ('settled', 'void')),
    notes text not null default '',
    created_by_admin_user_id uuid references admin_users (admin_user_id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index affiliate_payout_batches_affiliate_idx
    on affiliate_payout_batches (affiliate_id, created_at desc);

alter table affiliate_payout_batches enable row level security;
alter table affiliate_payout_batches force row level security;

create policy affiliate_payout_batches_admin_bypass on affiliate_payout_batches
    using (current_setting('xtiitch.bypass', true) = 'on')
    with check (current_setting('xtiitch.bypass', true) = 'on');

alter table affiliate_conversions
    add column payout_batch_id uuid references affiliate_payout_batches (payout_batch_id) on delete set null;

create index affiliate_conversions_payout_batch_idx
    on affiliate_conversions (payout_batch_id)
    where payout_batch_id is not null;

grant select, insert, update on affiliate_payout_batches to xtiitch_app;
