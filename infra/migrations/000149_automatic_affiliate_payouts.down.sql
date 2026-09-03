drop index if exists affiliate_payout_batches_automatic_claim_idx;
drop index if exists affiliate_payout_batches_provider_reference_unique;
update affiliate_payout_batches set status = 'void' where status <> 'settled' and status <> 'void';
alter table affiliate_payout_batches drop constraint affiliate_payout_batches_status_check;
alter table affiliate_payout_batches
  drop column provider_recipient_ref,
  drop column provider_transfer_code,
  drop column failure_reason,
  drop column attempted_at,
  drop column completed_at,
  add constraint affiliate_payout_batches_status_check check (status in ('settled', 'void'));
