import { apiFetch } from "../../lib/auth";
import type { DashboardActionData } from "../shared/types";

const affiliateIntents = new Set([
  "create_affiliate_programme",
  "update_affiliate_programme",
  "create_business_affiliate",
  "update_business_affiliate",
  "pause_business_affiliate",
]);

export async function handleAffiliateActions(
  request: Request,
  form: FormData,
  intent: string,
): Promise<DashboardActionData | null> {
  if (!affiliateIntents.has(intent)) {
    return null;
  }
  const programmeID = text(form, "affiliate_programme_id");
  const affiliateID = text(form, "affiliate_id");
  let path = "/business/affiliate-programmes";
  let method = "POST";
  let body: string | undefined;

  if (intent === "create_affiliate_programme") {
    body = JSON.stringify(programmePayload(form));
  } else if (intent === "update_affiliate_programme") {
    path += `/${encodeURIComponent(programmeID)}`;
    method = "PATCH";
    body = JSON.stringify(programmePayload(form));
  } else if (intent === "create_business_affiliate") {
    path = "/business/affiliates";
    body = JSON.stringify(affiliatePayload(form));
  } else if (intent === "update_business_affiliate") {
    path = `/business/affiliates/${encodeURIComponent(affiliateID)}`;
    method = "PATCH";
    body = JSON.stringify(affiliatePayload(form));
  } else {
    path = `/business/affiliates/${encodeURIComponent(affiliateID)}/pause`;
    body = undefined;
  }

  const response = await apiFetch(request, path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body,
  });
  if (!response.ok) {
    return {
      affiliateError:
        response.status === 403
          ? "Only the business owner or an admin can manage affiliates."
          : response.status === 400
            ? "Check the programme, rates, code, and target before saving."
            : "Affiliate settings could not be saved right now.",
    };
  }
  return {
    affiliateSuccess:
      intent === "pause_business_affiliate"
        ? "Affiliate paused."
        : "Affiliate programme settings saved.",
  };
}

function programmePayload(form: FormData) {
  return {
    name: text(form, "name"),
    description: text(form, "description"),
    status: text(form, "status") || "active",
    default_purchase_commission_bps: percentBPS(
      form,
      "purchase_commission",
    ),
    default_first_paid_plan_commission_bps: percentBPS(
      form,
      "paid_plan_commission",
    ),
    cookie_window_days: integer(form, "cookie_window_days", 30),
    hold_days: integer(form, "hold_days", 14),
    payout_mode: text(form, "payout_mode") || "manual",
    minimum_payout_minor: moneyMinor(form, "minimum_payout"),
    allowed_target_scope: text(form, "allowed_target_scope") || "store",
  };
}

function affiliatePayload(form: FormData) {
  const targetRefID = text(form, "target_ref_id");
  return {
    affiliate_programme_id: text(form, "affiliate_programme_id"),
    code: text(form, "code"),
    display_name: text(form, "display_name"),
    contact_name: text(form, "contact_name"),
    email: text(form, "email"),
    phone: text(form, "phone"),
    purchase_commission_bps: percentBPS(form, "purchase_commission"),
    first_paid_plan_commission_bps: percentBPS(
      form,
      "paid_plan_commission",
    ),
    cookie_window_days: integer(form, "cookie_window_days", 30),
    status: text(form, "status") || "active",
    target_scope: text(form, "target_scope") || "store",
    target_ref_id: targetRefID || null,
  };
}

function text(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function integer(form: FormData, key: string, fallback: number): number {
  const value = Number(form.get(key));
  return Number.isInteger(value) ? value : fallback;
}

function percentBPS(form: FormData, key: string): number {
  return Math.round(Number(form.get(key) ?? 0) * 100);
}

function moneyMinor(form: FormData, key: string): number {
  return Math.round(Number(form.get(key) ?? 0) * 100);
}
