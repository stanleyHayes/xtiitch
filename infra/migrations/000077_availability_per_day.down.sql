DROP TABLE IF EXISTS availability_blackouts;

ALTER TABLE availability_windows DROP CONSTRAINT IF EXISTS availability_windows_specific_date_check;

-- Restore the pre-000077 recurrence check (without 'date'). Any 'date' rows must
-- be gone for this to hold; the down path is for local reversal only.
ALTER TABLE availability_windows DROP CONSTRAINT IF EXISTS availability_windows_recurrence_check;
ALTER TABLE availability_windows
  ADD CONSTRAINT availability_windows_recurrence_check
  CHECK (recurrence IN ('daily', 'weekly', 'monthly', 'ongoing'));

ALTER TABLE availability_windows DROP COLUMN IF EXISTS specific_date;
