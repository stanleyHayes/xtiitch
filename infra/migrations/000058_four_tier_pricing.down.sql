-- Revert the four-tier pricing model back to free / standard / growth.

-- Move any Studio businesses back to Growth before removing the tier, so the
-- delete cannot fail on the businesses.plan_id foreign key.
update businesses
set plan_id = (select plan_id from plans where code = 'growth')
where plan_id = (select plan_id from plans where code = 'studio');

delete from plans where code = 'studio';

update plans
set code = 'standard',
    name = 'Standard',
    monthly_fee_minor = 5000,
    yearly_fee_minor = 50000,
    design_limit = null,
    updated_at = now()
where code = 'starter';

update plans
set name = 'Growth',
    monthly_fee_minor = 12000,
    yearly_fee_minor = 120000,
    design_limit = null,
    updated_at = now()
where code = 'growth';

update plans
set features = features - 'online_ordering',
    updated_at = now()
where code = 'free';
