-- Per-day availability (Xtiitch-Updates §11). Two additive capabilities on top
-- of the existing recurring windows (daily/weekly/monthly/ongoing):
--
--   1. Day-by-day hours: a 'date' recurrence window bound to one calendar date
--      (specific_date), so an owner can open hours for a single day.
--   2. Mark a day unavailable: a blackout date that subtracts a whole day from
--      availability even when a recurring window would otherwise generate slots.
--
-- The ADD COLUMN / constraint work is pure DDL (unaffected by RLS). The new
-- availability_blackouts table is tenant-scoped and joins the project's hardened
-- FORCE row-level security, mirroring migration 000075.

ALTER TABLE availability_windows
  ADD COLUMN IF NOT EXISTS specific_date date;

-- Extend the recurrence check to allow 'date', and require specific_date for it.
-- Guarded so re-running (or a partial apply) does not error on a duplicate.
DO $$
BEGIN
  ALTER TABLE availability_windows DROP CONSTRAINT IF EXISTS availability_windows_recurrence_check;
  ALTER TABLE availability_windows
    ADD CONSTRAINT availability_windows_recurrence_check
    CHECK (recurrence IN ('daily', 'weekly', 'monthly', 'ongoing', 'date'));

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'availability_windows_specific_date_check'
  ) THEN
    ALTER TABLE availability_windows
      ADD CONSTRAINT availability_windows_specific_date_check
      CHECK (recurrence <> 'date' OR specific_date IS NOT NULL);
  END IF;
END $$;

-- The unique (business_id, blackout_date) constraint's index also serves the
-- range lookup in ListBlackouts, so no extra index is needed.
CREATE TABLE IF NOT EXISTS availability_blackouts (
  blackout_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses (business_id) ON DELETE CASCADE,
  blackout_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT availability_blackouts_business_date_unique UNIQUE (business_id, blackout_date)
);

-- Tenant isolation under the project's hardened RLS shape (bypass-clause +
-- FORCE), mirroring migration 000075's design_variations block. The policy
-- creation is guarded so this migration is idempotent (safe to re-run).
DO $$
DECLARE
    tenant_table text;
    policy_using text := '(current_setting(''xtiitch.bypass'', true) = ''on'''
        || ' OR business_id = NULLIF(current_setting(''xtiitch.current_business_id'', true), '''')::uuid)';
BEGIN
    FOREACH tenant_table IN ARRAY ARRAY['availability_blackouts'] LOOP
        EXECUTE format('alter table %I enable row level security', tenant_table);
        EXECUTE format('alter table %I force row level security', tenant_table);
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = tenant_table AND policyname = tenant_table || '_tenant_isolation'
        ) THEN
            EXECUTE format(
                'create policy %I on %I using %s with check %s',
                tenant_table || '_tenant_isolation', tenant_table, policy_using, policy_using
            );
        END IF;
    END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON availability_blackouts TO xtiitch_app;
