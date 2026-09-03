-- One pending invitation per inviter/email keeps retries auditable without
-- allowing duplicate rows from repeated clicks or delivery retries.
alter table partner_invitations drop constraint if exists partner_invitations_check;
alter table partner_invitations
  add constraint partner_invitations_acceptance_check
  check (accepted_affiliate_id is null or accepted_at is not null);

delete from partner_invitations older
using partner_invitations newer
where older.inviter_affiliate_id = newer.inviter_affiliate_id
  and lower(older.invitee_email) = lower(newer.invitee_email)
  and older.accepted_at is null
  and newer.accepted_at is null
  and older.created_at < newer.created_at;

create unique index partner_invitations_pending_email_unique_idx
  on partner_invitations (inviter_affiliate_id, lower(invitee_email))
  where accepted_at is null;
