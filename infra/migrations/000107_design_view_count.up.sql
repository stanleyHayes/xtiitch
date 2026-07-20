-- §14.1 "Design performance (views, view→order conversion, waiting-list
-- demand)". The platform tracked no design views at all, so conversion had no
-- numerator's denominator. This is the cheapest honest counter: one bigint on
-- the design, bumped by the public single-design read
-- (GET /public/designs/{handle} → catalogue GetStoreDesign). It is a
-- cumulative, all-time counter — analytics reads it verbatim and never derives
-- anything from it.
ALTER TABLE designs
  ADD COLUMN view_count bigint NOT NULL DEFAULT 0
    CONSTRAINT designs_view_count_nonnegative CHECK (view_count >= 0);

COMMENT ON COLUMN designs.view_count IS
  'Cumulative public storefront detail-page views (§14.1 design performance). Bumped best-effort on each public design read; never decremented.';
