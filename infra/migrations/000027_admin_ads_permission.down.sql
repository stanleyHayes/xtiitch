delete from admin_role_permissions
where permission = 'manage_ads';

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
            'manage_subscriptions',
            'manage_plans',
            'manage_promotions',
            'manage_risk',
            'manage_support',
            'view_audit'
        )
    );
