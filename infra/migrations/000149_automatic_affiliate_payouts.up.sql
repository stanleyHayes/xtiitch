alter table affiliate_payout_batches
  drop constraint affiliate_payout_batches_status_check;

alter table affiliate_payout_batches
  add column provider_recipient_ref text not null default '',
  add column provider_transfer_code text not null default '',
  add column failure_reason text not null default '',
  add column attempted_at timestamptz,
  add column completed_at timestamptz,
  add constraint affiliate_payout_batches_status_check
    check (status in ('processing', 'pending', 'settled', 'failed', 'reversed', 'void'));

create unique index affiliate_payout_batches_provider_reference_unique
  on affiliate_payout_batches (payout_reference)
  where payout_reference like 'affiliate-%';
create index affiliate_payout_batches_automatic_claim_idx
  on affiliate_payout_batches (status, attempted_at);
