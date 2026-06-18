alter table promotions
    add column target_collection_id uuid references collections (collection_id) on delete cascade,
    add column target_design_id uuid references designs (design_id) on delete cascade;

alter table promotions
    add constraint promotions_scope_target_check check (
        (scope = 'store' and target_collection_id is null and target_design_id is null)
        or (scope = 'collection' and target_collection_id is not null and target_design_id is null)
        or (scope = 'design' and target_design_id is not null and target_collection_id is null)
    );

create index promotions_collection_target_idx
    on promotions (target_collection_id, status, updated_at desc)
    where target_collection_id is not null;

create index promotions_design_target_idx
    on promotions (target_design_id, status, updated_at desc)
    where target_design_id is not null;
