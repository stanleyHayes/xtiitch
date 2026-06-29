-- Wave 2: enforce unique display-order positions for collections and size bands.
--
-- The previous build let an owner reuse the same order number (and most rows
-- defaulted to sequence 0), so existing data almost certainly contains
-- duplicates. A unique index would fail to build over that data, so we first
-- renumber each business's items to a clean 1..N — preserving their current
-- relative order (by sequence, then creation time) — and only then add the
-- uniqueness guard. The application also auto-assigns the next free position
-- when an owner leaves the order blank.

-- Migrations run as a NON-SUPERUSER role on managed Postgres (e.g. Render), and
-- collections/size_bands have FORCE row-level security. Without bypassing RLS the
-- renumber UPDATEs below would match ZERO rows (the role can't see tenant rows),
-- leaving duplicates in place so the unique index then fails to build. Turn on the
-- app's RLS bypass (session-level, so it persists across the statements in this
-- migration) for the data-modifying steps, and turn it back off at the end.
select set_config('xtiitch.bypass', 'on', false);

-- Renumber EVERY non-deleted row to its rank (no "only if changed" guard): this
-- guarantees the post-update set has unique (business_id, sequence) so the index
-- below always builds, and it is safely re-runnable (idempotent) if a prior
-- attempt left the migration dirty.
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
where c.collection_id = r.collection_id;

create unique index if not exists collections_business_sequence_active_idx
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
where s.size_band_id = r.size_band_id;

create unique index if not exists size_bands_business_sequence_idx
  on size_bands (business_id, sequence);

select set_config('xtiitch.bypass', 'off', false);
