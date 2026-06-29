-- Wave 2: enforce unique display-order positions for collections and size bands.
--
-- The previous build let an owner reuse the same order number (and most rows
-- defaulted to sequence 0), so existing data almost certainly contains
-- duplicates. A unique index would fail to build over that data, so we first
-- renumber each business's items to a clean 1..N — preserving their current
-- relative order (by sequence, then creation time) — and only then add the
-- uniqueness guard. The application also auto-assigns the next free position
-- when an owner leaves the order blank.

with ranked as (
  select collection_id,
         row_number() over (
           partition by business_id
           order by sequence, created_at, collection_id
         ) as rn
  from collections
  where status <> 'deleted'
)
update collections c
set sequence = r.rn, updated_at = now()
from ranked r
where c.collection_id = r.collection_id
  and c.sequence <> r.rn;

create unique index collections_business_sequence_active_idx
  on collections (business_id, sequence)
  where status <> 'deleted';

with ranked as (
  select size_band_id,
         row_number() over (
           partition by business_id
           order by sequence, created_at, size_band_id
         ) as rn
  from size_bands
)
update size_bands s
set sequence = r.rn, updated_at = now()
from ranked r
where s.size_band_id = r.size_band_id
  and s.sequence <> r.rn;

create unique index size_bands_business_sequence_idx
  on size_bands (business_id, sequence);
