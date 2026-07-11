import { Form } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import FileDownloadRounded from "@mui/icons-material/FileDownloadRounded";
import {
  AdminExportDataset,
  AuditEvent,
  Section,
  AdminPlatformMetrics,
  AdminPlatformSettings,
  AdminProfileSettings,
  AdminLaunchReadiness,
  AdminUser,
  AdminBusiness,
  AdminCustomer,
  AdminVerificationCase,
  AdminMoneyRails,
  AdminRoleDefinition,
  AdminPlan,
  AdminSubscription,
  AdminPromotion,
  AdminAdCampaign,
  AdminAffiliate,
  AdminReferralProgramme,
  AdminRiskReview,
  AdminSupportTicket,
} from "../shared/types";
import { formatGHS, formatPercentBps } from "../shared/formatting";
import { reportStatusColor } from "../shared/colors";
import { shortTime } from "../shared/dates";
import { Panel } from "../../components/ui/Panel";
import { MetricCard } from "../../components/ui/MetricCard";
import { billingModeLabel, subscriptionStatusLabel } from "../subscriptions/utils";
import { adCampaignStatusLabel, adPlacementLabel, affiliateCommissionLabel, affiliateEntityLabel, affiliatePayoutLabel, affiliateStatusLabel, referralAudienceLabel, referralRefereeRewardKindLabel, referralRewardKindLabel, referralRewardLabel, referralStatusLabel } from "../growth/utils";
import { SectionHeader } from "../../components/ui/SectionHeader";



