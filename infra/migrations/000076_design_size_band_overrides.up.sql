-- Per-design size-band overrides (Xtiitch-Updates §1a/§6 "Size Bands").
--
-- The owner defines master size bands + charts once on the Size Bands page. This
-- table lets a SINGLE design override, for one of those bands, the band's LABEL
-- and/or its size-chart measurement values — without touching the master band or
-- any other design that uses it. Each column is nullable so an override may carry
-- just a label, just a chart, or both; a NULL column inherits the master's value.
-- The design read resolves the EFFECTIVE label/chart (override if present, else
-- master) in the application layer.
--
-- One override row at most per (design, size band): unique (design_id,
-- size_band_id). Both design and business FKs cascade on delete, and the band FK
-- cascades so removing a master band clears its per-design overrides too.
create table if not exists design_size_band_overrides (
    override_id uuid primary key default gen_random_uuid(),
    design_id uuid not null references designs (design_id) on delete cascade,
    business_id uuid not null references businesses (business_id) on delete cascade,
    size_band_id uuid not null references size_bands (size_band_id) on delete cascade,
    -- label: NULL inherits the master band's label; a non-NULL value overrides it
    -- for this design only.
    label text,
    -- chart: NULL inherits the master band's chart; a non-NULL jsonb document
    -- (same {"items":[...]} shape as size_bands.chart, '{}' when emptied)
    -- overrides the measurement values for this design only.
    chart jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (design_id, size_band_id)
);

create index if not exists design_size_band_overrides_design_idx
    on design_size_band_overrides (design_id);

-- Tenant isolation under the project's hardened RLS shape (bypass-clause +
-- FORCE), mirroring migration 000070's subscription_reminders block. The policy
-- creation is guarded so this migration is idempotent (safe to re-run).
do $$
declare
    tenant_table text;
    policy_using text := '(current_setting(''xtiitch.bypass'', true) = ''on'''
        || ' OR business_id = NULLIF(current_setting(''xtiitch.current_business_id'', true), '''')::uuid)';
begin
    foreach tenant_table in array array['design_size_band_overrides'] loop
        execute format('alter table %I enable row level security', tenant_table);
        execute format('alter table %I force row level security', tenant_table);
        if not exists (
            select 1 from pg_policies
            where tablename = tenant_table and policyname = tenant_table || '_tenant_isolation'
        ) then
            execute format(
                'create policy %I on %I using %s with check %s',
                tenant_table || '_tenant_isolation', tenant_table, policy_using, policy_using
            );
        end if;
    end loop;
end $$;

grant select, insert, update, delete on design_size_band_overrides to xtiitch_app;
