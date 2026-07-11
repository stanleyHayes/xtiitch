

// ============================================================================
// Overview ("Platform pulse") — a real-data snapshot across the admin, business,
// and customer platforms: KPI strip, derived daily time-series, categorical
// breakdowns, operations health, and a merged live-activity feed. No chart
// library is used; charts are hand-built SVG/CSS so they stay on-brand.
// ============================================================================

export const OVERVIEW_DAY_MS = 86_400_000;



export type OverviewDaySeries = { key: number; label: string; value: number };


export type OverviewBar = { label: string; value: number; color: string };
