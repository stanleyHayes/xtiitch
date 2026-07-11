import {
  AdminApiError,
  type AdminAffiliateConversion,
  type AdminReferralRewardIssue,
  type AdminSupportAssignment,
  type AdminSupportTicketStatus,
} from "../../lib/api";
import { formatGHS } from "./formatting";



export function supportActionMessage(
  status: AdminSupportTicketStatus,
  assignment: AdminSupportAssignment,
): string {
  if (status === "resolved") {
    return "Support ticket resolved.";
  }
  if (assignment === "self") {
    return "Support ticket assigned to you.";
  }
  if (assignment === "unassigned") {
    return "Support ticket unassigned.";
  }
  return "Support ticket reopened.";
}



export function adminUserActionError(error: unknown): string {
  if (error instanceof AdminApiError) {
    switch (error.code) {
      case "admin_user_email_taken":
        return "That operator email already has admin access.";
      case "forbidden":
        return "Only platform owners can make that operator change.";
      case "invalid_input":
        return "Check the name, email, password length, and selected role.";
      case "not_found":
        return "That operator account was not found.";
      default:
        return "The operator change could not be saved.";
    }
  }
  return "The operator change could not be saved.";
}



export function adminRoleActionError(error: unknown): string {
  if (error instanceof AdminApiError) {
    switch (error.code) {
      case "forbidden":
        return "Only operators with role-management permission can edit grants.";
      case "invalid_input":
        return "Check the selected role and keep owner recovery permissions enabled.";
      default:
        return "The role permissions could not be saved.";
    }
  }
  return "The role permissions could not be saved.";
}



export function adminSettingsActionError(error: unknown): string {
  if (error instanceof AdminApiError) {
    switch (error.code) {
      case "admin_user_email_taken":
        return "That email is already used by another admin account.";
      case "forbidden":
        return "Your role does not have permission to change platform settings.";
      case "invalid_input":
        return "Check the email, digest time, SLA hours, and payout threshold.";
      case "not_found":
        return "Those settings could not be found.";
      default:
        return "The settings change could not be saved.";
    }
  }
  return "The settings change could not be saved.";
}



export function adminVerificationActionError(error: unknown): string {
  if (error instanceof AdminApiError) {
    switch (error.code) {
      case "forbidden":
        return "Your role cannot review business verifications.";
      case "invalid_input":
        return "Choose a valid verification decision and try again.";
      case "not_found":
        return "That business could not be found.";
      default:
        return "The verification decision could not be saved.";
    }
  }
  return "The verification decision could not be saved.";
}



export function adminBusinessActionError(error: unknown): string {
  if (error instanceof AdminApiError) {
    switch (error.code) {
      case "forbidden":
        return "Your role cannot manage business accounts.";
      case "invalid_input":
        return "Choose a valid business status and try again.";
      case "not_found":
        return "That business could not be found.";
      default:
        return "The business status change could not be saved.";
    }
  }
  return "The business status change could not be saved.";
}



export function adminMoneyActionError(error: unknown): string {
  if (error instanceof AdminApiError) {
    switch (error.code) {
      case "forbidden":
        return "Your role cannot manage money rails.";
      case "invalid_input":
        return "Check the provider reference, business, and reason.";
      case "not_found":
        return "That payment reference or business could not be found.";
      default:
        return "The money rails action could not be saved.";
    }
  }
  return "The money rails action could not be saved.";
}



export function adminSubscriptionActionError(error: unknown): string {
  if (error instanceof AdminApiError) {
    switch (error.code) {
      case "forbidden":
        return "Your role cannot manage subscriptions.";
      case "invalid_input":
        return "Choose valid subscription billing details.";
      case "not_found":
        return "That subscription or invoice could not be found.";
      case "subscription_billing_unavailable":
        return "That subscription is not currently billable.";
      case "subscription_invoice_open":
        return "That subscription already has an open invoice.";
      default:
        return "The subscription change could not be saved.";
    }
  }
  return "The subscription change could not be saved.";
}



export function adminPlanActionError(error: unknown): string {
  if (error instanceof AdminApiError) {
    switch (error.code) {
      case "forbidden":
        return "Your role cannot manage plan packages.";
      case "invalid_input":
        return "Check the package code, name, monthly fee, yearly fee, commission, and design limit.";
      case "not_found":
        return "That plan package could not be found.";
      default:
        return "The plan package change could not be saved.";
    }
  }
  return "The plan package change could not be saved.";
}



