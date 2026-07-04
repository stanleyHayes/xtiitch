-- Per-merchant "pass the platform sales fee to the buyer" toggle (Pricing Book
-- §3). Default false: the merchant absorbs the fee, which is the current
-- behaviour and the spec's mandated default (never default to pass-to-buyer).
-- When true, the buyer pays the fee on top of the order total at checkout and
-- the merchant nets the full order value. DDL on a FORCE-RLS table is unaffected
-- by RLS, so no bypass is needed.
alter table store_settings
  add column if not exists fee_pass_to_buyer boolean not null default false;
