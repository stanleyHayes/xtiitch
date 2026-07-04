-- Revert to the pre-Pricing-Book commission rates (Starter 1.0%, Growth 0.5%).
update plans set commission_bps = 100, updated_at = now() where code = 'starter';
update plans set commission_bps = 50, updated_at = now() where code = 'growth';
