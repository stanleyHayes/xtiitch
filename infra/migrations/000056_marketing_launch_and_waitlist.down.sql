drop table if exists waitlist_leads;

alter table admin_platform_settings
    drop column if exists marketing_show_browse_store,
    drop column if exists marketing_show_discover,
    drop column if exists marketing_show_create_store,
    drop column if exists marketing_show_pricing;
