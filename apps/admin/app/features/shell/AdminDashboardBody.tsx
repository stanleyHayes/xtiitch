import { Section, AdminActionFeedback, AdminNotification } from "../shared/types";
import { OverviewSection } from "../overview/OverviewSection";
import { NotificationsSection } from "../settings/NotificationsSection";
import { ReportsSection } from "../settings/ReportsSection";
import { ExportsSection } from "../settings/ExportsSection";
import { HealthSection } from "../settings/HealthSection";
import { LaunchReadinessSection } from "../settings/LaunchReadinessSection";
import { SubscriptionsSection } from "../subscriptions/SubscriptionsSection";
import { PromotionsSection } from "../growth/PromotionsSection";
import { AdsSection } from "../growth/AdsSection";
import { AffiliatesSection } from "../growth/AffiliatesSection";
import { ReferralsSection } from "../growth/ReferralsSection";
import { AdminUsersSection } from "../users/AdminUsersSection";
import { RolePermissionsSection } from "../users/RolePermissionsSection";
import { SettingsSection } from "../settings/SettingsSection";
import { WaitlistSection } from "../settings/WaitlistSection";
import { VerificationsSection } from "../verifications/VerificationsSection";
import { BusinessesSection } from "../businesses/BusinessesSection";
import { CustomersSection } from "../customers/CustomersSection";
import { MoneySection } from "../money/MoneySection";
import { RiskSection } from "../risk/RiskSection";
import { SupportTicketsSection } from "../support/SupportTicketsSection";
import { AuditSection } from "../audit/AuditSection";
import type { AdminLoaderData } from "../shared/adminLoader";

