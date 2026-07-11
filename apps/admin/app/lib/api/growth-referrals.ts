import { requestJSON } from "./utils";

export type AdminReferralAudience = "customers" | "businesses" | "mixed";
export type AdminReferralRewardKind = "voucher" | "commission_rebate" | "none";
export type AdminReferralRefereeRewardKind = "voucher" | "none";
export type AdminReferralRewardType = "percentage" | "fixed";
export type AdminReferralProgrammeStatus =
  | "draft"
  | "active"
  | "paused"
  | "archived";
export type AdminReferralCodeOwnerType = "platform" | "business" | "customer";
export type AdminReferralCodeStatus = "active" | "paused" | "archived";

export type AdminReferralCode = {
  referralCodeId: string;
  programmeId: string;
  businessId?: string;
  businessName: string;
  businessHandle: string;
  ownerType: AdminReferralCodeOwnerType;
  ownerBusinessId?: string;
  ownerCustomerId?: string;
  ownerLabel: string;
  code: string;
  status: AdminReferralCodeStatus;
  referralCount: number;
  qualifiedCount: number;
  rewardedCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminReferralProgramme = {
  programmeId: string;
  title: string;
  codePrefix: string;
  audience: AdminReferralAudience;
  referrerRewardKind: AdminReferralRewardKind;
  refereeRewardKind: AdminReferralRefereeRewardKind;
  rewardType: AdminReferralRewardType;
  rewardValue: number;
  maxRewardMinor?: number;
  qualifyingOrderMinMinor: number;
  rewardHoldDays: number;
  status: AdminReferralProgrammeStatus;
  startsAt?: string;
  endsAt?: string;
  notes: string;
  codes: AdminReferralCode[];
  createdAt: string;
  updatedAt: string;
};

export type AdminReferralRewardIssue = {
  referralCount: number;
  rewardCount: number;
  voucherCount: number;
  commissionRebateCount: number;
  totalRewardMinor: number;
  issuedAt: string;
};

type AdminReferralProgrammePayload = {
  programme_id: string;
  title: string;
  code_prefix: string;
  audience: AdminReferralAudience;
  referrer_reward_kind: AdminReferralRewardKind;
  referee_reward_kind: AdminReferralRefereeRewardKind;
  reward_type: AdminReferralRewardType;
  reward_value: number;
  max_reward_minor?: number;
  qualifying_order_min_minor: number;
  reward_hold_days: number;
  status: AdminReferralProgrammeStatus;
  starts_at?: string;
  ends_at?: string;
  notes: string;
  codes?: AdminReferralCodePayload[];
  created_at: string;
  updated_at: string;
};

type AdminReferralCodePayload = {
  referral_code_id: string;
  programme_id: string;
  business_id?: string;
  business_name: string;
  business_handle: string;
  owner_type: AdminReferralCodeOwnerType;
  owner_business_id?: string;
  owner_customer_id?: string;
  owner_label: string;
  code: string;
  status: AdminReferralCodeStatus;
  referral_count: number;
  qualified_count: number;
  rewarded_count: number;
  created_at: string;
  updated_at: string;
};

type AdminReferralRewardIssuePayload = {
  referral_count: number;
  reward_count: number;
  voucher_count: number;
  commission_rebate_count: number;
  total_reward_minor: number;
  issued_at: string;
};
function mapReferralProgramme(
  payload: AdminReferralProgrammePayload,
): AdminReferralProgramme {
  return {
    programmeId: payload.programme_id,
    title: payload.title,
    codePrefix: payload.code_prefix,
    audience: payload.audience,
    referrerRewardKind: payload.referrer_reward_kind,
    refereeRewardKind: payload.referee_reward_kind,
    rewardType: payload.reward_type,
    rewardValue: payload.reward_value,
    maxRewardMinor: payload.max_reward_minor,
    qualifyingOrderMinMinor: payload.qualifying_order_min_minor,
    rewardHoldDays: payload.reward_hold_days,
    status: payload.status,
    startsAt: payload.starts_at,
    endsAt: payload.ends_at,
    notes: payload.notes,
    codes: (payload.codes ?? []).map(mapReferralCode),
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
  };
}

function mapReferralRewardIssue(
  payload: AdminReferralRewardIssuePayload,
): AdminReferralRewardIssue {
  return {
    referralCount: payload.referral_count,
    rewardCount: payload.reward_count,
    voucherCount: payload.voucher_count,
    commissionRebateCount: payload.commission_rebate_count,
    totalRewardMinor: payload.total_reward_minor,
    issuedAt: payload.issued_at,
  };
}

function mapReferralCode(payload: AdminReferralCodePayload): AdminReferralCode {
  return {
    referralCodeId: payload.referral_code_id,
    programmeId: payload.programme_id,
    businessId: payload.business_id,
    businessName: payload.business_name,
    businessHandle: payload.business_handle,
    ownerType: payload.owner_type,
    ownerBusinessId: payload.owner_business_id,
    ownerCustomerId: payload.owner_customer_id,
    ownerLabel: payload.owner_label,
    code: payload.code,
    status: payload.status,
    referralCount: payload.referral_count,
    qualifiedCount: payload.qualified_count,
    rewardedCount: payload.rewarded_count,
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
  };
}

export const referralsApi = {
  referralProgrammes: async (accessToken: string) => {
    const payload = await requestJSON<{
      programmes: AdminReferralProgrammePayload[];
    }>("/admin/referral-programmes", {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return payload.programmes.map(mapReferralProgramme);
  },
  createReferralProgramme: (
    accessToken: string,
    input: {
      title: string;
      codePrefix: string;
      audience: AdminReferralAudience;
      referrerRewardKind: AdminReferralRewardKind;
      refereeRewardKind: AdminReferralRefereeRewardKind;
      rewardType: AdminReferralRewardType;
      rewardValue: number;
      maxRewardMinor?: number;
      qualifyingOrderMinMinor: number;
      rewardHoldDays: number;
      status: Exclude<AdminReferralProgrammeStatus, "archived">;
      startsAt?: string;
      endsAt?: string;
      notes: string;
    },
  ) =>
    requestJSON<AdminReferralProgrammePayload>("/admin/referral-programmes", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        title: input.title,
        code_prefix: input.codePrefix,
        audience: input.audience,
        referrer_reward_kind: input.referrerRewardKind,
        referee_reward_kind: input.refereeRewardKind,
        reward_type: input.rewardType,
        reward_value: input.rewardValue,
        max_reward_minor: input.maxRewardMinor,
        qualifying_order_min_minor: input.qualifyingOrderMinMinor,
        reward_hold_days: input.rewardHoldDays,
        status: input.status,
        starts_at: input.startsAt,
        ends_at: input.endsAt,
        notes: input.notes,
      }),
    }).then(mapReferralProgramme),
  updateReferralProgramme: (
    accessToken: string,
    programmeId: string,
    input: {
      title: string;
      codePrefix: string;
      audience: AdminReferralAudience;
      referrerRewardKind: AdminReferralRewardKind;
      refereeRewardKind: AdminReferralRefereeRewardKind;
      rewardType: AdminReferralRewardType;
      rewardValue: number;
      maxRewardMinor?: number;
      qualifyingOrderMinMinor: number;
      rewardHoldDays: number;
      status: Exclude<AdminReferralProgrammeStatus, "archived">;
      startsAt?: string;
      endsAt?: string;
      notes: string;
    },
  ) =>
    requestJSON<AdminReferralProgrammePayload>(
      `/admin/referral-programmes/${encodeURIComponent(programmeId)}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          title: input.title,
          code_prefix: input.codePrefix,
          audience: input.audience,
          referrer_reward_kind: input.referrerRewardKind,
          referee_reward_kind: input.refereeRewardKind,
          reward_type: input.rewardType,
          reward_value: input.rewardValue,
          max_reward_minor: input.maxRewardMinor,
          qualifying_order_min_minor: input.qualifyingOrderMinMinor,
          reward_hold_days: input.rewardHoldDays,
          status: input.status,
          starts_at: input.startsAt,
          ends_at: input.endsAt,
          notes: input.notes,
        }),
      },
    ).then(mapReferralProgramme),
  archiveReferralProgramme: (
    accessToken: string,
    programmeId: string,
    reason: string,
  ) =>
    requestJSON<AdminReferralProgrammePayload>(
      `/admin/referral-programmes/${encodeURIComponent(programmeId)}/archive`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ reason }),
      },
    ).then(mapReferralProgramme),
  createReferralCode: (
    accessToken: string,
    programmeId: string,
    input: {
      businessId?: string;
      ownerType: Exclude<AdminReferralCodeOwnerType, "customer">;
      code: string;
      status: Exclude<AdminReferralCodeStatus, "archived">;
    },
  ) =>
    requestJSON<AdminReferralCodePayload>(
      `/admin/referral-programmes/${encodeURIComponent(programmeId)}/codes`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          business_id: input.businessId,
          owner_type: input.ownerType,
          code: input.code,
          status: input.status,
        }),
      },
    ).then(mapReferralCode),
  issueReferralRewards: (accessToken: string, limit: number) =>
    requestJSON<AdminReferralRewardIssuePayload>(
      "/admin/referral-rewards/issue",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ limit }),
      },
    ).then(mapReferralRewardIssue),
};
