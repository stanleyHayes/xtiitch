// Live plan pricing for the marketing pricing table. The figures here must be
// the ones the platform actually charges, so an admin price change is reflected
// on the website without a deploy — the table used to be hardcoded and had
// already drifted (advertised GHS 119/quarter while checkout charged GHS 118).
//
// Imported by the pricing route's loader (server-side), so `process` is guarded
// the same way as the other marketing API helpers.
const readEnv = (key: string): string | undefined =>
  typeof process !== "undefined" ? process.env[key] : undefined;

const API_BASE = readEnv("XTIITCH_API_URL") ?? "http://localhost:8080";

// Minor units (pesewas) as returned by GET /v1/plans.
export type LivePlanPricing = {
  code: string;
  monthlyFeeMinor: number;
  quarterlyFirstMinor: number;
  quarterlyRenewalMinor: number;
  yearlyFirstMinor: number;
  yearlyRenewalMinor: number;
};

type PublicPlanPayload = {
  code?: string;
  monthly_fee_minor?: number;
  quarterly_first_minor?: number;
  quarterly_renewal_minor?: number;
  yearly_first_minor?: number;
  yearly_renewal_minor?: number;
};

function mapPlan(payload: PublicPlanPayload): LivePlanPricing {
  return {
    code: payload.code ?? "",
    monthlyFeeMinor: payload.monthly_fee_minor ?? 0,
    quarterlyFirstMinor: payload.quarterly_first_minor ?? 0,
    quarterlyRenewalMinor: payload.quarterly_renewal_minor ?? 0,
    yearlyFirstMinor: payload.yearly_first_minor ?? 0,
    yearlyRenewalMinor: payload.yearly_renewal_minor ?? 0,
  };
}

// Fails OPEN: an unreachable API must never break the marketing site or blank
// out the pricing table. Callers fall back to the copy's own figures.
export async function loadLivePlanPricing(): Promise<LivePlanPricing[]> {
  try {
    const response = await fetch(`${API_BASE}/v1/plans`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return [];
    }
    const payload = (await response.json()) as PublicPlanPayload[] | null;
    if (!Array.isArray(payload)) {
      return [];
    }
    return payload.filter((plan) => plan.code).map(mapPlan);
  } catch {
    return [];
  }
}

// "GHS 49" / "GHS 1,791" — whole cedis (plan prices are always whole amounts),
// grouped to match the thousands separator the pricing copy already used.
export function formatCedis(minor: number): string {
  return `GHS ${Math.round(minor / 100).toLocaleString("en-US")}`;
}

// Overlay live prices onto the marketing copy. Only the price strings come from
// the API — the summary, badge and feature list stay editorial. A plan the API
// doesn't return (or a zero-priced free plan) keeps the copy's own figures, so
// the table degrades to the static content rather than showing "GHS 0".
export function withLivePricing<T extends { code: string }>(
  plans: T[],
  live: LivePlanPricing[],
): T[] {
  if (live.length === 0) {
    return plans;
  }
  const byCode = new Map(live.map((plan) => [plan.code, plan]));
  return plans.map((plan) => {
    const pricing = byCode.get(plan.code);
    if (!pricing || pricing.monthlyFeeMinor <= 0) {
      return plan;
    }
    return {
      ...plan,
      monthlyPrice: formatCedis(pricing.monthlyFeeMinor),
      quarterlyPrice: `${formatCedis(pricing.quarterlyFirstMinor)} / quarter`,
      yearlyPrice: formatCedis(pricing.yearlyFirstMinor),
    };
  });
}
