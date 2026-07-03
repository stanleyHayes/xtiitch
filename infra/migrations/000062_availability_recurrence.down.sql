ALTER TABLE availability_windows
  DROP CONSTRAINT IF EXISTS availability_windows_recurrence_check;

ALTER TABLE availability_windows
  DROP CONSTRAINT IF EXISTS availability_windows_day_of_month_check;

ALTER TABLE availability_windows
  DROP COLUMN IF EXISTS day_of_month;

ALTER TABLE availability_windows
  DROP COLUMN IF EXISTS recurrence;
