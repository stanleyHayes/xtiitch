create table admin_role_permissions (
    role text not null check (role in ('owner', 'operator', 'support')),
    permission text not null check (
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
    ),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (role, permission)
);

insert into admin_role_permissions (role, permission)
values
    ('owner', 'manage_admin_users'),
    ('owner', 'manage_roles'),
    ('owner', 'manage_settings'),
    ('owner', 'review_businesses'),
    ('owner', 'manage_money_rails'),
    ('owner', 'manage_risk'),
    ('owner', 'manage_support'),
    ('owner', 'view_audit'),
    ('operator', 'review_businesses'),
    ('operator', 'manage_money_rails'),
    ('operator', 'manage_risk'),
    ('operator', 'manage_support'),
    ('operator', 'view_audit'),
    ('support', 'manage_support'),
    ('support', 'view_audit');

grant select, insert, update, delete on admin_role_permissions to xtiitch_app;
