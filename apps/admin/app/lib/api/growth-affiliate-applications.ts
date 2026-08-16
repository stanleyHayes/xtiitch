import { requestJSON } from "./utils";
import type {
  AdminAffiliateEntityType,
  AdminAffiliatePayoutMode,
} from "./growth-affiliates";

export type AdminAffiliateApplication = {
  applicationId: string;
  applicantType: AdminAffiliateEntityType;
  displayName: string;
  contactName: string;
  email: string;
  phone: string;
  websiteUrl: string;
  requestedCode: string;
  audienceSummary: string;
  promotionChannels: string[];
  status: "pending_review" | "approved" | "rejected" | "withdrawn";
  affiliateId?: string;
  reviewNote: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
};

type AdminAffiliateApplicationPayload = {
  application_id: string;
  applicant_type: AdminAffiliateEntityType;
  display_name: string;
  contact_name: string;
  email: string;
  phone: string;
  website_url: string;
  requested_code: string;
  audience_summary: string;
  promotion_channels: string[];
  status: AdminAffiliateApplication["status"];
  affiliate_id?: string;
  review_note: string;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
};

function mapAffiliateApplication(
  payload: AdminAffiliateApplicationPayload,
): AdminAffiliateApplication {
  return {
    applicationId: payload.application_id,
    applicantType: payload.applicant_type,
    displayName: payload.display_name,
    contactName: payload.contact_name,
    email: payload.email,
    phone: payload.phone,
    websiteUrl: payload.website_url,
    requestedCode: payload.requested_code,
    audienceSummary: payload.audience_summary,
    promotionChannels: payload.promotion_channels ?? [],
    status: payload.status,
    affiliateId: payload.affiliate_id,
    reviewNote: payload.review_note,
    reviewedAt: payload.reviewed_at,
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
  };
}

export const affiliateApplicationsApi = {
  affiliateApplications: async (accessToken: string) => {
    const payload = await requestJSON<{
      applications: AdminAffiliateApplicationPayload[];
    }>("/admin/affiliate-applications", {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return payload.applications.map(mapAffiliateApplication);
  },
  decideAffiliateApplication: (
    accessToken: string,
    applicationId: string,
    input: {
      decision: "approved" | "rejected";
      reviewNote: string;
      purchaseCommissionBps: number;
      firstPaidPlanCommissionBps: number;
      cookieWindowDays: number;
      payoutMode: AdminAffiliatePayoutMode;
    },
  ) =>
    requestJSON<AdminAffiliateApplicationPayload>(
      `/admin/affiliate-applications/${encodeURIComponent(applicationId)}/decision`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          decision: input.decision,
          review_note: input.reviewNote,
          purchase_commission_bps: input.purchaseCommissionBps,
          first_paid_plan_commission_bps: input.firstPaidPlanCommissionBps,
          cookie_window_days: input.cookieWindowDays,
          payout_mode: input.payoutMode,
        }),
      },
    ).then(mapAffiliateApplication),
  resendAffiliateActivation: (email: string) =>
    requestJSON<void>("/affiliate/auth/activation/resend", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
};
