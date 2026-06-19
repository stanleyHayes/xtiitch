-- Design waiting lists. Customers register interest in a specific design from the
-- public storefront; the business reviews the list from the dashboard. Gated by the
-- `design_waitlist` plan benefit (enforced in the application layer).

create table design_waitlist_entries (
    entry_id uuid primary key default gen_random_uuid(),
    business_id uuid not null references businesses (business_id) on delete cascade,
    design_id uuid not null references designs (design_id) on delete cascade,
    customer_name text not null,
    customer_contact text not null,
    note text not null default '',
    status text not null default 'waiting'
        check (status in ('waiting', 'notified', 'closed')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index design_waitlist_entries_business_idx
    on design_waitlist_entries (business_id, status, created_at desc);

create index design_waitlist_entries_design_idx
    on design_waitlist_entries (design_id);

-- One active interest per contact per design (case-insensitive on the contact).
create unique index design_waitlist_entries_unique_idx
    on design_waitlist_entries (design_id, lower(customer_contact));

alter table design_waitlist_entries enable row level security;
alter table design_waitlist_entries force row level security;

create policy design_waitlist_entries_tenant_isolation on design_waitlist_entries
    using (
        current_setting('xtiitch.bypass', true) = 'on'
        or business_id = nullif(current_setting('xtiitch.current_business_id', true), '')::uuid
    )
    with check (
        current_setting('xtiitch.bypass', true) = 'on'
        or business_id = nullif(current_setting('xtiitch.current_business_id', true), '')::uuid
    );

grant select, insert, update, delete on design_waitlist_entries to xtiitch_app;
