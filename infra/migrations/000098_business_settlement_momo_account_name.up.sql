-- §2.1: the MoMo payout block collects the REGISTERED WALLET NAME -- "the exact
-- legal name that pops up when someone tries to send money to this MoMo number"
-- -- alongside the network (settlement_bank, 000087) and the number
-- (settlement_mobile_money_number). It is mirrored locally for the same reason
-- settlement_bank is: the dashboard shows the owner what is on file, and it is
-- the name Xtiitch sets as the Paystack subaccount's business_name when the
-- subaccount is created or re-pointed (§4.8), because settlement resolves
-- against the wallet's registered name, not the shop's trading name.
--
-- Nullable: businesses provisioned before this column settled without it, and
-- the name is not recoverable from our own data. NULL means "not known", not
-- "not set"; the owner's first payout-details resubmit backfills it (the same
-- fall-through-and-backfill pattern settlement_bank used in 000087), and code
-- that needs a name before then falls back to the business's trading name.
alter table businesses
  add column if not exists settlement_momo_account_name text;
