drop table if exists subscription_reminders;

alter table business_subscriptions
    drop column if exists provider_channel;
