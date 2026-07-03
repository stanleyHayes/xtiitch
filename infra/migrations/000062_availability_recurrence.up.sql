-- Home-visit availability windows were weekly-only. This adds a recurrence mode
-- so an owner can also publish daily, monthly, or open-ended ("ongoing")
-- windows (Technical Specification 4.12 extension). Existing rows default to
-- 'weekly', so their behaviour is unchanged. DDL is unaffected by RLS, so no
-- bypass is needed here; the ADD COLUMN IF NOT EXISTS clauses keep it idempotent.

ALTER TABLE availability_windows
  ADD COLUMN IF NOT EXISTS recurrence text NOT NULL DEFAULT 'weekly';

ALTER TABLE availability_windows
  ADD COLUMN IF NOT EXISTS day_of_month integer;

-- Allowed recurrence values, added guardedly so re-running the migration (or
-- running it after a partial apply) does not error on a duplicate constraint.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'availability_windows_recurrence_check'
  ) THEN
    ALTER TABLE availability_windows
      ADD CONSTRAINT availability_windows_recurrence_check
      CHECK (recurrence IN ('daily', 'weekly', 'monthly', 'ongoing'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'availability_windows_day_of_month_check'
  ) THEN
    ALTER TABLE availability_windows
      ADD CONSTRAINT availability_windows_day_of_month_check
      CHECK (day_of_month IS NULL OR day_of_month BETWEEN 1 AND 31);
  END IF;
END $$;
