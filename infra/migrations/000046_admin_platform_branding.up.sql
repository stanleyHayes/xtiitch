-- Configurable platform brand logo, owner-managed from the admin console and
-- served publicly so every surface (admin, marketing, dashboard, storefront)
-- can render the same mark. Empty string means "fall back to the built-in mark".
alter table admin_platform_settings
    add column brand_logo_url text not null default '';
