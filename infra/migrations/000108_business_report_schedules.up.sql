-- §14.1 "Scheduled / auto-generated reports (emailed)": Growth = monthly,
-- Studio = any cadence. This table holds each business's ONE report schedule
-- config (the dashboard exposes GET/PUT /v1/reports/schedule as a single
-- document, so one row per business, keyed by business_id). The API's
-- reports service finds due rows (DueReportSchedules) and generates +
-- emails them (POST /v1/admin/reports/run-scheduled); last_sent_at is the
-- idempotency/cadence marker the due-check measures from.
--
-- Gating is NOT enforced here: cadence/format/kind allowances come from the
-- plan entitlement matrix (scheduled_reports 0=off 1=monthly 2=any; export_*
-- booleans; analytics_level for the 'full' suite) and are checked by the
-- application on every write AND again at generation time (a plan change must
-- never leave a stale schedule running).

CREATE TABLE business_report_schedules (
  business_id uuid PRIMARY KEY REFERENCES businesses (business_id) ON DELETE CASCADE,
  -- Which report the schedule sends (§14.3/§14.1 export rows).
  report_kind text NOT NULL CHECK (report_kind IN ('financial', 'sales', 'full')),
  -- File format; must be one of the registered report writers. Whether the
  -- business's plan may use it is a matrix entitlement (§14.4), checked live.
  format text NOT NULL CHECK (format IN ('csv', 'pdf', 'docx', 'xlsx')),
  -- 'monthly' is the Growth cadence; 'weekly'/'daily' are Studio's "any
  -- cadence" (§14.1). The matrix check (scheduled_reports 1 vs 2) lives in
  -- the application.
  cadence text NOT NULL CHECK (cadence IN ('daily', 'weekly', 'monthly')),
  -- Delivery address for the emailed report.
  email text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  -- When the schedule last fired (NULL = never → due immediately). The due
  -- check is last_sent_at + cadence interval <= now.
  last_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tenant isolation under the project's hardened RLS shape (bypass-clause +
-- FORCE), copied from 000012_notifications: the owner reads/writes their own
-- row under tenant scope; the admin run-scheduled sweep reads across tenants
-- under the bypass (like the outbox transport).
DO $$
DECLARE
  tenant_table text;
  policy_using text := '(current_setting(''xtiitch.bypass'', true) = ''on'''
    || ' OR business_id = NULLIF(current_setting(''xtiitch.current_business_id'', true), '''')::uuid)';
BEGIN
  FOREACH tenant_table IN ARRAY ARRAY['business_report_schedules'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING %s WITH CHECK %s',
      tenant_table || '_tenant_isolation', tenant_table, policy_using, policy_using
    );
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON business_report_schedules TO xtiitch_app;
