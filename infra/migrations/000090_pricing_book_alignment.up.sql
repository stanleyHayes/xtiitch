-- Aligns the seeded entitlements with the Pricing Book (the authoritative spec).
-- Three divergences, all seeded long before the caps were enforced, which is why
-- none of them bit until enforcement landed in 000088.
--
-- 1. STAFF SEATS. Book §5 / checklist §9: "Free owner-only / Starter 2 /
--    Growth 5 / Studio 10 + roles", counted INCLUDING the owner. The seeded
--    values said Starter 1 and Growth 3, so every Starter merchant would be
--    refused their second seat and Growth their fourth -- seats those plans are
--    sold with. Free (1 = owner only) and Studio (10) already matched.
update plans set staff_limit = 2 where code = 'starter';
update plans set staff_limit = 5 where code = 'growth';

update plan_entitlement_values v
set limit_value = 2, updated_at = now()
from plans p
where p.plan_id = v.plan_id and v.feature_key = 'staff_accounts' and p.code = 'starter';

update plan_entitlement_values v
set limit_value = 5, updated_at = now()
from plans p
where p.plan_id = v.plan_id and v.feature_key = 'staff_accounts' and p.code = 'growth';

-- 2. ORDERS AND CUSTOMERS ARE UNCAPPED ON EVERY TIER, INCLUDING FREE.
--    Book rule 4, §5 and checklist §8 are unusually emphatic: "Never block or
--    throttle an order, on any plan, including Free", because every sale earns a
--    per-design fee -- capping orders caps Xtiitch's own revenue, breaks
--    multi-store baskets, and refuses a customer's payment. Customer and
--    measurement records are uncapped for the same reason: "a capped customer
--    count is an order cap in disguise".
--
--    The seed carried Free 30 / Starter 200 orders and Free 25 / Starter 250
--    customers. Nothing enforced them, so no merchant was ever blocked -- but
--    they sat in the admin matrix as editable caps for something the spec forbids
--    capping, one click away from breaking a hard rule.
update plan_entitlement_values
set limit_value = null, updated_at = now()
where feature_key in ('orders_per_month', 'customer_records');

-- Customers: retire the row outright. There is no tier on which this may ever be
-- a number, so leaving an editable field invites someone to set one.
update plan_entitlement_features
set is_active = false, updated_at = now()
where feature_key = 'customer_records';

-- 3. ORDERS: keep the row, but as what the book actually sanctions -- an
--    INTERNAL volume alert, "monitoring... it must never notify, throttle, or
--    limit the merchant" (§5). It is no longer an entitlement: it grants and
--    withholds nothing, it only tells the Xtiitch team when a store's volume is
--    worth a look. Relabelled so nobody reads it as a cap.
update plan_entitlement_features
set label = 'Order volume review threshold',
    description = 'INTERNAL monitoring only: flags the store for the team''s risk queue once monthly orders exceed this. Never caps, blocks, throttles, or notifies the merchant -- orders are unlimited on every plan. Blank = never flag.',
    category = 'Internal',
    unit = 'orders/month',
    updated_at = now()
where feature_key = 'orders_per_month';

-- The threshold the risk queue reads. Nullable: blank means never flag, which is
-- right for the paid tiers where high volume is the expected outcome.
alter table plans add column if not exists order_review_threshold integer
    check (order_review_threshold is null or order_review_threshold >= 0);

-- Seed from the numbers that were sitting in the matrix as caps. As a fraud
-- signal on a Free store they are a reasonable starting point, and the team can
-- retune them from the matrix without a deploy. Paid tiers get no threshold:
-- volume there is the business working, not a signal.
update plans set order_review_threshold = 30 where code = 'free' and order_review_threshold is null;
update plans set order_review_threshold = 200 where code = 'starter' and order_review_threshold is null;

update plan_entitlement_values v
set limit_value = p.order_review_threshold, enabled = true, updated_at = now()
from plans p
where p.plan_id = v.plan_id and v.feature_key = 'orders_per_month';

-- 4. THE BADGE. Book §5 makes it a tier differentiator (Free on; Starter, Growth
--    and Studio off), and it is now built and read from plans.features.
--
--    plans.features is only rewritten when an admin SAVES the entitlements
--    matrix, so adding a key to the mirror's allowlist does not retrofit it onto
--    existing plans: every paid plan would keep showing the badge it pays to
--    remove until somebody happened to open the matrix and press save. The seeded
--    truth is already in plan_entitlement_values, so project it across once here.
--
--    Mirrors the projection's own shape: only granted keys are present in the
--    jsonb, so a withheld one is removed rather than stored false.
update plans p
set features = case
        when coalesce(v.enabled, false)
            then coalesce(p.features, '{}'::jsonb) || jsonb_build_object('remove_powered_by_badge', true)
        else coalesce(p.features, '{}'::jsonb) - 'remove_powered_by_badge'
    end,
    updated_at = now()
from plan_entitlement_values v
where v.plan_id = p.plan_id
  and v.feature_key = 'remove_powered_by_badge';

-- 5. Both keys are now genuinely live -- the badge is gated on and the threshold
--    is read by the risk queue -- so the matrix should stop labelling them
--    "Not enforced yet".
update plan_entitlement_features
set enforced = true, updated_at = now()
where feature_key in ('remove_powered_by_badge', 'orders_per_month');
