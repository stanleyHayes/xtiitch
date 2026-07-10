-- Per-design bespoke DISPLAY amount (Xtiitch-Updates §1c "Bespoke display
-- amount").
--
-- A design's bespoke setup already carries a deposit (designs.deposit_override_
-- minor). This adds an indicative/shown price for the custom order — the amount a
-- customer sees for the bespoke design — distinct from the deposit that is
-- actually collected. Stored in GHS pesewas (minor units), defaulting to 0 (unset
-- / not shown).
--
-- designs is a tenant table under FORCE row level security. This is a DDL ALTER
-- only (a new column with a constant default), so it needs no RLS bypass and
-- there is no data-modifying backfill here — every existing row keeps the 0
-- default.
alter table designs
    add column if not exists bespoke_display_minor bigint not null default 0;
