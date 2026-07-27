// Public checkout-support client: price quotes, post-payment verification
// and referral-code lookup. All endpoints are unauthenticated /public/* under
// the /v1 prefix (see src/api.ts for the base-URL resolution). Contracts
// verified against apps/api/internal/adapters/inbound/http/{checkout,growth}.
import { apiBaseUrl, formatGHS, type ApiResult } from "./api";

// ---- Checkout quote (checkout/handler_quote.go) ----------------------------
// Server-priced breakdown of an order BEFORE placement: fees, tax and the
// real total. The quote cannot price promo/referral codes (the command only
// takes lines + delivery zone) — discounts surface in the placement response.
export type CheckoutQuoteLine = {
  design_handle: string;
  size_band_id?: string;
  kind: "made_to_wear" | "bespoke";
  size_mode?: "self_measure" | "home_visit" | "come_to_shop";
  measurements?: Record<string, string>;
  note?: string;
};

export type CheckoutQuote = {
  currency: "GHS";
  lines: { design_handle: string; kind: string; amount_minor: number }[];
  delivery_fee_minor: number;
  items_total_minor: number;
  vat_rate_bps: number;
  transaction_fee_minor: number;
  tax_minor: number;
  // Controls whether the tax line is shown, even when tax_minor rounds to 0.
  tax_passed_down: boolean;
  total_minor: number;
};

// ---- Payment verification (checkout/handler.go) ----------------------------
// After the shopper returns from the Paystack-hosted page, confirm the charge
// with the store-scoped reference instead of trusting the webhook blindly.
export type PaymentVerification = {
  status: "succeeded" | "pending" | "failed";
};

// ---- Referrals (growth/handler.go) -----------------------------------------
export type ReferralCode = {
  referral_code_id: string;
  business_id: string | null; // null for platform-wide codes
  owner_type: "customer" | "business" | "platform";
  code: string;
  title: string;
  audience: "customers" | "businesses" | "mixed";
  referrer_reward_kind: "voucher" | "commission_rebate" | "none";
  referee_reward_kind: "voucher" | "none";
  reward_type: "percentage" | "fixed";
  // percentage → basis points (≤10000); fixed → minor units.
  reward_value: number;
  max_reward_minor: number | null;
  qualifying_order_min_minor: number;
  starts_at: string | null;
  ends_at: string | null;
  status: string; // treat "active" as usable; flag anything else
};

const enc = encodeURIComponent;

async function postJSON<T>(path: string, input: unknown): Promise<ApiResult<T>> {
  try {
    const response = await fetch(`${apiBaseUrl()}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      const payload = (await response
        .json()
        .catch(() => null)) as { error?: string } | null;
      return {
        ok: false,
        status: response.status,
        error: payload?.error ?? "upstream_error",
      };
    }
    return { ok: true, data: (await response.json()) as T };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : "network_error",
    };
  }
}

export const checkoutSupport = {
  // Always POST — the GET alias decodes a body too and 400s without one.
  quote: (
    storeHandle: string,
    input: { items: CheckoutQuoteLine[]; delivery_zone_id?: string },
  ) =>
    postJSON<CheckoutQuote>(
      `/public/stores/${enc(storeHandle)}/checkout-quote`,
      input,
    ),
  verifyPayment: (storeHandle: string, reference: string) =>
    postJSON<PaymentVerification>(
      `/public/stores/${enc(storeHandle)}/payments/verify`,
      { reference },
    ),
  referral: async (code: string): Promise<ApiResult<ReferralCode>> => {
    try {
      const response = await fetch(
        `${apiBaseUrl()}/public/referrals/${enc(code)}`,
        { headers: { Accept: "application/json" } },
      );
      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          error: response.status === 404 ? "referral_not_found" : "upstream_error",
        };
      }
      return { ok: true, data: (await response.json()) as ReferralCode };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        error: error instanceof Error ? error.message : "network_error",
      };
    }
  },
};

// Human reward label for a validated referral code — the API returns the raw
// reward fields, so the label is composed client-side (mirrors the web
// storefront's rewards.tsx).
export function referralRewardLabel(referral: ReferralCode): string {
  if (referral.referee_reward_kind === "none") {
    return referral.title || "Referral code applied";
  }
  const base =
    referral.reward_type === "percentage"
      ? `${referral.reward_value / 100}% off your order`
      : `${formatGHS(referral.reward_value)} off your order`;
  const cap =
    referral.reward_type === "percentage" && referral.max_reward_minor
      ? ` (up to ${formatGHS(referral.max_reward_minor)})`
      : "";
  const floor = referral.qualifying_order_min_minor
    ? ` on orders over ${formatGHS(referral.qualifying_order_min_minor)}`
    : "";
  return `${base}${cap}${floor}`;
}
