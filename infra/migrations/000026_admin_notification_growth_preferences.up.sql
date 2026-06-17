alter table admin_operator_preferences
    add column if not exists alert_subscriptions boolean not null default true,
    add column if not exists alert_promotions boolean not null default true;
