-- Align the platform sales-fee commission with the Xtiitch Pricing Book:
-- Starter 1.5% (150 bps) and Growth 1.0% (100 bps). Free (300 bps / 3.0%) and
-- Studio (50 bps / 0.5%) already match the book. `plans` is a global,
-- non-tenant table (no RLS), so a plain UPDATE applies.
update plans set commission_bps = 150, updated_at = now() where code = 'starter';
update plans set commission_bps = 100, updated_at = now() where code = 'growth';