export function ExportsSection({
  platformMetrics,
  platformSettings,
  profileSettings,
  launchReadiness,
  adminUsers,
  adminBusinesses,
  adminCustomers,
  verificationCases,
  moneyRails,
  roleCatalog,
  plans,
  subscriptions,
  promotions,
  adCampaigns,
  affiliates,
  referralProgrammes,
  riskReviews,
  supportTickets,
  auditEvents,
  onSelect,
}: {
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
  onSelect: (section: Section) => void;
}) {
  const timeOrFallback = (value?: string) => (value ? shortTime(value) : "");
  const moneyWebhookEvents = moneyRails?.webhookEvents ?? [];
  const moneyPayoutReviews = moneyRails?.payoutReviews ?? [];
  const promotionRedemptions = promotions.flatMap((promotion) =>
    promotion.recentRedemptions.map((redemption) => ({
      promotion,
      redemption,
    })),
  );
  const pendingAdCampaigns = adCampaigns.filter(
    (campaign) => campaign.status === "pending_review",
  );
  const pendingAffiliates = affiliates.filter(
    (affiliate) => affiliate.status === "pending_review",
  );
  const draftReferralProgrammes = referralProgrammes.filter(
    (programme) => programme.status === "draft",
  );
  const exportDatasets: AdminExportDataset[] = [
    {
      id: "report-posture",
      title: "Report posture",
      helper: "GMV, commission, policy, and platform queue counts.",
      source: "reports",
      sourceLabel: "Open reports",
      tone: "ready",
      rows: [
        ["Metric", "Value", "Detail"],
        [
          "GMV this month",
          formatGHS(platformMetrics?.gmvMonthMinor ?? 0),
          "Succeeded platform payments",
        ],
        [
          "Commission",
          formatGHS(platformMetrics?.platformRevenueMonthMinor ?? 0),
          "Platform revenue month to date",
        ],
        [
          "Active businesses",
          platformMetrics?.activeBusinesses ?? 0,
          `${platformMetrics?.totalBusinesses ?? adminBusinesses.length} total tenants`,
        ],
        [
          "Payment health",
          formatPercentBps(platformMetrics?.paymentHealthBps ?? 0),
          `${platformMetrics?.failedPayments30d ?? 0} failed payments in 30 days`,
        ],
        [
          "Platform policy",
          platformSettings.maintenanceMode ? "Maintenance" : "Live",
          `${platformSettings.verificationSlaHours}h SLA`,
        ],
      ],
    },
    {
      id: "launch-readiness",
      title: "Launch readiness",
      helper:
        "Production gate checklist for credentials, providers, legal review, and quality scan setup.",
      source: "readiness",
      sourceLabel: "Open readiness",
      tone:
        (launchReadiness?.blockedCount ?? 0) > 0
          ? "blocked"
          : (launchReadiness?.watchCount ?? 0) > 0
            ? "watch"
            : "ready",
      rows: [
        [
          "Category",
          "Gate",
          "Status",
          "Summary",
          "Detail",
          "Action",
          "Target",
          "Updated",
        ],
        ...(launchReadiness?.checks ?? []).map((check) => [
          check.category,
          check.label,
          check.status,
          check.summary,
          check.detail,
          check.action,
          check.targetLabel,
          launchReadiness?.updatedAt
            ? shortTime(launchReadiness.updatedAt)
            : "",
        ]),
      ],
    },
    {
      id: "businesses",
      title: "Businesses",
      helper:
        "Tenant status, owner, GMV, commission, risk, and subaccount data.",
      source: "businesses",
      sourceLabel: "Open businesses",
      tone: adminBusinesses.some(
        (business) => business.operationalStatus === "suspended",
      )
        ? "watch"
        : "ready",
      rows: [
        [
          "Business",
          "Handle",
          "Owner",
          "Status",
          "Operational",
          "Plan",
          "Orders",
          "GMV",
          "Commission",
          "Risk",
          "Subaccount",
          "Last active",
        ],
        ...adminBusinesses.map((business) => [
          business.name,
          business.handle,
          business.ownerEmail,
          business.status,
          business.operationalStatus,
          business.plan,
          business.orders,
          formatGHS(business.gmvMinor),
          formatGHS(business.commissionMinor),
          business.riskLevel,
          business.subaccountRef || "Not provisioned",
          shortTime(business.lastActive),
        ]),
      ],
    },
    {
      id: "customers",
      title: "Customers",
      helper:
        "Client identity, contact, cross-tenant relationships, order volume, and GMV.",
      source: "customers",
      sourceLabel: "Open customers",
      tone: adminCustomers.some((customer) => customer.tenantCount > 1)
        ? "watch"
        : "ready",
      rows: [
        [
          "Customer",
          "Email",
          "Phone",
          "Businesses",
          "Orders",
          "Custom orders",
          "GMV",
          "Last business",
          "Last active",
        ],
        ...adminCustomers.map((customer) => [
          customer.displayName || customer.id,
          customer.email,
          customer.phone,
          customer.tenantCount,
          customer.orderCount,
          customer.customOrderCount,
          formatGHS(customer.gmvMinor),
          customer.lastBusinessName || customer.lastBusinessHandle,
          shortTime(customer.lastActive),
        ]),
      ],
    },
    {
      id: "verification",
      title: "Verification queue",
      helper: "KYC status, risk level, owner contact, documents, and notes.",
      source: "verification",
      sourceLabel: "Open KYC",
      tone: verificationCases.some(
        (item) => item.riskLevel === "high" && item.status !== "verified",
      )
        ? "blocked"
        : verificationCases.length > 0
          ? "watch"
          : "ready",
      rows: [
        [
          "Business",
          "Handle",
          "Owner",
          "Email",
          "Status",
          "Risk",
          "Plan",
          "Documents",
          "Submitted",
          "Updated",
          "Notes",
        ],
        ...verificationCases.map((item) => [
          item.businessName,
          item.handle,
          item.ownerName,
          item.ownerEmail,
          item.status,
          item.riskLevel,
          item.plan,
          item.documents.join("; "),
          shortTime(item.submittedAt),
          shortTime(item.updatedAt),
          item.notes,
        ]),
      ],
    },
    {
      id: "money",
      title: "Money rails",
      helper:
        "Webhook events and settlement review rows for Paystack operations.",
      source: "money",
      sourceLabel: "Open money",
      tone:
        moneyWebhookEvents.some((event) => event.status === "failed") ||
        moneyPayoutReviews.some(
          (review) => review.holdActive || review.status === "blocked",
        )
          ? "blocked"
          : moneyWebhookEvents.length + moneyPayoutReviews.length > 0
            ? "watch"
            : "ready",
      rows: [
        [
          "Kind",
          "Business",
          "Reference",
          "Status",
          "Amount",
          "Attempts",
          "Received/Updated",
          "Note",
        ],
        ...moneyWebhookEvents.map((event) => [
          "Webhook",
          event.business,
          event.providerReference,
          event.status,
          formatGHS(event.amountMinor),
          event.attempts,
          shortTime(event.receivedAt),
          event.note,
        ]),
        ...moneyPayoutReviews.map((review) => [
          "Settlement",
          review.business,
          review.subaccountRef,
          review.holdActive ? "held" : review.status,
          formatGHS(review.settlementMinor),
          "",
          timeOrFallback(review.holdUpdatedAt),
          review.holdReason || review.nextAction,
        ]),
      ],
    },
    {
      id: "risk",
      title: "Risk reviews",
      helper:
        "Open and closed trust, safety, payout, and verification signals.",
      source: "risk",
      sourceLabel: "Open risk",
      tone: riskReviews.some(
        (review) => review.level === "high" && review.status === "open",
      )
        ? "blocked"
        : riskReviews.some((review) => review.status === "open")
          ? "watch"
          : "ready",
      rows: [
        ["Title", "Business", "Level", "Status", "Owner", "Updated", "Reason"],
        ...riskReviews.map((review) => [
          review.title,
          review.business,
          review.level,
          review.status,
          review.owner,
          shortTime(review.updatedAt),
          review.reason,
        ]),
      ],
    },
    {
      id: "support",
      title: "Support tickets",
      helper: "Priority, assignment, status, category, and issue summary.",
      source: "support",
      sourceLabel: "Open support",
      tone: supportTickets.some(
        (ticket) => ticket.priority === "urgent" && ticket.status === "open",
      )
        ? "blocked"
        : supportTickets.some((ticket) => ticket.status === "open")
          ? "watch"
          : "ready",
      rows: [
        [
          "Subject",
          "Business",
          "Category",
          "Priority",
          "Status",
          "Assigned",
          "Created",
          "Updated",
          "Summary",
        ],
        ...supportTickets.map((ticket) => [
          ticket.subject,
          ticket.business,
          ticket.category,
          ticket.priority,
          ticket.status,
          ticket.assignedAdminName || ticket.assignedAdminEmail || "Unassigned",
          shortTime(ticket.createdAt),
          shortTime(ticket.updatedAt),
          ticket.summary,
        ]),
      ],
    },
    {
      id: "audit",
      title: "Audit trail",
      helper:
        "Operator evidence for sensitive admin decisions and settings changes.",
      source: "audit",
      sourceLabel: "Open audit",
      tone: auditEvents.some((event) => event.severity === "critical")
        ? "blocked"
        : auditEvents.some((event) => event.severity === "warning")
          ? "watch"
          : "ready",
      rows: [
        ["Action", "Actor", "Role", "Severity", "Target", "Created", "Detail"],
        ...auditEvents.map((event) => [
          event.action,
          event.actor,
          event.actorRole,
          event.severity,
          event.target,
          shortTime(event.createdAt),
          event.detail,
        ]),
      ],
    },
    {
      id: "users",
      title: "Admin users",
      helper: "Operator access roster with roles and active state.",
      source: "users",
      sourceLabel: "Open users",
      tone: adminUsers.some((user) => !user.isActive) ? "watch" : "ready",
      rows: [
        ["Name", "Email", "Role", "Active", "Created", "Updated"],
        ...adminUsers.map((user) => [
          user.displayName,
          user.email,
          user.role,
          user.isActive ? "Active" : "Inactive",
          timeOrFallback(user.createdAt),
          timeOrFallback(user.updatedAt),
        ]),
      ],
    },
    {
      id: "roles",
      title: "Roles and permissions",
      helper: "RBAC grant matrix for owner, operator, and support roles.",
      source: "roles",
      sourceLabel: "Open roles",
      tone: roleCatalog.some((role) => role.permissions.length === 0)
        ? "watch"
        : "ready",
      rows: [
        ["Role", "Label", "Permission count", "Permissions"],
        ...roleCatalog.map((role) => [
          role.role,
          role.label,
          role.permissions.length,
          role.permissions.join("; "),
        ]),
      ],
    },
    {
      id: "settings",
      title: "Settings and notifications",
      helper:
        "Operator profile, notification routing, and platform policy controls.",
      source: "settings",
      sourceLabel: "Open settings",
      tone: platformSettings.maintenanceMode ? "watch" : "ready",
      rows: [
        ["Area", "Setting", "Value", "Detail"],
        [
          "Operator profile",
          "Display name",
          profileSettings.user.displayName,
          profileSettings.user.email,
        ],
        [
          "Operator profile",
          "Role",
          profileSettings.user.role,
          profileSettings.user.isActive ? "Active" : "Inactive",
        ],
        [
          "Notification preferences",
          "Email alerts",
          profileSettings.preferences.notifyEmail ? "On" : "Off",
          "Primary operator delivery route",
        ],
        [
          "Notification preferences",
          "SMS alerts",
          profileSettings.preferences.notifySms ? "On" : "Off",
          profileSettings.preferences.phoneNumber || "No phone number",
        ],
        [
          "Notification preferences",
          "Daily digest",
          profileSettings.preferences.dailyDigestTime,
          profileSettings.preferences.timezone,
        ],
        [
          "Notification preferences",
          "Subscription alerts",
          profileSettings.preferences.alertSubscriptions ? "Watched" : "Muted",
          "Subscription billing and plan usage",
        ],
        [
          "Notification preferences",
          "Promotion alerts",
          profileSettings.preferences.alertPromotions ? "Watched" : "Muted",
          "Promotion redemption activity",
        ],
        [
          "Platform policy",
          "Maintenance mode",
          platformSettings.maintenanceMode ? "On" : "Off",
          platformSettings.platformName,
        ],
        [
          "Platform policy",
          "Verification SLA",
          `${platformSettings.verificationSlaHours}h`,
          platformSettings.supportEmail,
        ],
        [
          "Platform policy",
          "Payout review threshold",
          formatGHS(platformSettings.payoutReviewThresholdPesewas),
          "Settlement review threshold",
        ],
      ],
    },
    {
      id: "plans",
      title: "Plan packages",
      helper: "Package pricing, commission, tenant count, and MRR snapshot.",
      source: "subscriptions",
      sourceLabel: "Open plans",
      tone: plans.some((plan) => !plan.isActive) ? "watch" : "ready",
      rows: [
        [
          "Name",
          "Code",
          "Active",
          "Monthly fee",
          "Yearly fee",
          "Commission",
          "Design limit",
          "Businesses",
          "Active subscriptions",
          "Estimated MRR",
          "Created",
          "Updated",
        ],
        ...plans.map((plan) => [
          plan.name,
          plan.code,
          plan.isActive ? "Active" : "Archived",
          formatGHS(plan.monthlyFeeMinor),
          formatGHS(plan.yearlyFeeMinor),
          `${(plan.commissionBps / 100).toFixed(2)}%`,
          typeof plan.designLimit === "number" ? plan.designLimit : "Unlimited",
          plan.businessCount,
          plan.activeSubscriptionCount,
          formatGHS(plan.estimatedMrrMinor),
          shortTime(plan.createdAt),
          shortTime(plan.updatedAt),
        ]),
      ],
    },
    {
      id: "subscriptions",
      title: "Subscriptions",
      helper: "Plan, billing state, invoices, usage, and renewal timing.",
      source: "subscriptions",
      sourceLabel: "Open subscriptions",
      tone: subscriptions.some(
        (subscription) =>
          subscription.status === "past_due" ||
          subscription.status === "grace_period",
      )
        ? "blocked"
        : subscriptions.some(
              (subscription) =>
                subscription.status === "cancel_at_period_end" ||
                subscription.status === "canceled",
            )
          ? "watch"
          : "ready",
      rows: [
        [
          "Business",
          "Handle",
          "Plan",
          "Status",
          "Billing mode",
          "Monthly fee",
          "Design usage",
          "Last invoice",
          "Last payment",
          "Next billing",
        ],
        ...subscriptions.map((subscription) => [
          subscription.businessName,
          subscription.handle,
          subscription.planName,
          subscriptionStatusLabel(subscription.status),
          billingModeLabel(subscription.billingMode),
          formatGHS(subscription.monthlyFeeMinor),
          typeof subscription.designLimit === "number"
            ? `${subscription.designCount}/${subscription.designLimit}`
            : `${subscription.designCount}/unlimited`,
          subscription.lastInvoiceRef,
          timeOrFallback(subscription.lastPaymentAt),
          timeOrFallback(subscription.nextBillingAt),
        ]),
      ],
    },
    {
      id: "promotions",
      title: "Promotions",
      helper: "Voucher rules, targeting, funding, usage, and redeemed value.",
      source: "promotions",
      sourceLabel: "Open promotions",
      tone: promotions.some((promotion) => promotion.status === "paused")
        ? "watch"
        : "ready",
      rows: [
        [
          "Title",
          "Code",
          "Business",
          "Status",
          "Type",
          "Value",
          "Funding",
          "Scope",
          "Redemptions",
          "Discount redeemed",
        ],
        ...promotions.map((promotion) => [
          promotion.title,
          promotion.code,
          promotion.businessName || "Platform-wide",
          promotion.status,
          promotion.discountType,
          promotion.discountType === "percentage"
            ? `${(promotion.discountValue / 100).toFixed(1)}%`
            : formatGHS(promotion.discountValue),
          promotion.fundingSource,
          promotion.scope,
          promotion.redemptionCount,
          formatGHS(promotion.discountRedeemedMinor),
        ]),
      ],
    },
    {
      id: "ad-campaigns",
      title: "Sponsored placements",
      helper:
        "Campaign status, advertiser, placement, budget, spend, and engagement.",
      source: "ads",
      sourceLabel: "Open ads",
      tone: pendingAdCampaigns.length > 0 ? "watch" : "ready",
      rows: [
        [
          "Campaign",
          "Business",
          "Handle",
          "Placement",
          "Target",
          "Status",
          "Pricing",
          "Budget",
          "Spend",
          "Daily cap",
          "Starts",
          "Ends",
          "Impressions",
          "Clicks",
          "CTR",
          "Review note",
          "Updated",
        ],
        ...adCampaigns.map((campaign) => [
          campaign.headline,
          campaign.businessName,
          campaign.businessHandle,
          adPlacementLabel(campaign.placementType),
          campaign.targetLabel || campaign.targetRefId || "Business storefront",
          adCampaignStatusLabel(campaign.status),
          campaign.pricingModel,
          formatGHS(campaign.budgetMinor),
          formatGHS(campaign.spendMinor),
          typeof campaign.dailyCapMinor === "number"
            ? formatGHS(campaign.dailyCapMinor)
            : "",
          shortTime(campaign.startsAt),
          shortTime(campaign.endsAt),
          campaign.impressionCount,
          campaign.clickCount,
          formatPercentBps(campaign.clickRateBps),
          campaign.reviewNote,
          shortTime(campaign.updatedAt),
        ]),
      ],
    },
    {
      id: "affiliates",
      title: "Affiliate programmes",
      helper:
        "Partner codes, contact details, commission terms, payout rails, cookie windows, and status.",
      source: "affiliates",
      sourceLabel: "Open affiliates",
      tone: pendingAffiliates.length > 0 ? "watch" : "ready",
      rows: [
        [
          "Affiliate",
          "Code",
          "Entity",
          "Contact",
          "Email",
          "Phone",
          "Website",
          "Commission",
          "Cookie window",
          "Payout mode",
          "Payout reference",
          "Status",
          "Notes",
          "Updated",
        ],
        ...affiliates.map((affiliate) => [
          affiliate.displayName,
          affiliate.code,
          affiliateEntityLabel(affiliate.entityType),
          affiliate.contactName,
          affiliate.email,
          affiliate.phone,
          affiliate.websiteUrl,
          affiliateCommissionLabel(affiliate),
          `${affiliate.cookieWindowDays} days`,
          affiliatePayoutLabel(affiliate.payoutMode),
          affiliate.payoutReference,
          affiliateStatusLabel(affiliate.status),
          affiliate.notes,
          shortTime(affiliate.updatedAt),
        ]),
      ],
    },
    {
      id: "referral-programmes",
      title: "Referral programmes",
      helper:
        "Code prefixes, audiences, reward economics, qualifying order minimums, hold windows, schedules, and status.",
      source: "referrals",
      sourceLabel: "Open referrals",
      tone: draftReferralProgrammes.length > 0 ? "watch" : "ready",
      rows: [
        [
          "Programme",
          "Code prefix",
          "Audience",
          "Referrer reward",
          "New customer reward",
          "Reward",
          "Minimum order",
          "Hold days",
          "Status",
          "Starts",
          "Ends",
          "Notes",
          "Updated",
        ],
        ...referralProgrammes.map((programme) => [
          programme.title,
          programme.codePrefix,
          referralAudienceLabel(programme.audience),
          referralRewardKindLabel(programme.referrerRewardKind),
          referralRefereeRewardKindLabel(programme.refereeRewardKind),
          referralRewardLabel(programme),
          formatGHS(programme.qualifyingOrderMinMinor),
          programme.rewardHoldDays,
          referralStatusLabel(programme.status),
          programme.startsAt ? shortTime(programme.startsAt) : "",
          programme.endsAt ? shortTime(programme.endsAt) : "",
          programme.notes,
          shortTime(programme.updatedAt),
        ]),
      ],
    },
    {
      id: "promotion-redemptions",
      title: "Recent promotion redemptions",
      helper:
        "Latest redemption rows per voucher with customer and order evidence.",
      source: "promotions",
      sourceLabel: "Open promotions",
      tone: promotionRedemptions.some(
        ({ redemption }) => redemption.status === "pending",
      )
        ? "watch"
        : "ready",
      rows: [
        [
          "Promotion",
          "Code",
          "Business",
          "Business ID",
          "Customer",
          "Customer ID",
          "Order ID",
          "Status",
          "Discount",
          "Redeemed at",
          "Created at",
          "Updated at",
        ],
        ...promotionRedemptions.map(({ promotion, redemption }) => [
          promotion.title,
          promotion.code,
          promotion.businessName || "Platform-wide",
          redemption.businessId,
          redemption.customerName || "Unknown customer",
          redemption.customerId ?? "",
          redemption.orderId ?? "",
          redemption.status,
          formatGHS(redemption.discountMinor),
          timeOrFallback(redemption.redeemedAt),
          shortTime(redemption.createdAt),
          shortTime(redemption.updatedAt),
        ]),
      ],
    },
  ];
  const exportRowCount = exportDatasets.reduce(
    (sum, dataset) => sum + Math.max(dataset.rows.length - 1, 0),
    0,
  );
  const blockedCount = exportDatasets.filter(
    (dataset) => dataset.tone === "blocked",
  ).length;

  return (
    <Stack spacing={2.5}>
      <SectionHeader
        eyebrow="Operator exports"
        title="Exports"
        helper="Download CSV snapshots from the current admin read models for reporting, review, and compliance handoff."
      />

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "repeat(4, 1fr)" },
        }}
      >
        <MetricCard
          label="Export packs"
          value={String(exportDatasets.length)}
          helper="Current admin datasets"
          trend="CSV"
        />
        <MetricCard
          label="Rows available"
          value={String(exportRowCount)}
          helper="Across all export files"
          trend="Live"
        />
        <MetricCard
          label="Blocked packs"
          value={String(blockedCount)}
          helper="Need operator attention"
          trend={blockedCount > 0 ? "Review" : "Clear"}
        />
        <MetricCard
          label="Audit rows"
          value={String(auditEvents.length)}
          helper="Durable admin evidence"
          trend="Traceable"
        />
      </Box>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" },
        }}
      >
        {exportDatasets.map((dataset) => {
          const color = reportStatusColor(dataset.tone);
          const rowCount = Math.max(dataset.rows.length - 1, 0);
          return (
            <Panel
              key={dataset.id}
              sx={{
                p: { xs: 2, md: 2.5 },
                borderColor: alpha(color, 0.2),
                backgroundImage: `
                  linear-gradient(90deg, ${alpha(color, 0.07)}, transparent 34%),
                  linear-gradient(180deg, rgba(var(--surface-rgb), 0.98), rgba(var(--surface-rgb), 0.72))
                `,
              }}
            >
              <Stack spacing={2}>
                <Stack
                  direction="row"
                  spacing={1.5}
                  sx={{ alignItems: "flex-start" }}
                >
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 1.5,
                      display: "grid",
                      placeItems: "center",
                      bgcolor: alpha(color, 0.12),
                      color,
                      flex: "0 0 auto",
                    }}
                  >
                    <FileDownloadRounded />
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: "center", flexWrap: "wrap" }}
                    >
                      <Typography variant="h6">{dataset.title}</Typography>
                      <Chip
                        size="small"
                        label={dataset.tone}
                        sx={{
                          bgcolor: alpha(color, 0.12),
                          color,
                          textTransform: "capitalize",
                          fontWeight: 900,
                        }}
                      />
                    </Stack>
                    <Typography
                      variant="body2"
                      sx={{ color: "text.secondary" }}
                    >
                      {rowCount} rows · {dataset.helper}
                    </Typography>
                  </Box>
                </Stack>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  sx={{ flexWrap: "wrap" }}
                >
                  <Form method="post" reloadDocument>
                    <input
                      type="hidden"
                      name="intent"
                      value="admin-export:download"
                    />
                    <input type="hidden" name="dataset" value={dataset.id} />
                    <Button
                      type="submit"
                      variant="contained"
                      startIcon={<FileDownloadRounded />}
                    >
                      Download CSV
                    </Button>
                  </Form>
                  <Button
                    variant="outlined"
                    endIcon={<ArrowForwardRounded />}
                    onClick={() => onSelect(dataset.source)}
                  >
                    {dataset.sourceLabel}
                  </Button>
                </Stack>
              </Stack>
            </Panel>
          );
        })}
      </Box>
    </Stack>
  );
}
