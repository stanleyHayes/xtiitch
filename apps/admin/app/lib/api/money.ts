import { requestJSON } from "./utils";
import type { AdminRiskLevel } from "./verifications";

export type AdminMoneyWebhookStatus =
  | "verified"
  | "failed"
  | "replayed"
  | "reversed";
export type AdminMoneyPayoutStatus = "ready" | "review" | "blocked";

export type AdminMoneyWebhookEvent = {
  id: string;
  providerReference: string;
  business: string;
  status: AdminMoneyWebhookStatus;
  purpose: string;
  amountMinor: number;
  attempts: number;
  receivedAt: string;
  note: string;
};

export type AdminMoneyPayoutReview = {
  id: string;
  business: string;
  subaccountRef: string;
  status: AdminMoneyPayoutStatus;
  settlementMinor: number;
  commissionMinor: number;
  nextAction: string;
  holdActive: boolean;
  holdReason: string;
  holdUpdatedAt?: string;
};

export type AdminMoneyRails = {
  webhookEvents: AdminMoneyWebhookEvent[];
  payoutReviews: AdminMoneyPayoutReview[];
  updatedAt: string;
};
export type AdminRiskReviewStatus = "open" | "closed";
export type AdminRiskReview = {
  id: string;
  businessId: string;
  title: string;
  business: string;
  level: AdminRiskLevel;
  reason: string;
  owner: string;
  status: AdminRiskReviewStatus;
  updatedAt: string;
};
type AdminMoneyWebhookEventPayload = {
  id: string;
  provider_reference: string;
  business: string;
  status: AdminMoneyWebhookStatus;
  purpose: string;
  amount_minor: number;
  attempts: number;
  received_at: string;
  note: string;
};

type AdminMoneyPayoutReviewPayload = {
  id: string;
  business: string;
  subaccount_ref: string;
  status: AdminMoneyPayoutStatus;
  settlement_minor: number;
  commission_minor: number;
  next_action: string;
  hold_active: boolean;
  hold_reason: string;
  hold_updated_at?: string;
};

type AdminMoneyReplayRequestPayload = {
  replay_request_id: string;
  provider_reference: string;
  payment_id?: string;
  business: string;
  reason: string;
  status: string;
  created_at: string;
};

type AdminMoneyReversalPayload = {
  payment_id: string;
  provider_reference: string;
  business_id: string;
  business: string;
  order_id?: string;
  payment_reversed: boolean;
  promotion_redemption_count: number;
  affiliate_conversion_count: number;
  referral_count: number;
  referral_reward_count: number;
  generated_promotion_count: number;
  reason: string;
  reversed_at: string;
};

type AdminMoneyRailsPayload = {
  webhook_events: AdminMoneyWebhookEventPayload[];
  payout_reviews: AdminMoneyPayoutReviewPayload[];
  updated_at: string;
};
type AdminRiskReviewPayload = {
  review_key: string;
  business_id: string;
  title: string;
  business: string;
  level: AdminRiskLevel;
  reason: string;
  owner: string;
  status: AdminRiskReviewStatus;
  updated_at: string;
};
function mapMoneyRails(payload: AdminMoneyRailsPayload): AdminMoneyRails {
  return {
    webhookEvents: payload.webhook_events.map((event) => ({
      id: event.id,
      providerReference: event.provider_reference,
      business: event.business,
      status: event.status,
      purpose: event.purpose,
      amountMinor: event.amount_minor,
      attempts: event.attempts,
      receivedAt: event.received_at,
      note: event.note,
    })),
    payoutReviews: payload.payout_reviews.map((review) => ({
      id: review.id,
      business: review.business,
      subaccountRef: review.subaccount_ref,
      status: review.status,
      settlementMinor: review.settlement_minor,
      commissionMinor: review.commission_minor,
      nextAction: review.next_action,
      holdActive: review.hold_active,
      holdReason: review.hold_reason,
      holdUpdatedAt: review.hold_updated_at,
    })),
    updatedAt: payload.updated_at,
  };
}
function mapRiskReview(payload: AdminRiskReviewPayload): AdminRiskReview {
  return {
    id: payload.review_key,
    businessId: payload.business_id,
    title: payload.title,
    business: payload.business,
    level: payload.level,
    reason: payload.reason,
    owner: payload.owner,
    status: payload.status,
    updatedAt: payload.updated_at,
  };
}

export const moneyApi = {
  moneyRails: (accessToken: string) =>
    requestJSON<AdminMoneyRailsPayload>("/admin/money-rails", {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    }).then(mapMoneyRails),
  queueMoneyReplay: (
    accessToken: string,
    input: { providerReference: string; reason: string },
  ) =>
    requestJSON<AdminMoneyReplayRequestPayload>(
      "/admin/money-rails/replay-requests",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          provider_reference: input.providerReference,
          reason: input.reason,
        }),
      },
    ),
  reverseMoneyPayment: (
    accessToken: string,
    input: { providerReference: string; reason: string },
  ) =>
    requestJSON<AdminMoneyReversalPayload>(
      "/admin/money-rails/payment-reversals",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          provider_reference: input.providerReference,
          reason: input.reason,
        }),
      },
    ),
  setSettlementReviewHold: (
    accessToken: string,
    businessId: string,
    input: { hold: boolean; reason: string },
  ) =>
    requestJSON<AdminMoneyPayoutReviewPayload>(
      `/admin/money-rails/businesses/${encodeURIComponent(businessId)}/settlement-hold`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          hold: input.hold,
          reason: input.reason,
        }),
      },
    ),
  riskReviews: async (accessToken: string) => {
    const payload = await requestJSON<{ reviews: AdminRiskReviewPayload[] }>(
      "/admin/risk-reviews",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    return payload.reviews.map(mapRiskReview);
  },
  updateRiskReviewStatus: (
    accessToken: string,
    reviewKey: string,
    input: { status: AdminRiskReviewStatus; reason: string },
  ) =>
    requestJSON<AdminRiskReviewPayload>(
      `/admin/risk-reviews/${encodeURIComponent(reviewKey)}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          status: input.status,
          reason: input.reason,
        }),
      },
    ).then(mapRiskReview),
};
