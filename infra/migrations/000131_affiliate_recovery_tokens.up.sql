create table if not exists affiliate_recovery_tokens (
    affiliate_recovery_token_id uuid primary key,
    affiliate_account_id uuid not null references affiliate_accounts(affiliate_account_id) on delete cascade,
    token_hash text not null,
    expires_at timestamptz not null,
    consumed_at timestamptz,
    created_at timestamptz not null default now(),
    constraint affiliate_recovery_tokens_token_hash_unique unique (token_hash),
    constraint affiliate_recovery_tokens_expiry_check check (expires_at > created_at)
);

create index if not exists affiliate_recovery_tokens_account_active_idx
    on affiliate_recovery_tokens (affiliate_account_id, expires_at desc)
    where consumed_at is null;

alter table affiliate_recovery_tokens enable row level security;
alter table affiliate_recovery_tokens force row level security;

drop policy if exists affiliate_recovery_tokens_service_bypass on affiliate_recovery_tokens;
create policy affiliate_recovery_tokens_service_bypass
    on affiliate_recovery_tokens
    for all
    using (current_setting('xtiitch.bypass', true) = 'on')
    with check (current_setting('xtiitch.bypass', true) = 'on');
