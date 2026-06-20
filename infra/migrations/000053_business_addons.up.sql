-- Paid add-ons a business buys separately from its plan (e.g. the AI Assistant).
-- Distinct from plans.features so add-ons can be enabled/disabled and billed on
-- their own. One row per (business, addon); `active` gates the entitlement and is
-- flipped by the add-on billing flow.
create table business_addons (
    business_id  uuid not null references businesses(business_id) on delete cascade,
    addon        text not null,
    active       boolean not null default false,
    activated_at timestamptz,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now(),
    primary key (business_id, addon)
);

create index business_addons_active_idx
    on business_addons (business_id, addon)
    where active = true;

-- Tenant-scoped like the rest of a business's rows: visible only within the
-- business's own RLS scope, plus the bypass for admin/billing operations.
alter table business_addons enable row level security;
alter table business_addons force row level security;

create policy business_addons_tenant on business_addons
    using (
        current_setting('xtiitch.bypass', true) = 'on'
        or business_id = current_setting('xtiitch.current_business_id', true)::uuid
    )
    with check (
        current_setting('xtiitch.bypass', true) = 'on'
        or business_id = current_setting('xtiitch.current_business_id', true)::uuid
    );

grant select, insert, update, delete on business_addons to xtiitch_app;
