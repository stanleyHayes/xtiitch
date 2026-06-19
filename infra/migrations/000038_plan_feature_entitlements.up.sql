-- Plan feature entitlements + storefront customization fields.
--
-- `plans.features` is the source of truth for which plan grants which
-- storefront-customization feature. Keys are the canonical feature codes defined
-- in apps/api/internal/domain/business (custom_brand_color, custom_logo,
-- custom_banner, custom_layout). The store_settings columns hold the business's
-- chosen customization, only honoured when the plan grants the matching feature.

alter table plans
    add column if not exists features jsonb not null default '{}'::jsonb;

alter table store_settings
    add column if not exists logo_url text,
    add column if not exists banner_url text,
    add column if not exists layout_variant text not null default 'standard'
        check (layout_variant in ('standard', 'spotlight', 'minimal'));

-- Seed defaults: free unlocks nothing, standard unlocks the accent colour, growth
-- unlocks the full customization set. Admin can re-map any feature afterwards.
update plans
set features = '{"custom_brand_color": true}'::jsonb
where code = 'standard';

update plans
set features = '{"custom_brand_color": true, "custom_logo": true, "custom_banner": true, "custom_layout": true, "design_waitlist": true}'::jsonb
where code = 'growth';
