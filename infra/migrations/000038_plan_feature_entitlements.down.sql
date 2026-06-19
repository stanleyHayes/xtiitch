alter table store_settings
    drop column if exists layout_variant,
    drop column if exists banner_url,
    drop column if exists logo_url;

alter table plans
    drop column if exists features;
