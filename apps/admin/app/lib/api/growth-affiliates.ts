/* eslint-disable max-lines -- affiliate API contracts and mappers stay colocated */
import { requestJSON } from "./utils";

export type AdminAffiliateEntityType = "person" | "business" | "agency";
export type AdminAffiliateCommissionModel = "percentage" | "flat";
export type AdminAffiliatePayoutMode =
  | "paystack_split"
  | "paystack_transfer"
  | "voucher"
  | "manual";
export type AdminAffiliateStatus =
  | "pending_review"
  | "active"
  | "paused"
  | "archived";

export type AdminAffiliate = {
  affiliateId: string;
  affiliateProgrammeId: string;
  programmeName: string;
  ownerType: "platform" | "business";
  ownerBusinessId?: string;
  ownerBusinessName?: string;
  entityType: AdminAffiliateEntityType;
  code: string;
  displayName: string;
  contactName: string;
  email: string;
  phone: string;
  region: string;
  websiteUrl: string;
  commissionModel: AdminAffiliateCommissionModel;
  commissionRate: number;
  purchaseCommissionBps: number;
  firstPaidPlanCommissionBps: number;
  cookieWindowDays: number;
  payoutMode: AdminAffiliatePayoutMode;
  payoutReference: string;
  status: AdminAffiliateStatus;
  notes: string;
  targetScope: "platform" | "store" | "collection" | "design" | "product";
  targetRefId?: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminAffiliateAttribution = {
  affiliateId: string;
  code: string;
  displayName: string;
  clickCount: number;
  conversionCount: number;
  pendingConversionCount: number;
  approvedConversionCount: number;
  settledConversionCount: number;
  reversedConversionCount: number;
  activeReferralCount: number;
  inactiveReferralCount: number;
  notActivatedCount: number;
  grossMinor: number;
  commissionMinor: number;
  heldConversionCount: number;
  pendingCommissionMinor: number;
  availableCommissionMinor: number;
  paidCommissionMinor: number;
  heldCommissionMinor: number;
  reversedCommissionMinor: number;
  recentConversions: AdminAffiliateConversion[];
  recentPayouts: AdminAffiliatePayout[];
  invitations: AdminAffiliateInvitation[];
  milestoneAchievements: AdminAffiliateMilestoneAchievement[];
  lastActivityAt?: string;
};
export type AdminAffiliateInvitation = {
  invitationId: string;
  inviteeEmail: string;
  acceptedAffiliateId?: string;
  acceptedDisplayName?: string;
  createdAt: string;
  acceptedAt?: string;
};

export type AdminAffiliateMilestoneAchievement = {
  achievementId: string;
  affiliateId: string;
  threshold: number;
  title: string;
  rewardDescription: string;
  rewardStatus: "unfulfilled" | "processing" | "fulfilled" | "declined";
  fulfilmentNote: string;
  achievedAt: string;
  fulfilledAt?: string;
};

// Item 4: "released" is an operator action, not a stored status — the server
// restores whichever status the commission carried before the hold.
export type AdminAffiliateConversionAction =
  | "approved"
  | "settled"
  | "reversed"
  | "held"
  | "released";

export type AdminAffiliateConversion = {
  conversionId: string;
  affiliateId: string;
  businessId: string;
  businessName: string;
  businessHandle: string;
  conversionType: "purchase" | "subscription_payment" | "adjustment";
  orderId?: string;
  subscriptionId?: string;
  paymentReference?: string;
  payoutBatchId?: string;
  grossMinor: number;
  commissionMinor: number;
  status: "pending" | "approved" | "settled" | "reversed" | "held";
  attributionModel: "last_click" | "manual";
  holdUntil?: string;
  holdReason?: string;
  preHoldStatus?: string;
  holdPlacedAt?: string;
  holdReleasedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminAffiliatePayout = {
  payoutBatchId: string;
  affiliateId: string;
  displayName: string;
  payoutMode: AdminAffiliatePayoutMode;
  payoutReference: string;
  conversionCount: number;
  grossMinor: number;
  commissionMinor: number;
  status: "settled" | "void";
  notes: string;
  createdAt: string;
  updatedAt: string;
};
type AdminAffiliatePayload = {
  affiliate_id: string;
  affiliate_programme_id: string;
  programme_name: string;
  owner_type: AdminAffiliate["ownerType"];
  owner_business_id?: string;
  owner_business_name?: string;
  entity_type: AdminAffiliateEntityType;
  code: string;
  display_name: string;
  contact_name: string;
  email: string;
  phone: string;
  region: string;
  website_url: string;
  commission_model: AdminAffiliateCommissionModel;
  commission_rate: number;
  purchase_commission_bps: number;
  first_paid_plan_commission_bps: number;
  cookie_window_days: number;
  payout_mode: AdminAffiliatePayoutMode;
  payout_reference: string;
  status: AdminAffiliateStatus;
  notes: string;
  target_scope: AdminAffiliate["targetScope"];
  target_ref_id?: string;
  created_at: string;
  updated_at: string;
};

type AdminAffiliateAttributionPayload = {
  affiliate_id: string;
  code: string;
  display_name: string;
  click_count: number;
  conversion_count: number;
  pending_conversion_count: number;
  approved_conversion_count: number;
  settled_conversion_count: number;
  reversed_conversion_count: number;
  active_referral_count: number;
  inactive_referral_count: number;
  not_activated_count: number;
  gross_minor: number;
  commission_minor: number;
  held_conversion_count: number;
  pending_commission_minor: number;
  available_commission_minor: number;
  paid_commission_minor: number;
  held_commission_minor: number;
  reversed_commission_minor: number;
  recent_conversions: AdminAffiliateConversionPayload[];
  recent_payouts: AdminAffiliatePayoutPayload[];
  invitations: AdminAffiliateInvitationPayload[];
  milestone_achievements: AdminAffiliateMilestoneAchievementPayload[];
  last_activity_at?: string;
};
type AdminAffiliateInvitationPayload = {
  invitation_id: string;
  invitee_email: string;
  accepted_affiliate_id?: string;
  accepted_display_name?: string;
  created_at: string;
  accepted_at?: string;
};

type AdminAffiliateMilestoneAchievementPayload = {
  achievement_id: string;
  affiliate_id: string;
  threshold: number;
  title: string;
  reward_description: string;
  reward_status: AdminAffiliateMilestoneAchievement["rewardStatus"];
  fulfilment_note: string;
  achieved_at: string;
  fulfilled_at?: string;
};

type AdminAffiliateConversionPayload = {
  conversion_id: string;
  affiliate_id: string;
  business_id: string;
  business_name: string;
  business_handle: string;
  conversion_type: AdminAffiliateConversion["conversionType"];
  order_id?: string;
  subscription_id?: string;
  payment_reference?: string;
  payout_batch_id?: string;
  gross_minor: number;
  commission_minor: number;
  status: AdminAffiliateConversion["status"];
  attribution_model: AdminAffiliateConversion["attributionModel"];
  hold_until?: string;
  hold_reason?: string;
  pre_hold_status?: string;
  hold_placed_at?: string;
  hold_released_at?: string;
  created_at: string;
  updated_at: string;
};

type AdminAffiliatePayoutPayload = {
  payout_batch_id: string;
  affiliate_id: string;
  display_name: string;
  payout_mode: AdminAffiliatePayoutMode;
  payout_reference: string;
  conversion_count: number;
  gross_minor: number;
  commission_minor: number;
  status: AdminAffiliatePayout["status"];
  notes: string;
  created_at: string;
  updated_at: string;
};
function mapAffiliate(payload: AdminAffiliatePayload): AdminAffiliate {
  return {
    affiliateId: payload.affiliate_id,
    affiliateProgrammeId: payload.affiliate_programme_id,
    programmeName: payload.programme_name,
    ownerType: payload.owner_type,
    ownerBusinessId: payload.owner_business_id,
    ownerBusinessName: payload.owner_business_name,
    entityType: payload.entity_type,
    code: payload.code,
    displayName: payload.display_name,
    contactName: payload.contact_name,
    email: payload.email,
    phone: payload.phone,
    region: payload.region,
    websiteUrl: payload.website_url,
    commissionModel: payload.commission_model,
    commissionRate: payload.commission_rate,
    purchaseCommissionBps: payload.purchase_commission_bps,
    firstPaidPlanCommissionBps: payload.first_paid_plan_commission_bps,
    cookieWindowDays: payload.cookie_window_days,
    payoutMode: payload.payout_mode,
    payoutReference: payload.payout_reference,
    status: payload.status,
    notes: payload.notes,
    targetScope: payload.target_scope,
    targetRefId: payload.target_ref_id,
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
  };
}

function mapAffiliateAttribution(
  payload: AdminAffiliateAttributionPayload,
): AdminAffiliateAttribution {
  return {
    affiliateId: payload.affiliate_id,
    code: payload.code,
    displayName: payload.display_name,
    clickCount: payload.click_count,
    conversionCount: payload.conversion_count,
    pendingConversionCount: payload.pending_conversion_count,
    approvedConversionCount: payload.approved_conversion_count,
    settledConversionCount: payload.settled_conversion_count,
    reversedConversionCount: payload.reversed_conversion_count,
    activeReferralCount: payload.active_referral_count,
    inactiveReferralCount: payload.inactive_referral_count,
    notActivatedCount: payload.not_activated_count,
    grossMinor: payload.gross_minor,
    commissionMinor: payload.commission_minor,
    heldConversionCount: payload.held_conversion_count ?? 0,
    pendingCommissionMinor: payload.pending_commission_minor ?? 0,
    availableCommissionMinor: payload.available_commission_minor ?? 0,
    paidCommissionMinor: payload.paid_commission_minor ?? 0,
    heldCommissionMinor: payload.held_commission_minor ?? 0,
    reversedCommissionMinor: payload.reversed_commission_minor ?? 0,
    recentConversions: payload.recent_conversions.map(mapAffiliateConversion),
    recentPayouts: (payload.recent_payouts ?? []).map(mapAffiliatePayout),
    invitations: (payload.invitations ?? []).map((invitation) => ({
      invitationId: invitation.invitation_id,
      inviteeEmail: invitation.invitee_email,
      acceptedAffiliateId: invitation.accepted_affiliate_id,
      acceptedDisplayName: invitation.accepted_display_name,
      createdAt: invitation.created_at,
      acceptedAt: invitation.accepted_at,
    })),
    milestoneAchievements: (payload.milestone_achievements ?? []).map(
      mapAffiliateMilestoneAchievement,
    ),
    lastActivityAt: payload.last_activity_at,
  };
}

function mapAffiliateMilestoneAchievement(
  payload: AdminAffiliateMilestoneAchievementPayload,
): AdminAffiliateMilestoneAchievement {
  return {
    achievementId: payload.achievement_id,
    affiliateId: payload.affiliate_id,
    threshold: payload.threshold,
    title: payload.title,
    rewardDescription: payload.reward_description,
    rewardStatus: payload.reward_status,
    fulfilmentNote: payload.fulfilment_note,
    achievedAt: payload.achieved_at,
    fulfilledAt: payload.fulfilled_at,
  };
}

function mapAffiliateConversion(
  payload: AdminAffiliateConversionPayload,
): AdminAffiliateConversion {
  return {
    conversionId: payload.conversion_id,
    affiliateId: payload.affiliate_id,
    businessId: payload.business_id,
    businessName: payload.business_name,
    businessHandle: payload.business_handle,
    conversionType: payload.conversion_type,
    orderId: payload.order_id,
    subscriptionId: payload.subscription_id,
    paymentReference: payload.payment_reference,
    payoutBatchId: payload.payout_batch_id,
    grossMinor: payload.gross_minor,
    commissionMinor: payload.commission_minor,
    status: payload.status,
    attributionModel: payload.attribution_model,
    holdUntil: payload.hold_until,
    holdReason: payload.hold_reason,
    preHoldStatus: payload.pre_hold_status,
    holdPlacedAt: payload.hold_placed_at,
    holdReleasedAt: payload.hold_released_at,
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
  };
}

function mapAffiliatePayout(
  payload: AdminAffiliatePayoutPayload,
): AdminAffiliatePayout {
  return {
    payoutBatchId: payload.payout_batch_id,
    affiliateId: payload.affiliate_id,
    displayName: payload.display_name,
    payoutMode: payload.payout_mode,
    payoutReference: payload.payout_reference,
    conversionCount: payload.conversion_count,
    grossMinor: payload.gross_minor,
    commissionMinor: payload.commission_minor,
    status: payload.status,
    notes: payload.notes,
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
  };
}

export const affiliatesApi = {
  affiliates: async (accessToken: string) => {
    const payload = await requestJSON<{ affiliates: AdminAffiliatePayload[] }>(
      "/admin/affiliates",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    return payload.affiliates.map(mapAffiliate);
  },
  affiliateAttribution: async (accessToken: string) => {
    const payload = await requestJSON<{
      attribution: AdminAffiliateAttributionPayload[];
    }>("/admin/affiliate-attribution", {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return payload.attribution.map(mapAffiliateAttribution);
  },
  updateAffiliateConversionStatus: (
    accessToken: string,
    conversionId: string,
    input: {
      status: AdminAffiliateConversionAction;
      reason: string;
    },
  ) =>
    requestJSON<AdminAffiliateConversionPayload>(
      `/admin/affiliate-conversions/${encodeURIComponent(conversionId)}/status`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          status: input.status,
          reason: input.reason,
        }),
      },
    ).then(mapAffiliateConversion),
  updateAffiliateMilestoneAchievement: (
    accessToken: string,
    achievementId: string,
    input: {
      rewardStatus: AdminAffiliateMilestoneAchievement["rewardStatus"];
      fulfilmentNote: string;
      reason: string;
    },
  ) =>
    requestJSON<AdminAffiliateMilestoneAchievementPayload>(
      `/admin/affiliate-milestone-achievements/${encodeURIComponent(achievementId)}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          reward_status: input.rewardStatus,
          fulfilment_note: input.fulfilmentNote,
          reason: input.reason,
        }),
      },
    ).then(mapAffiliateMilestoneAchievement),
  correctAffiliateAttribution: (
    accessToken: string,
    businessId: string,
    input: { affiliateId: string; reason: string },
  ) =>
    requestJSON(
      `/admin/businesses/${encodeURIComponent(businessId)}/affiliate-attribution`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          affiliate_id: input.affiliateId,
          reason: input.reason,
        }),
      },
    ),
  createAffiliatePayout: (
    accessToken: string,
    affiliateId: string,
    input: {
      payoutReference: string;
      notes: string;
    },
  ) =>
    requestJSON<AdminAffiliatePayoutPayload>(
      `/admin/affiliates/${encodeURIComponent(affiliateId)}/payouts`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          payout_reference: input.payoutReference,
          notes: input.notes,
        }),
      },
    ).then(mapAffiliatePayout),
  createAffiliate: (
    accessToken: string,
    input: {
      entityType: AdminAffiliateEntityType;
      code: string;
      displayName: string;
      contactName: string;
      email: string;
      phone: string;
      region: string;
      websiteUrl: string;
      commissionModel: AdminAffiliateCommissionModel;
      commissionRate: number;
      purchaseCommissionBps: number;
      firstPaidPlanCommissionBps: number;
      cookieWindowDays: number;
      payoutMode: AdminAffiliatePayoutMode;
      payoutReference: string;
      status: Exclude<AdminAffiliateStatus, "archived">;
      notes: string;
    },
  ) =>
    requestJSON<AdminAffiliatePayload>("/admin/affiliates", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        entity_type: input.entityType,
        code: input.code,
        display_name: input.displayName,
        contact_name: input.contactName,
        email: input.email,
        phone: input.phone,
        region: input.region,
        website_url: input.websiteUrl,
        commission_model: input.commissionModel,
        commission_rate: input.commissionRate,
        purchase_commission_bps: input.purchaseCommissionBps,
        first_paid_plan_commission_bps: input.firstPaidPlanCommissionBps,
        cookie_window_days: input.cookieWindowDays,
        payout_mode: input.payoutMode,
        payout_reference: input.payoutReference,
        status: input.status,
        notes: input.notes,
      }),
    }).then(mapAffiliate),
  updateAffiliate: (
    accessToken: string,
    affiliateId: string,
    input: {
      entityType: AdminAffiliateEntityType;
      code: string;
      displayName: string;
      contactName: string;
      email: string;
      phone: string;
      region: string;
      websiteUrl: string;
      commissionModel: AdminAffiliateCommissionModel;
      commissionRate: number;
      purchaseCommissionBps: number;
      firstPaidPlanCommissionBps: number;
      cookieWindowDays: number;
      payoutMode: AdminAffiliatePayoutMode;
      payoutReference: string;
      status: Exclude<AdminAffiliateStatus, "archived">;
      notes: string;
      reason: string;
    },
  ) =>
    requestJSON<AdminAffiliatePayload>(
      `/admin/affiliates/${encodeURIComponent(affiliateId)}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          entity_type: input.entityType,
          code: input.code,
          display_name: input.displayName,
          contact_name: input.contactName,
          email: input.email,
          phone: input.phone,
          region: input.region,
          website_url: input.websiteUrl,
          commission_model: input.commissionModel,
          commission_rate: input.commissionRate,
          purchase_commission_bps: input.purchaseCommissionBps,
          first_paid_plan_commission_bps: input.firstPaidPlanCommissionBps,
          cookie_window_days: input.cookieWindowDays,
          payout_mode: input.payoutMode,
          payout_reference: input.payoutReference,
          status: input.status,
          notes: input.notes,
          reason: input.reason,
        }),
      },
    ).then(mapAffiliate),
  archiveAffiliate: (
    accessToken: string,
    affiliateId: string,
    reason: string,
  ) =>
    requestJSON<AdminAffiliatePayload>(
      `/admin/affiliates/${encodeURIComponent(affiliateId)}/archive`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ reason }),
      },
    ).then(mapAffiliate),
};
