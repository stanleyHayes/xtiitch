create table admin_operator_preferences (
    admin_user_id uuid primary key references admin_users(admin_user_id) on delete cascade,
    timezone text not null default 'Africa/Accra',
    phone_number text not null default '',
    notify_email boolean not null default true,
    notify_sms boolean not null default false,
    alert_verifications boolean not null default true,
    alert_money_rails boolean not null default true,
    alert_risk boolean not null default true,
    alert_support boolean not null default true,
    daily_digest_time text not null default '08:00',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (timezone <> ''),
    check (daily_digest_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);

create table admin_platform_settings (
    settings_id boolean primary key default true check (settings_id),
    platform_name text not null default 'Xtiitch',
    support_email text not null default 'support@xtiitch.com',
    verification_sla_hours integer not null default 24 check (verification_sla_hours between 1 and 168),
    payout_review_threshold_pesewas integer not null default 500000 check (payout_review_threshold_pesewas >= 0),
    maintenance_mode boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

insert into admin_platform_settings (settings_id)
values (true)
on conflict (settings_id) do nothing;

grant select, insert, update, delete on admin_operator_preferences, admin_platform_settings to xtiitch_app;
