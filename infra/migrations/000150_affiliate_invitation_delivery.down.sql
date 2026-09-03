drop index if exists partner_invitations_pending_email_unique_idx;
alter table partner_invitations drop constraint if exists partner_invitations_acceptance_check;
update partner_invitations set accepted_at=null where accepted_affiliate_id is null;
alter table partner_invitations
  add constraint partner_invitations_check
  check (accepted_at is null or accepted_affiliate_id is not null);
