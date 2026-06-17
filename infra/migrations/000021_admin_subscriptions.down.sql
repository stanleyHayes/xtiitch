delete from admin_role_permissions
where permission = 'manage_subscriptions';

alter table admin_role_permissions
    drop constraint if exists admin_role_permissions_permission_check;

alter table admin_role_permissions
    add constraint admin_role_permissions_permission_check
    check (
        permission in (
            'manage_admin_users',
            'manage_roles',
            'manage_settings',
            'review_businesses',
            'manage_money_rails',
            'manage_risk',
            'manage_support',
            'view_audit'
        )
    );

drop index if exists business_subscription_events_subscription_idx;
drop index if exists business_subscription_events_business_idx;
drop index if exists business_subscriptions_next_billing_idx;
drop index if exists business_subscriptions_plan_idx;
drop index if exists business_subscriptions_status_idx;

drop table if exists business_subscription_events;
drop table if exists business_subscriptions;
