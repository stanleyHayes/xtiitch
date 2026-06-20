-- Semantic-search embeddings for designs (AI natural-language search). Stored as
-- a float array so it works on the stock Postgres image; pgvector + an ANN index
-- is the production-scale upgrade (swap real[] -> vector, add an index). One row
-- per design; content_hash guards against re-embedding unchanged text.

create table design_embeddings (
    design_id uuid primary key references designs (design_id) on delete cascade,
    business_id uuid not null references businesses (business_id) on delete cascade,
    content_hash text not null,
    embedding real[] not null,
    model text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index design_embeddings_business_idx on design_embeddings (business_id);

alter table design_embeddings enable row level security;
alter table design_embeddings force row level security;

create policy design_embeddings_tenant_isolation on design_embeddings
    using (
        current_setting('xtiitch.bypass', true) = 'on'
        or business_id = nullif(current_setting('xtiitch.current_business_id', true), '')::uuid
    )
    with check (
        current_setting('xtiitch.bypass', true) = 'on'
        or business_id = nullif(current_setting('xtiitch.current_business_id', true), '')::uuid
    );

grant select, insert, update, delete on design_embeddings to xtiitch_app;