export function AdminDashboardBody({ // eslint-disable-line complexity, max-lines-per-function -- large presentational component; refactor in follow-up
  section,
  isNavLoading,
  setSection,
  adminNotifications,
  pendingCount,
  loaderData,
  actionData,
}: {
  section: Section;
  isNavLoading: boolean;
  setSection: (section: Section) => void;
  adminNotifications: AdminNotification[];
  pendingCount: number;
  loaderData: AdminLoaderData;
  actionData?: AdminActionFeedback;
}) {
  const actionFeedback = actionData;
  const {
    admin,
    profileSettings,
    profileSettingsError,
    platformSettings,
    platformSettingsError,
    adminUsers,
    roleCatalog,
    permissionCatalog,
    userManagementError,
    verificationCases,
    verificationQueueError,
    adminBusinesses,
    businessManagementError,
    adminCustomers,
    customerDirectoryError,
    platformMetrics,
    platformMetricsError,
    operationsHealth,
    operationsHealthError,
    backendNotificationsError,
    backendReportItems,
    backendReportsError,
    launchReadiness,
    launchReadinessError,
    moneyRails,
    moneyRailsError,
    subscriptions,
    subscriptionsError,
    plans,
    plansError,
    planEntitlements,
    planEntitlementsError,
    subscriptionDiscountCodes,
    subscriptionDiscountCodesError,
    promotions,
    promotionsError,
    adCampaigns,
    adCampaignsError,
    affiliates,
    affiliatesError,
    affiliateAttribution,
    affiliateAttributionError,
    referralProgrammes,
    referralProgrammesError,
    riskReviews,
    riskReviewError,
    supportTickets,
    supportQueueError,
    auditEvents,
    auditLogError,
    waitlistLeads,
    waitlistError,
  } = loaderData;

  return (
    <>
              {section === "overview" ? (
                <OverviewSection
                  platformMetrics={platformMetrics}
                  platformMetricsError={platformMetricsError}
                  operationsHealth={operationsHealth}
                  businesses={adminBusinesses}
                  customers={adminCustomers}
                  subscriptions={subscriptions}
                  verificationCases={verificationCases}
                  supportTickets={supportTickets}
                  riskReviews={riskReviews}
                  auditEvents={auditEvents}
                  moneyRails={moneyRails}
                  promotions={promotions}
                  adCampaigns={adCampaigns}
                  affiliates={affiliates}
                  referralProgrammes={referralProgrammes}
                  pendingCount={pendingCount}
                  onSelect={setSection}
                />
              ) : null}
              {section === "notifications" ? (
                <NotificationsSection
                  notifications={adminNotifications}
                  notificationsError={backendNotificationsError}
                  preferences={profileSettings.preferences}
                  onSelect={setSection}
                />
              ) : null}
              {section === "reports" ? (
                <ReportsSection
                  platformMetrics={platformMetrics}
                  platformSettings={platformSettings}
                  backendReportItems={backendReportItems}
                  backendReportsError={backendReportsError}
                  adminBusinesses={adminBusinesses}
                  verificationCases={verificationCases}
                  moneyRails={moneyRails}
                  subscriptions={subscriptions}
                  promotions={promotions}
                  adCampaigns={adCampaigns}
                  affiliates={affiliates}
                  referralProgrammes={referralProgrammes}
                  riskReviews={riskReviews}
                  supportTickets={supportTickets}
                  auditEvents={auditEvents}
                  onSelect={setSection}
                />
              ) : null}
              {section === "exports" ? (
                <ExportsSection
                  platformMetrics={platformMetrics}
                  platformSettings={platformSettings}
                  profileSettings={profileSettings}
                  launchReadiness={launchReadiness}
                  adminUsers={adminUsers}
                  adminBusinesses={adminBusinesses}
                  adminCustomers={adminCustomers}
                  verificationCases={verificationCases}
                  moneyRails={moneyRails}
                  roleCatalog={roleCatalog}
                  plans={plans}
                  subscriptions={subscriptions}
                  promotions={promotions}
                  adCampaigns={adCampaigns}
                  affiliates={affiliates}
                  referralProgrammes={referralProgrammes}
                  riskReviews={riskReviews}
                  supportTickets={supportTickets}
                  auditEvents={auditEvents}
                  onSelect={setSection}
                />
              ) : null}
              {section === "health" ? (
                <HealthSection
                  platformMetrics={platformMetrics}
                  platformSettings={platformSettings}
                  adminUsers={adminUsers}
                  adminBusinesses={adminBusinesses}
                  verificationCases={verificationCases}
                  moneyRails={moneyRails}
                  subscriptions={subscriptions}
                  promotions={promotions}
                  adCampaigns={adCampaigns}
                  affiliates={affiliates}
                  referralProgrammes={referralProgrammes}
                  riskReviews={riskReviews}
                  supportTickets={supportTickets}
                  auditEvents={auditEvents}
                  operationsHealth={operationsHealth}
                  operationsHealthError={operationsHealthError}
                  onSelect={setSection}
                />
              ) : null}
              {section === "readiness" ? (
                <LaunchReadinessSection
                  readiness={launchReadiness}
                  readinessError={launchReadinessError}
                  onSelect={setSection}
                />
              ) : null}
              {section === "subscriptions" ? (
                <SubscriptionsSection
                  subscriptions={subscriptions}
                  subscriptionsError={subscriptionsError}
                  plans={plans}
                  plansError={plansError}
                  planEntitlements={planEntitlements}
                  planEntitlementsError={planEntitlementsError}
                  subscriptionDiscountCodes={subscriptionDiscountCodes}
                  subscriptionDiscountCodesError={
                    subscriptionDiscountCodesError
                  }
                  platformMetrics={platformMetrics}
                  actionData={actionFeedback}
                  onSelect={setSection}
                />
              ) : null}
              {section === "promotions" ? (
                <PromotionsSection
                  promotions={promotions}
                  promotionsError={promotionsError}
                  businesses={adminBusinesses}
                  actionData={actionFeedback}
                />
              ) : null}
              {section === "ads" ? (
                <AdsSection
                  campaigns={adCampaigns}
                  adCampaignsError={adCampaignsError}
                  businesses={adminBusinesses}
                  actionData={actionFeedback}
                />
              ) : null}
              {section === "affiliates" ? (
                <AffiliatesSection
                  affiliates={affiliates}
                  affiliatesError={affiliatesError}
                  affiliateAttribution={affiliateAttribution}
                  affiliateAttributionError={affiliateAttributionError}
                  actionData={actionFeedback}
                />
              ) : null}
              {section === "referrals" ? (
                <ReferralsSection
                  programmes={referralProgrammes}
                  referralProgrammesError={referralProgrammesError}
                  businesses={adminBusinesses}
                  actionData={actionFeedback}
                />
              ) : null}
              {section === "users" ? (
                <AdminUsersSection
                  users={adminUsers}
                  roles={roleCatalog}
                  currentUserId={admin.adminUserId}
                  actionData={actionFeedback}
                  error={userManagementError}
                />
              ) : null}
              {section === "roles" ? (
                <RolePermissionsSection
                  roles={roleCatalog}
                  permissions={permissionCatalog}
                  actionData={actionFeedback}
                />
              ) : null}
              {section === "settings" ? (
                <SettingsSection
                  admin={admin}
                  profileSettings={profileSettings}
                  profileSettingsError={profileSettingsError}
                  platformSettings={platformSettings}
                  platformSettingsError={platformSettingsError}
                  roles={roleCatalog}
                />
              ) : null}
              {section === "waitlist" ? (
                <WaitlistSection
                  leads={waitlistLeads}
                  error={waitlistError}
                  isLoading={isNavLoading}
                />
              ) : null}
              {section === "verification" ? (
                <VerificationsSection
                  verificationCases={verificationCases}
                  verificationQueueError={verificationQueueError}
                  actionData={actionFeedback}
                />
              ) : null}
              {section === "businesses" ? (
                <BusinessesSection
                  adminBusinesses={adminBusinesses}
                  businessManagementError={businessManagementError}
                  actionData={actionFeedback}
                  onSelect={setSection}
                />
              ) : null}
              {section === "customers" ? (
                <CustomersSection
                  adminCustomers={adminCustomers}
                  customerDirectoryError={customerDirectoryError}
                />
              ) : null}
              {section === "money" ? (
                <MoneySection
                  moneyRails={moneyRails}
                  moneyRailsError={moneyRailsError}
                />
              ) : null}
              {section === "risk" ? (
                <RiskSection
                  riskReviews={riskReviews}
                  riskReviewError={riskReviewError}
                  actionData={actionFeedback}
                />
              ) : null}
              {section === "support" ? (
                <SupportTicketsSection
                  supportTickets={supportTickets}
                  supportQueueError={supportQueueError}
                  actionData={actionFeedback}
                  admin={admin}
                />
              ) : null}
              {section === "audit" ? (
                <AuditSection
                  auditEvents={auditEvents}
                  auditLogError={auditLogError}
                />
              ) : null}
    </>
  );
}
