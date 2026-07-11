import {
  AdminExportDataset,
  AdminPlatformMetrics,
  AdminPlatformSettings,
  AdminProfileSettings,
  AdminUser,
  AdminRoleDefinition,
  AdminBusiness,
  AdminCustomer,
  AdminVerificationCase,
  AdminMoneyRails,
  AdminPlan,
  AdminSubscription,
  AdminPromotion,
  AdminAdCampaign,
  AdminAffiliate,
  AdminReferralProgramme,
  AdminRiskReview,
  AdminSupportTicket,
  AuditEvent,
  AdminLaunchReadiness,
} from "../../shared/types";
import { buildCoreDatasets } from "./core";
import { buildTenantDatasets } from "./tenant";
import { buildRevenueDatasets } from "./revenue";

export type ExportDatasetInput = {
  platformMetrics: AdminPlatformMetrics | null;
  platformSettings: AdminPlatformSettings;
  profileSettings: AdminProfileSettings;
  launchReadiness: AdminLaunchReadiness | null;
  adminUsers: AdminUser[];
  adminBusinesses: AdminBusiness[];
  adminCustomers: AdminCustomer[];
  verificationCases: AdminVerificationCase[];
  moneyRails: AdminMoneyRails | null;
  roleCatalog: AdminRoleDefinition[];
  plans: AdminPlan[];
  subscriptions: AdminSubscription[];
  promotions: AdminPromotion[];
  adCampaigns: AdminAdCampaign[];
  affiliates: AdminAffiliate[];
  referralProgrammes: AdminReferralProgramme[];
  riskReviews: AdminRiskReview[];
  supportTickets: AdminSupportTicket[];
  auditEvents: AuditEvent[];
};

export function buildExportDatasets(input: ExportDatasetInput): AdminExportDataset[] {
  return [
    ...buildCoreDatasets(input),
    ...buildTenantDatasets(input),
    ...buildRevenueDatasets(input),
  ];
}

export { buildCoreDatasets, buildTenantDatasets, buildRevenueDatasets };
