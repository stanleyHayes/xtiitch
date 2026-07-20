import assert from "node:assert/strict";
import { test } from "node:test";
import {
  analyticsLevel,
  analyticsLookbackDays,
  capabilityLevelName,
  crmLevel,
  exportFormats,
  lookbackLabel,
  planNameForLevel,
  scheduleCadences,
  scheduledReportsLevel,
} from "./entitlements";

test("analyticsLevel clamps to 0..3 and defaults absent rows to basic", () => {
  assert.equal(analyticsLevel(undefined), 0);
  assert.equal(analyticsLevel(null), 0);
  assert.equal(analyticsLevel({}), 0);
  assert.equal(analyticsLevel({ analytics_level: 1 }), 1);
  assert.equal(analyticsLevel({ analytics_level: 2 }), 2);
  assert.equal(analyticsLevel({ analytics_level: 3 }), 3);
  assert.equal(analyticsLevel({ analytics_level: 9 }), 3);
  assert.equal(analyticsLevel({ analytics_level: -1 }), 0);
});

test("crmLevel reads the CRM rung independently of analytics", () => {
  assert.equal(crmLevel(undefined), 0);
  assert.equal(crmLevel({ crm_level: 2 }), 2);
  assert.equal(crmLevel({ analytics_level: 3 }), 0);
});

test("analyticsLookbackDays honours -1 as full history and falls back per level", () => {
  assert.equal(analyticsLookbackDays({ analytics_lookback_days: 30 }), 30);
  assert.equal(analyticsLookbackDays({ analytics_lookback_days: 365 }), 365);
  assert.equal(analyticsLookbackDays({ analytics_lookback_days: -1 }), null);
  // Absent rows fall back to the §14.1 launch defaults by level.
  assert.equal(analyticsLookbackDays({ analytics_level: 0 }), 30);
  assert.equal(analyticsLookbackDays({ analytics_level: 1 }), 365);
  assert.equal(analyticsLookbackDays({ analytics_level: 2 }), null);
  assert.equal(analyticsLookbackDays({ analytics_level: 3 }), null);
});

test("lookbackLabel renders the §14.1 window words", () => {
  assert.equal(lookbackLabel(30), "Last 30 days");
  assert.equal(lookbackLabel(365), "Last 12 months");
  assert.equal(lookbackLabel(null), "Full history");
});

test("scheduledReportsLevel maps 0/1/2 and clamps junk", () => {
  assert.equal(scheduledReportsLevel(undefined), 0);
  assert.equal(scheduledReportsLevel({ scheduled_reports: 0 }), 0);
  assert.equal(scheduledReportsLevel({ scheduled_reports: 1 }), 1);
  assert.equal(scheduledReportsLevel({ scheduled_reports: 2 }), 2);
  assert.equal(scheduledReportsLevel({ scheduled_reports: 7 }), 2);
});

test("scheduleCadences gives monthly-only at 1 and any cadence at 2", () => {
  assert.deepEqual(scheduleCadences(undefined), []);
  assert.deepEqual(scheduleCadences({ scheduled_reports: 1 }), ["monthly"]);
  assert.deepEqual(scheduleCadences({ scheduled_reports: 2 }), [
    "daily",
    "weekly",
    "monthly",
  ]);
});

test("exportFormats ladders on the export_* booleans, cheapest first", () => {
  // Free: no export rows at all — view only (§14.2).
  assert.deepEqual(exportFormats(undefined), []);
  assert.deepEqual(exportFormats({}), []);
  // Starter: CSV.
  assert.deepEqual(exportFormats({ export_csv: true }), ["csv"]);
  // Growth: CSV + PDF.
  assert.deepEqual(exportFormats({ export_csv: true, export_pdf: true }), [
    "csv",
    "pdf",
  ]);
  // Studio: any format.
  assert.deepEqual(
    exportFormats({
      export_csv: true,
      export_pdf: true,
      export_docx: true,
      export_xlsx: true,
    }),
    ["csv", "pdf", "docx", "xlsx"],
  );
  // Order stays csv → xlsx regardless of key order.
  assert.deepEqual(exportFormats({ export_xlsx: true, export_csv: true }), [
    "csv",
    "xlsx",
  ]);
});

test("level naming matches the §13.4 plan words", () => {
  assert.equal(planNameForLevel(0), "Free");
  assert.equal(planNameForLevel(1), "Starter");
  assert.equal(planNameForLevel(2), "Growth");
  assert.equal(planNameForLevel(3), "Studio");
  assert.equal(capabilityLevelName(0), "basic");
  assert.equal(capabilityLevelName(1), "standard");
  assert.equal(capabilityLevelName(2), "full");
  assert.equal(capabilityLevelName(3), "advanced");
});
