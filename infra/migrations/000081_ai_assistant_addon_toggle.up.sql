-- Platform-level master switch for the paid AI writing add-on. When off, the
-- add-on cannot be purchased or renewed anywhere, regardless of whether an AI
-- provider key is configured — an admin override on top of the capability gate.
-- Defaults true so existing behaviour (sellable wherever the AI is configured)
-- is unchanged; an operator flips it off from the admin platform settings.
alter table admin_platform_settings
    add column ai_assistant_addon_enabled boolean not null default true;
