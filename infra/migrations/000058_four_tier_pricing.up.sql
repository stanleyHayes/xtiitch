-- Wave 3: adopt the four-tier pricing model (Free / Starter / Growth / Studio)
-- from the agreed pricing sheet (Xtiitch-Pricing-Section.pdf).
--
-- Plan rows are updated IN PLACE — plan_id is stable — so every business keeps
-- its existing plan link; only codes, names, prices, design limits and feature
-- sets change. The old 'standard' tier is renamed to 'starter'.

-- Free now includes online selling (card & mobile-money checkout) per the new
-- pricing — the free tier is no longer catalogue-only.
update plans
set features = features || '{"online_ordering": true}'::jsonb,
    updated_at = now()
where code = 'free';

-- Standard -> Starter: GHS 49 / month (GHS 441 / year), up to ~50 designs.
update plans
set code = 'starter',
    name = 'Starter — Start Selling',
    monthly_fee_minor = 4900,
    yearly_fee_minor = 44100,
    design_limit = 50,
    is_active = true,
    updated_at = now()
where code = 'standard';

-- Growth: GHS 99 / month (GHS 891 / year), unlimited designs.
update plans
set name = 'Growth — Run the Business',
    monthly_fee_minor = 9900,
    yearly_fee_minor = 89100,
    design_limit = null,
    is_active = true,
    updated_at = now()
where code = 'growth';

-- Studio: new top tier, GHS 199 / month (GHS 1,791 / year), unlimited designs,
-- the full storefront-customization feature set (same entitlements as Growth).
insert into plans (
  code, name, monthly_fee_minor, yearly_fee_minor, commission_bps,
  design_limit, features, is_active
)
values (
  'studio', 'Studio — Scale Up', 19900, 179100, 50, null,
  '{"custom_brand_color": true, "custom_logo": true, "custom_banner": true, "custom_layout": true, "design_waitlist": true, "online_ordering": true}'::jsonb,
  true
)
on conflict (code) do update set
  name = excluded.name,
  monthly_fee_minor = excluded.monthly_fee_minor,
  yearly_fee_minor = excluded.yearly_fee_minor,
  commission_bps = excluded.commission_bps,
  design_limit = excluded.design_limit,
  features = excluded.features,
  is_active = true,
  updated_at = now();
