alter table admin_operator_preferences
    drop column if exists alert_promotions,
    drop column if exists alert_subscriptions;
