-- Note: this only drops the uniqueness guards. The up migration's one-time
-- renumber of collections/size_bands sequences is not reversed (the pre-migration
-- values are not retained), so display order stays at the compacted 1..N. This is
-- intentional — the old duplicate/zero sequences were the bug being fixed.
drop index if exists collections_business_sequence_active_idx;
drop index if exists size_bands_business_sequence_idx;
