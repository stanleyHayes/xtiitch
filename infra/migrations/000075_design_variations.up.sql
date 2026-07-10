-- Colour variations per design (Xtiitch-Updates §1b "Colour variations — NEW").
--
-- A design has colour variations: each variation is a colour NAME plus an
-- ordered list of images. The design itself is the implicit default (first)
-- variation, so stored rows here only ADD colour-labelled image sets; they share
-- the design's price and order flow. Plan caps on the number of variations
-- (counting the default) and the free-plan image cap are enforced in the
-- application's catalogue repository, not by the schema.
--
-- design_variations is a tenant-scoped table under the project's hardened FORCE
-- row-level security. This is pure DDL — no backfill and no RLS bypass block is
-- needed.
create table if not exists design_variations (
    variation_id uuid primary key default gen_random_uuid(),
    design_id uuid not null references designs (design_id) on delete cascade,
    business_id uuid not null references businesses (business_id) on delete cascade,
    name text not null,
    images text[] not null default '{}',
    is_default boolean not null default false,
    sequence integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index design_variations_design_sequence_idx
    on design_variations (design_id, sequence);

-- Tenant isolation under the project's hardened RLS shape (bypass-clause +
-- FORCE), mirroring migration 000070's subscription_reminders block.
do $$
declare
    tenant_table text;
    policy_using text := '(current_setting(''xtiitch.bypass'', true) = ''on'''
        || ' OR business_id = NULLIF(current_setting(''xtiitch.current_business_id'', true), '''')::uuid)';
begin
    foreach tenant_table in array array['design_variations'] loop
        execute format('alter table %I enable row level security', tenant_table);
        execute format('alter table %I force row level security', tenant_table);
        execute format(
            'create policy %I on %I using %s with check %s',
            tenant_table || '_tenant_isolation', tenant_table, policy_using, policy_using
        );
    end loop;
end $$;

grant select, insert, update, delete on design_variations to xtiitch_app;
