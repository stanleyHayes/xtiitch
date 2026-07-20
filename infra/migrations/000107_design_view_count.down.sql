-- Revert 000107: drop the §14.1 design view counter.
ALTER TABLE designs DROP COLUMN IF EXISTS view_count;
