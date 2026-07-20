import { crmLevel } from "../../lib/entitlements";
import { loadDashboardJSON } from "../shared/api";
import { normaliseDateInput, parseOptionalMoneyMinor } from "../shared/utils";
import { DASHBOARD_PAGE_SIZE } from "../shared/constants";
import type { Profile } from "../shared/types";
import {
  defaultCrmData,
  type CrmCustomerList,
  type CrmData,
  type CrmInsights,
  type CrmQuery,
} from "./types";

// §15.1: the list is on EVERY plan; search ladders in at Starter, the filters
// (tag / segment / min spend / last-order date) at Growth. The loader only
// forwards the params the plan's crm_level entitles it to — the API 403s
// (crm_not_entitled) anything above the rung, and a hand-edited URL must not
// be able to trip that.

function parseQuery(
  level: number,
  searchParams: URLSearchParams,
): CrmQuery {
  const rawPage = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const q = level >= 1 ? (searchParams.get("q") ?? "").trim() : "";
  if (level < 2) {
    return {
      q,
      tag: "",
      segment: "",
      minSpendGhs: "",
      lastOrderBefore: "",
      page,
    };
  }
  const segment = (searchParams.get("segment") ?? "").trim();
  return {
    q,
    tag: (searchParams.get("tag") ?? "").trim(),
    segment: ["new", "returning", "lapsed"].includes(segment) ? segment : "",
    minSpendGhs: (searchParams.get("min_spend") ?? "").trim(),
    lastOrderBefore:
      normaliseDateInput(searchParams.get("last_order_before") ?? "") ?? "",
    page,
  };
}

export async function loadCrmData({
  request,
  profile,
  searchParams,
}: {
  request: Request;
  profile: Profile;
  searchParams: URLSearchParams;
}): Promise<{ data: CrmData; warnings: string[] }> {
  const level = crmLevel(profile.entitlement_limits);
  const query = parseQuery(level, searchParams);
  const warnings: string[] = [];

  const params = new URLSearchParams();
  params.set("limit", String(DASHBOARD_PAGE_SIZE));
  params.set("offset", String((query.page - 1) * DASHBOARD_PAGE_SIZE));
  if (query.q) {
    params.set("q", query.q);
  }
  if (query.tag) {
    params.set("tag", query.tag);
  }
  if (query.segment) {
    params.set("segment", query.segment);
  }
  if (query.minSpendGhs) {
    // The owner enters GHS; the API filters on pesewas (min_spend_minor).
    const minSpendMinor = parseOptionalMoneyMinor(query.minSpendGhs);
    if (minSpendMinor !== null && minSpendMinor > 0) {
      params.set("min_spend_minor", String(minSpendMinor));
    }
  }
  if (query.lastOrderBefore) {
    params.set("last_order_before", query.lastOrderBefore);
  }

  const listPromise = loadDashboardJSON<CrmCustomerList>(
    request,
    `/crm/customers?${params.toString()}`,
    defaultCrmData.list,
    "Customers could not be loaded right now.",
  );
  // §15.1 Growth "New vs returning + last-seen / lapsed view" — only fetched
  // when entitled.
  const insightsPromise =
    level >= 2
      ? loadDashboardJSON<CrmInsights | null>(
          request,
          "/crm/customers/insights",
          null,
          "Customer insights could not be loaded right now.",
        )
      : null;

  const [listResult, insightsResult] = await Promise.all([
    listPromise,
    insightsPromise,
  ]);
  if (listResult.warning) {
    warnings.push(listResult.warning);
  }
  if (insightsResult?.warning) {
    warnings.push(insightsResult.warning);
  }

  return {
    data: {
      list: listResult.data,
      insights: insightsResult?.data ?? null,
      query,
    },
    warnings,
  };
}
