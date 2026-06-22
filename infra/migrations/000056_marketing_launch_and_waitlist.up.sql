-- Marketing launch flags + waitlist capture.
--
-- 1. Per-feature marketing launch flags live on the single-row platform settings
--    table (admin_platform_settings), so an owner can reveal each not-yet-launched
--    marketing surface from the admin console without a redeploy. All default
--    false, hiding every gated surface during the pre-launch / waitlist period.
--
-- 2. waitlist_leads stores every lead the public marketing site captures. It is
--    platform-level (not tenant-scoped), so it follows the admin_platform_settings
--    convention: no row-level security, just a grant to the app role.

alter table admin_platform_settings
    add column marketing_show_browse_store boolean not null default false,
    add column marketing_show_discover boolean not null default false,
    add column marketing_show_create_store boolean not null default false,
    add column marketing_show_pricing boolean not null default false;

create table waitlist_leads (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    business text not null,
    phone text not null,
    email text not null default '',
    city text not null default '',
    message text not null default '',
    source text not null default '',
    user_agent text not null default '',
    created_at timestamptz not null default now()
);

create index waitlist_leads_created_at_idx
    on waitlist_leads (created_at desc);

grant select, insert, update, delete on waitlist_leads to xtiitch_app;
