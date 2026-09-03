import { requestJSON } from "./utils";
import type { AdminAffiliatePayoutMode } from "./growth-affiliates";

export type AdminAffiliateProgramme = {
  affiliateProgrammeId: string;
  ownerType: "platform" | "business";
  businessId?: string;
  businessName?: string;
  isDefault: boolean;
  name: string;
  description: string;
  status: "draft" | "active" | "paused" | "archived";
  defaultPurchaseCommissionBps: number;
  defaultFirstPaidPlanCommissionBps: number;
  cookieWindowDays: number;
  holdDays: number;
  payoutMode: AdminAffiliatePayoutMode;
  minimumPayoutMinor: number;
  allowedTargetScope:
    | "platform"
    | "store"
    | "collection"
    | "design"
    | "product";
  affiliateCount: number;
  createdAt: string;
  updatedAt: string;
  milestones: AdminPartnerMilestone[];
};

export type AdminPartnerMilestone = {
  milestoneId: string;
  threshold: number;
  title: string;
  rewardDescription: string;
  status: "active" | "paused" | "archived";
};

export type AdminAffiliateProgrammeInput = Pick<
  AdminAffiliateProgramme,
  | "name"
  | "description"
  | "status"
  | "defaultPurchaseCommissionBps"
  | "defaultFirstPaidPlanCommissionBps"
  | "cookieWindowDays"
  | "holdDays"
  | "payoutMode"
  | "minimumPayoutMinor"
  | "allowedTargetScope"
> & {
  ownerType?: AdminAffiliateProgramme["ownerType"];
  businessId?: string;
  milestones?: AdminPartnerMilestone[];
};

type ProgrammePayload = {
  affiliate_programme_id: string;
  owner_type: AdminAffiliateProgramme["ownerType"];
  business_id?: string;
  business_name?: string;
  is_default: boolean;
  name: string;
  description: string;
  status: AdminAffiliateProgramme["status"];
  default_purchase_commission_bps: number;
  default_first_paid_plan_commission_bps: number;
  cookie_window_days: number;
  hold_days: number;
  payout_mode: AdminAffiliatePayoutMode;
  minimum_payout_minor: number;
  allowed_target_scope: AdminAffiliateProgramme["allowedTargetScope"];
  affiliate_count: number;
  created_at: string;
  updated_at: string;
  milestones: {
    milestone_id: string;
    threshold: number;
    title: string;
    reward_description: string;
    status: AdminPartnerMilestone["status"];
  }[];
};

function mapProgramme(payload: ProgrammePayload): AdminAffiliateProgramme {
  return {
    affiliateProgrammeId: payload.affiliate_programme_id,
    ownerType: payload.owner_type,
    businessId: payload.business_id,
    businessName: payload.business_name,
    isDefault: payload.is_default,
    name: payload.name,
    description: payload.description,
    status: payload.status,
    defaultPurchaseCommissionBps: payload.default_purchase_commission_bps,
    defaultFirstPaidPlanCommissionBps:
      payload.default_first_paid_plan_commission_bps,
    cookieWindowDays: payload.cookie_window_days,
    holdDays: payload.hold_days,
    payoutMode: payload.payout_mode,
    minimumPayoutMinor: payload.minimum_payout_minor,
    allowedTargetScope: payload.allowed_target_scope,
    affiliateCount: payload.affiliate_count,
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
    milestones: (payload.milestones ?? []).map((milestone) => ({
      milestoneId: milestone.milestone_id,
      threshold: milestone.threshold,
      title: milestone.title,
      rewardDescription: milestone.reward_description,
      status: milestone.status,
    })),
  };
}

function programmeBody(input: AdminAffiliateProgrammeInput) {
  return JSON.stringify({
    owner_type: input.ownerType,
    business_id: input.businessId,
    name: input.name,
    description: input.description,
    status: input.status,
    default_purchase_commission_bps: input.defaultPurchaseCommissionBps,
    default_first_paid_plan_commission_bps:
      input.defaultFirstPaidPlanCommissionBps,
    cookie_window_days: input.cookieWindowDays,
    hold_days: input.holdDays,
    payout_mode: input.payoutMode,
    minimum_payout_minor: input.minimumPayoutMinor,
    allowed_target_scope: input.allowedTargetScope,
    milestones: (input.milestones ?? []).map((milestone) => ({
      milestone_id: milestone.milestoneId,
      threshold: milestone.threshold,
      title: milestone.title,
      reward_description: milestone.rewardDescription,
      status: milestone.status,
    })),
  });
}

export const affiliateProgrammesApi = {
  affiliateProgrammes: async (accessToken: string) => {
    const payload = await requestJSON<{ programmes: ProgrammePayload[] }>(
      "/admin/affiliate-programmes",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    return payload.programmes.map(mapProgramme);
  },
  createAffiliateProgramme: (
    accessToken: string,
    input: AdminAffiliateProgrammeInput,
  ) =>
    requestJSON<ProgrammePayload>("/admin/affiliate-programmes", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: programmeBody(input),
    }).then(mapProgramme),
  updateAffiliateProgramme: (
    accessToken: string,
    programmeId: string,
    input: AdminAffiliateProgrammeInput,
  ) =>
    requestJSON<ProgrammePayload>(
      `/admin/affiliate-programmes/${encodeURIComponent(programmeId)}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: programmeBody(input),
      },
    ).then(mapProgramme),
};
