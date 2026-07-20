import { requestJSON } from "./utils";

// §11.5 Payouts CRM: one row per store, with every figure mirrored from
// Paystack (the source of truth) by the API — the console never computes
// payout amounts locally. All money fields are minor units (pesewas).
export type AdminPayoutRow = {
  businessId: string;
  businessName: string;
  handle: string;
  ownerLegalName: string;
  momoNetwork: string;
  momoNumber: string;
  momoAccountName: string;
  subaccountCode: string;
  totalSalesMinor: number;
  totalSettledMinor: number;
  xtiitchFeesMinor: number;
  xtiitchTaxMinor: number;
  amountDueMinor: number;
  lastPayoutAt: string;
  lastPayoutStatus: string;
};

export type AdminPayoutHistoryEntry = {
  settlementId: string;
  reference: string;
  amountMinor: number;
  status: string;
  settledAt: string;
  createdAt: string;
};

type AdminPayoutRowPayload = {
  business_id: string;
  business_name: string;
  handle: string;
  owner_legal_name: string;
  momo_network: string;
  momo_number: string;
  momo_account_name: string;
  subaccount_code: string;
  total_sales_minor: number;
  total_settled_minor: number;
  xtiitch_fees_minor: number;
  xtiitch_tax_minor: number;
  amount_due_minor: number;
  last_payout_at: string;
  last_payout_status: string;
};

type AdminPayoutHistoryEntryPayload = {
  settlement_id: string;
  reference: string;
  amount_minor: number;
  status: string;
  settled_at: string;
  created_at: string;
};

function mapPayoutRow(payload: AdminPayoutRowPayload): AdminPayoutRow {
  return {
    businessId: payload.business_id,
    businessName: payload.business_name,
    handle: payload.handle,
    ownerLegalName: payload.owner_legal_name,
    momoNetwork: payload.momo_network,
    momoNumber: payload.momo_number,
    momoAccountName: payload.momo_account_name,
    subaccountCode: payload.subaccount_code,
    totalSalesMinor: payload.total_sales_minor,
    totalSettledMinor: payload.total_settled_minor,
    xtiitchFeesMinor: payload.xtiitch_fees_minor,
    xtiitchTaxMinor: payload.xtiitch_tax_minor,
    amountDueMinor: payload.amount_due_minor,
    lastPayoutAt: payload.last_payout_at,
    lastPayoutStatus: payload.last_payout_status,
  };
}

function mapPayoutHistoryEntry(
  payload: AdminPayoutHistoryEntryPayload,
): AdminPayoutHistoryEntry {
  return {
    settlementId: payload.settlement_id,
    reference: payload.reference,
    amountMinor: payload.amount_minor,
    status: payload.status,
    settledAt: payload.settled_at,
    createdAt: payload.created_at,
  };
}

export const payoutsApi = {
  payouts: async (
    accessToken: string,
    input: { query?: string; limit?: number; offset?: number } = {},
  ): Promise<AdminPayoutRow[]> => {
    const params = new URLSearchParams();
    if (input.query) {
      params.set("query", input.query);
    }
    if (typeof input.limit === "number") {
      params.set("limit", String(input.limit));
    }
    if (typeof input.offset === "number") {
      params.set("offset", String(input.offset));
    }
    const query = params.toString();
    const payload = await requestJSON<{
      payouts?: AdminPayoutRowPayload[] | null;
    }>(`/admin/payouts${query ? `?${query}` : ""}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return (payload.payouts ?? []).map(mapPayoutRow);
  },
  payoutHistory: async (
    accessToken: string,
    businessId: string,
    input: { limit?: number; offset?: number } = {},
  ): Promise<AdminPayoutHistoryEntry[]> => {
    const params = new URLSearchParams();
    if (typeof input.limit === "number") {
      params.set("limit", String(input.limit));
    }
    if (typeof input.offset === "number") {
      params.set("offset", String(input.offset));
    }
    const query = params.toString();
    const payload = await requestJSON<{
      payouts?: AdminPayoutHistoryEntryPayload[] | null;
    }>(
      `/admin/payouts/${encodeURIComponent(businessId)}/history${query ? `?${query}` : ""}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    return (payload.payouts ?? []).map(mapPayoutHistoryEntry);
  },
};
