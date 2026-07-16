-- Payout details currently survive only inside Paystack. The settlement network
-- (MTN / VOD / ATL) is validated, POSTed to Paystack as the subaccount's
-- settlement_bank, and then not mirrored locally -- so the dashboard cannot tell
-- an owner which network their payouts settle to without asking Paystack.
-- settlement_bank is that local mirror, for display and re-derivation.
--
-- settlement_momo_verified_at records WHEN the owner proved, by OTP to the
-- number itself, that the payout number is live and theirs. The verification is
-- evidence for payment disputes ("the owner verified their own number"), so it
-- has to outlive the request that produced it -- a transient check would satisfy
-- the gate and lose the evidence.
--
-- Both nullable: every business verified before this migration settled without
-- either fact recorded, and neither is recoverable from our own data (the
-- network was never stored; the number was never OTP-proven). NULL means "not
-- known", not "not set" -- backfilling would require re-reading Paystack's
-- GET /subaccount, and inventing a verification timestamp would forge the very
-- evidence the column exists to hold.
alter table businesses
  add column if not exists settlement_bank text;

alter table businesses
  add column if not exists settlement_momo_verified_at timestamptz;
