drop index if exists promotions_design_target_idx;
drop index if exists promotions_collection_target_idx;
alter table promotions drop constraint if exists promotions_scope_target_check;
alter table promotions
    drop column if exists target_design_id,
    drop column if exists target_collection_id;
