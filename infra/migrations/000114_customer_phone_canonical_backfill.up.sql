-- §5.3.4 "one customer account, everywhere" — canonical customer phone backfill.
--
-- Bug: guest checkout stored customers.phone as typed (e.g. 0243503670) while
-- the customer OTP login path normalizes to canonical E.164 digits
-- (233243503670) before storing/looking up. One human ended up with TWO
-- customer rows, and orders placed as a guest vanished from the account they
-- saw after OTP login. The application now canonicalizes on every write and
-- lookup (shared common.NormalizeGhanaPhone helper); this migration repairs
-- the rows written before that fix.
--
-- Canonical form: 233XXXXXXXXX (12 digits). The 0XXXXXXXXX local form and the
-- bare 9-digit form both map to it (spaces/dashes/'+' ignored) — exactly the
-- app-side rules. Numbers no form can parse are left untouched (reported by
-- the validation query in the task, not silently rewritten).
--
-- Duplicates: rows whose phones canonicalize to the same value are merged.
-- The first-created row survives (created_at, then customer_id for
-- determinism); every FK-referencing dependent is re-pointed to the survivor
-- and the loser row is deleted. Collision handling on re-pointing:
--   * customer_businesses / business_customer_notes / business_customer_tags
--     are keyed on (business_id, customer_id[, tag]): where the survivor
--     already has the row, the loser's copy is a duplicate and is dropped;
--     the rest are re-pointed.
--   * referrals.referee_customer_id sits under the partial unique index
--     referrals_referee_once_idx (one non-void referral per referee). If the
--     survivor already has a non-void referral, the loser's is the same
--     person referred twice — it is VOIDED (kept for audit, excluded by the
--     index) rather than re-pointed.
--   * orders, order_measurements, bookings, promotion_redemptions,
--     referral_codes.owner_customer_id, referrals.referrer_customer_id and
--     referral_rewards.beneficiary_customer_id carry customer_id in no unique
--     index, so they re-point freely.
-- Erased customers are excluded from merging entirely (their lookups already
-- filter erased_at, and merging a live identity into an erased one would hide
-- it). customers.updated_at is deliberately NOT bumped: this is invisible
-- housekeeping, not a customer edit.
--
-- customer_otp_challenges keys on phone, not customer_id, so there is nothing
-- to re-point — but outstanding challenge rows get the same canonical rewrite
-- so a code requested before deploy still verifies after it.
--
-- FK references verified against information_schema on the e2e database:
-- orders, order_measurements, bookings, promotion_redemptions,
-- customer_businesses, business_customer_notes, business_customer_tags,
-- referral_codes(owner_customer_id), referrals(referrer/referee_customer_id),
-- referral_rewards(beneficiary_customer_id).
--
-- Re-runnable (idempotent): a second run finds no duplicate canonical classes,
-- and the rewrite predicates match only non-canonical phones.
--
-- RLS: every dependent table runs FORCE row-level security, and migrations
-- execute as a non-superuser role on managed Postgres — bypass it for the
-- data-modifying steps, as 000057 does, and restore it at the end.
select set_config('xtiitch.bypass', 'on', false);

-- Session-scoped canonicalizer mirroring common.NormalizeGhanaPhone: returns
-- the 233XXXXXXXXX form, or NULL when no accepted form fits.
create or replace function pg_temp.canonical_ghana_phone(raw text)
returns text
language sql
immutable
as $$
    select case
        when d ~ '^233[0-9]{9}$' then d
        when d ~ '^0[0-9]{9}$' then '233' || substring(d from 2)
        when d ~ '^[0-9]{9}$' then '233' || d
    end
    from (select regexp_replace(coalesce(raw, ''), '\D', '', 'g') as d) s;
$$;

do $$
declare
    m record;
begin
    -- The loser→survivor map is computed ONCE from the pre-merge state (the
    -- loop query opens a cursor), while the per-pair collision checks see the
    -- live state as each pair is merged.
    for m in
        with ranked as (
            select
                customer_id,
                first_value(customer_id) over (
                    partition by canon order by created_at asc, customer_id asc
                ) as survivor_id,
                row_number() over (
                    partition by canon order by created_at asc, customer_id asc
                ) as rn
            from (
                select customer_id, created_at,
                       pg_temp.canonical_ghana_phone(phone) as canon
                from customers
                where phone is not null and erased_at is null
            ) s
            where canon is not null
        )
        select customer_id as loser_id, survivor_id
        from ranked
        where rn > 1
    loop
        -- Free columns: customer_id appears in no unique index on these.
        update orders set customer_id = m.survivor_id
            where customer_id = m.loser_id;
        update order_measurements set customer_id = m.survivor_id
            where customer_id = m.loser_id;
        update bookings set customer_id = m.survivor_id
            where customer_id = m.loser_id;
        update promotion_redemptions set customer_id = m.survivor_id
            where customer_id = m.loser_id;
        update referral_codes set owner_customer_id = m.survivor_id
            where owner_customer_id = m.loser_id;
        update referrals set referrer_customer_id = m.survivor_id
            where referrer_customer_id = m.loser_id;
        update referral_rewards set beneficiary_customer_id = m.survivor_id
            where beneficiary_customer_id = m.loser_id;

        -- Referee-once collision: the survivor already being referred makes
        -- the loser's live referral a same-person duplicate — void it.
        update referrals r
        set status = 'void', updated_at = now()
            where r.referee_customer_id = m.loser_id
              and r.status <> 'void'
              and exists (
                  select 1 from referrals s
                  where s.referee_customer_id = m.survivor_id
                    and s.status <> 'void'
              );
        update referrals set referee_customer_id = m.survivor_id
            where referee_customer_id = m.loser_id;

        -- Junction tables: drop the loser's copies where the survivor already
        -- has the row, then re-point what remains.
        delete from customer_businesses cb
            where cb.customer_id = m.loser_id
              and exists (
                  select 1 from customer_businesses s
                  where s.business_id = cb.business_id
                    and s.customer_id = m.survivor_id
              );
        update customer_businesses set customer_id = m.survivor_id
            where customer_id = m.loser_id;

        delete from business_customer_notes n
            where n.customer_id = m.loser_id
              and exists (
                  select 1 from business_customer_notes s
                  where s.business_id = n.business_id
                    and s.customer_id = m.survivor_id
              );
        update business_customer_notes set customer_id = m.survivor_id
            where customer_id = m.loser_id;

        delete from business_customer_tags t
            where t.customer_id = m.loser_id
              and exists (
                  select 1 from business_customer_tags s
                  where s.business_id = t.business_id
                    and s.tag = t.tag
                    and s.customer_id = m.survivor_id
              );
        update business_customer_tags set customer_id = m.survivor_id
            where customer_id = m.loser_id;

        -- Every dependent now points at the survivor; the loser identity goes.
        delete from customers where customer_id = m.loser_id;
    end loop;
end $$;

-- Singleton rewrites: non-canonical phones with no collision (and every
-- survivor's own phone string) become canonical. Unparseable numbers keep
-- their stored value rather than being guessed at.
update customers
set phone = pg_temp.canonical_ghana_phone(phone)
where pg_temp.canonical_ghana_phone(phone) is not null
  and phone is distinct from pg_temp.canonical_ghana_phone(phone);

update customer_otp_challenges
set phone = pg_temp.canonical_ghana_phone(phone)
where phone is not null
  and pg_temp.canonical_ghana_phone(phone) is not null
  and phone <> pg_temp.canonical_ghana_phone(phone);

drop function if exists pg_temp.canonical_ghana_phone(text);

select set_config('xtiitch.bypass', 'off', false);
