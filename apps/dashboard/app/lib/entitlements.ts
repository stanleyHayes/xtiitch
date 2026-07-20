// §14.1/§15.1 plan-gating helpers. The plan matrix exposes NUMERIC entitlement
// rows on the profile as `entitlement_limits` (map[string]int; -1 = unlimited,
// absent = disabled/conservative default). These helpers are the ONLY place the
// dashboard interprets those numbers, so an admin tuning the matrix changes the
// dashboard without a deploy (§14.5/§15.3 "Admin-configurable").
//
// Kept pure and Profile-free so the node:test suite can exercise them directly.

export type EntitlementLimits = Record<string, number> | null | undefined;

// analytics_level / crm_level rungs (§14.5/§15.3 naming: Free = basic,
// Starter = standard, Growth = full, Studio = advanced).
export type CapabilityLevel = 0 | 1 | 2 | 3;

export const EXPORT_FORMATS = ["csv", "pdf", "docx", "xlsx"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const EXPORT_FORMAT_LABELS: Record<ExportFormat, string> = {
  csv: "CSV",
  pdf: "PDF",
  docx: "DOCX (Word)",
  xlsx: "XLSX (Excel)",
};

function numericLimit(
  limits: EntitlementLimits,
  key: string,
  fallback: number,
): number {
  const value = limits?.[key];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function clampLevel(value: number): CapabilityLevel {
  if (value <= 0) {
    return 0;
  }
  if (value >= 3) {
    return 3;
  }
  return Math.floor(value) as CapabilityLevel;
}

// The plan's analytics rung. An absent row reads as basic (0) — the API makes
// the same conservative choice, so loader and UI never disagree.
export function analyticsLevel(limits: EntitlementLimits): CapabilityLevel {
  return clampLevel(numericLimit(limits, "analytics_level", 0));
}

// The plan's CRM rung (§15.1). Absent reads as basic (0).
export function crmLevel(limits: EntitlementLimits): CapabilityLevel {
  return clampLevel(numericLimit(limits, "crm_level", 0));
}

// §14.1 "History lookback": days of history the plan can see, or null for
// full history. The matrix encodes -1 as unlimited; an absent row falls back
// to the launch defaults (Free 30 days, Starter 12 months, Growth+ full) so an
// older API response still gets a sensible label.
export function analyticsLookbackDays(
  limits: EntitlementLimits,
): number | null {
  const raw = numericLimit(limits, "analytics_lookback_days", Number.NaN);
  if (Number.isNaN(raw)) {
    const level = analyticsLevel(limits);
    if (level <= 0) {
      return 30;
    }
    if (level === 1) {
      return 365;
    }
    return null;
  }
  return raw < 0 ? null : raw;
}

// Human label for the lookback window, used on the totals panel so every plan
// can see the window its totals cover (§14.1 "display the window").
export function lookbackLabel(days: number | null): string {
  if (days === null) {
    return "Full history";
  }
  if (days >= 360) {
    // 365-day Starter lookback reads as "12 months", not "Last 365 days".
    const months = Math.round(days / 30);
    return `Last ${months} months`;
  }
  return `Last ${days} days`;
}

// §14.1 "Scheduled / auto-generated reports": 0 = off, 1 = monthly only,
// 2 = any cadence. Absent reads as off.
export function scheduledReportsLevel(limits: EntitlementLimits): 0 | 1 | 2 {
  const raw = numericLimit(limits, "scheduled_reports", 0);
  if (raw >= 2) {
    return 2;
  }
  return raw === 1 ? 1 : 0;
}

// The cadence choices the plan may pick in the schedule form.
export function scheduleCadences(limits: EntitlementLimits): string[] {
  const level = scheduledReportsLevel(limits);
  if (level === 2) {
    return ["daily", "weekly", "monthly"];
  }
  if (level === 1) {
    return ["monthly"];
  }
  return [];
}

// §14.3/§14.4: the export formats the plan's boolean matrix rows switch on
// (Starter = CSV, Growth = CSV + PDF, Studio = all). Ordered csv → xlsx so the
// UI ladder reads cheapest-first. Free gets none — view-only (§14.2).
export function exportFormats(
  entitlements: Record<string, boolean> | null | undefined,
): ExportFormat[] {
  return EXPORT_FORMATS.filter(
    (format) => entitlements?.[`export_${format}`] === true,
  );
}

// The §13.4 tier word for a rung — used in upgrade nudges ("…on Starter").
export function planNameForLevel(level: CapabilityLevel): string {
  switch (level) {
    case 1:
      return "Starter";
    case 2:
      return "Growth";
    case 3:
      return "Studio";
    default:
      return "Free";
  }
}

// The matrix's own level word (basic/standard/full/advanced), for copy that
// mirrors the admin feature matrix (§14.5 "Entitlements naming").
export function capabilityLevelName(level: CapabilityLevel): string {
  switch (level) {
    case 1:
      return "standard";
    case 2:
      return "full";
    case 3:
      return "advanced";
    default:
      return "basic";
  }
}
