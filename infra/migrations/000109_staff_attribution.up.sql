-- §14.1 "Staff/team analytics (performance & activity by staff member)" —
-- Studio only. No staff-attributable columns existed anywhere: orders and
-- manual_takings recorded WHAT happened but never WHO (on the business side)
-- did it. These two nullable columns close exactly that gap for the two
-- staff-performed writes that exist today:
--   * orders.created_by_business_user_id — set by the walk-in order paths
--     (POST /v1/orders, POST /v1/orders/custom). Online customer checkouts
--     leave it NULL: no staff member acted.
--   * manual_takings.logged_by_business_user_id — set by POST /v1/money/takings.
-- Historical rows stay NULL and surface as "unattributed" in staff analytics;
-- the columns are deliberately not backfilled (we cannot invent attribution).
-- ON DELETE SET NULL: removing a team member must never cascade-delete their
-- orders or takings.

ALTER TABLE orders
  ADD COLUMN created_by_business_user_id uuid
    REFERENCES business_users (business_user_id) ON DELETE SET NULL;

COMMENT ON COLUMN orders.created_by_business_user_id IS
  'Staff member who logged the order in person (walk-in paths only; §14.1 team analytics). NULL for online customer checkouts and pre-000109 rows.';

ALTER TABLE manual_takings
  ADD COLUMN logged_by_business_user_id uuid
    REFERENCES business_users (business_user_id) ON DELETE SET NULL;

COMMENT ON COLUMN manual_takings.logged_by_business_user_id IS
  'Staff member who logged the off-platform taking (§14.1 team analytics). NULL for pre-000109 rows.';