export function adminPromotionActionError(error: unknown): string {
  if (error instanceof AdminApiError) {
    switch (error.code) {
      case "forbidden":
        return "Your role cannot manage promotions.";
      case "invalid_input":
        return "Check the code, title, discount, cap, limits, funding source, and date window.";
      case "not_found":
        return "That promotion could not be found.";
      default:
        return "The promotion change could not be saved.";
    }
  }
  return "The promotion change could not be saved.";
}



export function adminAdCampaignActionError(error: unknown): string {
  if (error instanceof AdminApiError) {
    switch (error.code) {
      case "forbidden":
        return "Your role cannot manage sponsored placements.";
      case "invalid_input":
        return "Check the business, placement, headline, budget, and date window.";
      case "payment_in_flight":
        return "That placement already has an open payment link.";
      case "not_found":
        return "That campaign or eligible verified business could not be found.";
      default:
        return "The sponsored placement change could not be saved.";
    }
  }
  return "The sponsored placement change could not be saved.";
}



export function adminAffiliateActionError(error: unknown): string {
  if (error instanceof AdminApiError) {
    switch (error.code) {
      case "forbidden":
        return "Your role cannot manage affiliate programmes.";
      case "invalid_input":
        return "Check the affiliate fields or conversion status transition.";
      case "not_found":
        return "That affiliate partner or conversion could not be found.";
      default:
        return "The affiliate programme change could not be saved.";
    }
  }
  return "The affiliate programme change could not be saved.";
}



export function affiliateConversionActionMessage(
  status: Exclude<AdminAffiliateConversion["status"], "pending">,
): string {
  if (status === "settled") {
    return "Affiliate conversion marked settled.";
  }
  if (status === "reversed") {
    return "Affiliate conversion reversed.";
  }
  return "Affiliate conversion approved.";
}



export function affiliateConversionActions(
  status: AdminAffiliateConversion["status"],
): {
  status: Exclude<AdminAffiliateConversion["status"], "pending">;
  label: string;
}[] {
  if (status === "pending") {
    return [
      { status: "approved", label: "Approve" },
      { status: "reversed", label: "Reverse" },
    ];
  }
  if (status === "approved") {
    return [
      { status: "settled", label: "Settle" },
      { status: "reversed", label: "Reverse" },
    ];
  }
  return [];
}



export function adminReferralProgrammeActionError(error: unknown): string {
  if (error instanceof AdminApiError) {
    switch (error.code) {
      case "forbidden":
        return "Your role cannot manage referral programmes.";
      case "invalid_input":
        return "Check the code prefix, rewards, limits, status, and date window.";
      case "not_found":
        return "That referral programme could not be found.";
      default:
        return "The referral programme change could not be saved.";
    }
  }
  return "The referral programme change could not be saved.";
}



export function referralRewardIssueActionMessage(
  result: AdminReferralRewardIssue,
): string {
  if (result.rewardCount === 0) {
    return "No due referral rewards were ready to issue.";
  }

  return `Issued ${result.rewardCount} referral rewards across ${result.referralCount} referrals: ${result.voucherCount} vouchers, ${result.commissionRebateCount} commission rebates, ${formatGHS(result.totalRewardMinor)} fixed reward value.`;
}



export function adminRiskActionError(error: unknown): string {
  if (error instanceof AdminApiError) {
    switch (error.code) {
      case "forbidden":
        return "Your role cannot manage risk reviews.";
      case "invalid_input":
        return "Choose a valid risk review status and reason.";
      case "not_found":
        return "That risk review is no longer active.";
      default:
        return "The risk review action could not be saved.";
    }
  }
  return "The risk review action could not be saved.";
}



export function adminSupportActionError(error: unknown): string {
  if (error instanceof AdminApiError) {
    switch (error.code) {
      case "forbidden":
        return "Your role cannot manage the support queue.";
      case "invalid_input":
        return "Choose a valid support status or assignment.";
      case "not_found":
        return "That support ticket is no longer active.";
      default:
        return "The support ticket action could not be saved.";
    }
  }
  return "The support ticket action could not be saved.";
}
