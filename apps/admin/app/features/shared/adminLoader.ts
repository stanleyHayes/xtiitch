import {
  adminApi,
  type AdminVerificationCase,
  type AdminBusiness,
  type AdminCustomer,
  type AdminPlatformMetrics,
  type AdminOperationsHealth,
  type AdminLaunchReadiness,
  type AdminMoneyRails,
  type AdminSubscription,
  type AdminPlan,
  type AdminPlanEntitlementFeature,
  type AdminSubscriptionDiscountCode,
  type AdminPromotion,
  type AdminAdCampaign,
  type AdminAffiliate,
  type AdminAffiliateAttribution,
  type AdminReferralProgramme,
  type AdminRiskReview,
  type AdminSupportTicket,
  type AdminAuditEvent,
  type AdminWaitlistLead,
  type AdminUser,
  type AdminRoleDefinition,
} from "../../lib/api";
import { requireAdminContext } from "../../lib/session";
import { defaultPermissionCatalog } from "../users/utils";
import {
  loadAdminResource,
  fallbackProfileSettings,
  fallbackPlatformSettings,
} from "./adminApi";
import { AdminNotification, AdminReportItem, Section } from "./types";

export async function loadAdminDashboardData(request: Request) {
  const { admin, accessToken } = await requireAdminContext(request);
  const [profileSettingsResult, platformSettingsResult] = await Promise.all([
    loadAdminResource(
      () => adminApi.profileSettings(accessToken),
      fallbackProfileSettings(admin),
      "Your role cannot view profile settings.",
      "Profile settings could not be loaded. The console is using your signed-in session details.",
    ),
    loadAdminResource(
      () => adminApi.platformSettings(accessToken),
      fallbackPlatformSettings(),
      "Your role cannot view platform settings.",
      "Platform settings could not be loaded. The console is using default policy values.",
    ),
  ]);
  const accessCatalog = await adminApi.roles(accessToken).catch(() => ({
    roles: [] as AdminRoleDefinition[],
    permissions: defaultPermissionCatalog(),
  }));
  const adminUsersResult = await loadAdminResource(
    () => adminApi.listUsers(accessToken),
    [] as AdminUser[],
    "Only platform owners can manage operator access.",
    "Operator access could not be loaded right now.",
  );
  const verificationCasesResult = await loadAdminResource(
    () => adminApi.verificationCases(accessToken),
    [] as AdminVerificationCase[],
    "Your role cannot review business verifications.",
    "Business verification cases could not be loaded right now.",
  );
  const adminBusinessesResult = await loadAdminResource(
    () => adminApi.businesses(accessToken),
    [] as AdminBusiness[],
    "Your role cannot manage business accounts.",
    "Business accounts could not be loaded right now.",
  );
  const adminCustomersResult = await loadAdminResource(
    () => adminApi.customers(accessToken),
    [] as AdminCustomer[],
    "Your role cannot view the customer directory.",
    "Customer directory could not be loaded right now.",
  );
  const platformMetricsResult = await loadAdminResource(
    () => adminApi.platformMetrics(accessToken),
    null as AdminPlatformMetrics | null,
    "Your role cannot view platform-wide metrics.",
    "Platform metrics could not be loaded right now.",
  );
  const operationsHealthResult = await loadAdminResource(
    () => adminApi.operationsHealth(accessToken),
    null as AdminOperationsHealth | null,
    "Your role cannot view the backend health summary.",
    "Operations health could not be loaded right now.",
  );
  const backendNotificationsResult = await loadAdminResource(
    async () => {
      const notificationFeed = await adminApi.adminNotifications(accessToken);
      return notificationFeed.notifications.map((notification) => ({
        ...notification,
        target: notification.target as Section,
      }));
    },
    [] as AdminNotification[],
    "Your role cannot view the backend notification feed.",
    "Backend notifications could not be loaded right now.",
  );
  const backendReportItemsResult = await loadAdminResource(
    async () => {
      const reportFeed = await adminApi.adminReports(accessToken);
      return reportFeed.items.map((item) => ({
        ...item,
        target: item.target as Section,
      }));
    },
    [] as AdminReportItem[],
    "Your role cannot view the backend report feed.",
    "Backend reports could not be loaded right now.",
  );
  const launchReadinessResult = await loadAdminResource(
    () => adminApi.launchReadiness(accessToken),
    null as AdminLaunchReadiness | null,
    "Your role cannot view launch readiness.",
    "Launch readiness could not be loaded right now.",
  );
  const moneyRailsResult = await loadAdminResource(
    () => adminApi.moneyRails(accessToken),
    null as AdminMoneyRails | null,
    "Your role cannot manage money rails.",
    "Money rails could not be loaded right now.",
  );
  const subscriptionsResult = await loadAdminResource(
    () => adminApi.subscriptions(accessToken),
    [] as AdminSubscription[],
    "Your role cannot manage subscriptions.",
    "Subscriptions could not be loaded right now.",
  );
  const plansResult = await loadAdminResource(
    () => adminApi.plans(accessToken),
    [] as AdminPlan[],
    "Your role cannot manage plan packages.",
    "Plan packages could not be loaded right now.",
  );
  const planEntitlementsResult = await loadAdminResource(
    () => adminApi.planEntitlements(accessToken),
    [] as AdminPlanEntitlementFeature[],
    "Your role cannot manage plan entitlements.",
    "Plan entitlements could not be loaded right now.",
  );
  const subscriptionDiscountCodesResult = await loadAdminResource(
    () => adminApi.subscriptionDiscountCodes(accessToken),
    [] as AdminSubscriptionDiscountCode[],
    "Your role cannot manage subscription discount codes.",
    "Subscription discount codes could not be loaded right now.",
  );
  const promotionsResult = await loadAdminResource(
    () => adminApi.promotions(accessToken),
    [] as AdminPromotion[],
    "Your role cannot manage promotions.",
    "Promotions could not be loaded right now.",
  );
  const adCampaignsResult = await loadAdminResource(
    () => adminApi.adCampaigns(accessToken),
    [] as AdminAdCampaign[],
    "Your role cannot manage sponsored placements.",
    "Sponsored placements could not be loaded right now.",
  );
  const affiliatesResult = await loadAdminResource(
    () => adminApi.affiliates(accessToken),
    [] as AdminAffiliate[],
    "Your role cannot manage affiliate programmes.",
    "Affiliate programmes could not be loaded right now.",
  );
  const affiliateAttributionResult = await loadAdminResource(
    () => adminApi.affiliateAttribution(accessToken),
    [] as AdminAffiliateAttribution[],
    "Your role cannot view affiliate performance.",
    "Affiliate performance could not be loaded right now.",
  );
  const referralProgrammesResult = await loadAdminResource(
    () => adminApi.referralProgrammes(accessToken),
    [] as AdminReferralProgramme[],
    "Your role cannot manage referral programmes.",
    "Referral programmes could not be loaded right now.",
  );
  const riskReviewsResult = await loadAdminResource(
    () => adminApi.riskReviews(accessToken),
    [] as AdminRiskReview[],
    "Your role cannot manage risk reviews.",
    "Risk reviews could not be loaded right now.",
  );
  const supportTicketsResult = await loadAdminResource(
    () => adminApi.supportTickets(accessToken),
    [] as AdminSupportTicket[],
    "Your role cannot manage the support queue.",
    "Support tickets could not be loaded right now.",
  );
  const auditEventsResult = await loadAdminResource(
    () => adminApi.auditEvents(accessToken),
    [] as AdminAuditEvent[],
    "Your role cannot view the durable audit trail.",
    "Audit events could not be loaded right now.",
  );
  const waitlistLeadsResult = await loadAdminResource(
    () => adminApi.waitlistLeads(accessToken),
    [] as AdminWaitlistLead[],
    "Your role cannot view marketing waitlist signups.",
    "Waitlist signups could not be loaded right now.",
  );

  return {
    admin,
    profileSettings: profileSettingsResult.data,
    profileSettingsError: profileSettingsResult.error,
    platformSettings: platformSettingsResult.data,
    platformSettingsError: platformSettingsResult.error,
    adminUsers: adminUsersResult.data,
    roleCatalog: accessCatalog.roles,
    permissionCatalog: accessCatalog.permissions.length
      ? accessCatalog.permissions
      : defaultPermissionCatalog(),
    userManagementError: adminUsersResult.error,
    verificationCases: verificationCasesResult.data,
    verificationQueueError: verificationCasesResult.error,
    adminBusinesses: adminBusinessesResult.data,
    businessManagementError: adminBusinessesResult.error,
    adminCustomers: adminCustomersResult.data,
    customerDirectoryError: adminCustomersResult.error,
    platformMetrics: platformMetricsResult.data,
    platformMetricsError: platformMetricsResult.error,
    operationsHealth: operationsHealthResult.data,
    operationsHealthError: operationsHealthResult.error,
    backendNotifications: backendNotificationsResult.data,
    backendNotificationsError: backendNotificationsResult.error,
    backendReportItems: backendReportItemsResult.data,
    backendReportsError: backendReportItemsResult.error,
    launchReadiness: launchReadinessResult.data,
    launchReadinessError: launchReadinessResult.error,
    moneyRails: moneyRailsResult.data,
    moneyRailsError: moneyRailsResult.error,
    subscriptions: subscriptionsResult.data,
    subscriptionsError: subscriptionsResult.error,
    plans: plansResult.data,
    plansError: plansResult.error,
    planEntitlements: planEntitlementsResult.data,
    planEntitlementsError: planEntitlementsResult.error,
    subscriptionDiscountCodes: subscriptionDiscountCodesResult.data,
    subscriptionDiscountCodesError: subscriptionDiscountCodesResult.error,
    promotions: promotionsResult.data,
    promotionsError: promotionsResult.error,
    adCampaigns: adCampaignsResult.data,
    adCampaignsError: adCampaignsResult.error,
    affiliates: affiliatesResult.data,
    affiliatesError: affiliatesResult.error,
    affiliateAttribution: affiliateAttributionResult.data,
    affiliateAttributionError: affiliateAttributionResult.error,
    referralProgrammes: referralProgrammesResult.data,
    referralProgrammesError: referralProgrammesResult.error,
    riskReviews: riskReviewsResult.data,
    riskReviewError: riskReviewsResult.error,
    supportTickets: supportTicketsResult.data,
    supportQueueError: supportTicketsResult.error,
    auditEvents: auditEventsResult.data,
    auditLogError: auditEventsResult.error,
    waitlistLeads: waitlistLeadsResult.data,
    waitlistError: waitlistLeadsResult.error,
  };
}

export type AdminLoaderData = Awaited<ReturnType<typeof loadAdminDashboardData>>;
